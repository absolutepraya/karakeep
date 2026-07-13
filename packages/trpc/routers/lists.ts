import { experimental_trpcMiddleware } from "@trpc/server";
import { z } from "zod";

import { eq } from "drizzle-orm";

import type { KarakeepDBTransaction } from "@karakeep/db";

import {
  bookmarkLists,
  listCollaborators,
  listInvitations,
} from "@karakeep/db/schema";
import {
  zBookmarkListSchema,
  zEditBookmarkListSchemaWithValidation,
  zMergeListSchema,
  zNewBookmarkListSchema,
} from "@karakeep/shared/types/lists";

import { addLogFields, logEvent } from "@karakeep/shared-server";

import type { AuthedContext } from "../index";
import {
  createEventLogMiddleware,
  createRateLimitMiddleware,
  createScopedAuthedProcedure,
  router,
} from "../index";
import { ListInvitation } from "../models/listInvitations";
import { List } from "../models/lists";
import { ensureBookmarkOwnership } from "./bookmarks";
import { recordOfflineSyncEvent } from "../models/offlineSync";

const listsProcedure = createScopedAuthedProcedure("lists");

function asTransactionContext(
  ctx: AuthedContext,
  db: KarakeepDBTransaction,
): AuthedContext {
  return { ...ctx, db } as unknown as AuthedContext;
}

async function recordListSyncEvent(
  tx: KarakeepDBTransaction,
  userIds: string[],
  listId: string,
  operation: "create" | "update" | "delete" | "revoke",
  changedFields: string[],
) {
  for (const userId of new Set(userIds)) {
    await recordOfflineSyncEvent(
      tx,
      userId,
      "list",
      listId,
      operation,
      changedFields,
    );
  }
}

async function listSyncUserIds(
  ctx: AuthedContext,
  listId: string,
  ownerId: string,
) {
  const collaborators = await ctx.db
    .select({ userId: listCollaborators.userId })
    .from(listCollaborators)
    .where(eq(listCollaborators.listId, listId));
  return [ownerId, ...collaborators.map((collaborator) => collaborator.userId)];
}

export const ensureListAtLeastViewer = experimental_trpcMiddleware<{
  ctx: AuthedContext;
  input: { listId: string };
}>().create(async (opts) => {
  // This would throw if the user can't view the list
  const list = await List.fromId(opts.ctx, opts.input.listId);
  return opts.next({
    ctx: {
      ...opts.ctx,
      list,
    },
  });
});

export const ensureListAtLeastEditor = experimental_trpcMiddleware<{
  ctx: AuthedContext & { list: List };
  input: { listId: string };
}>().create(async (opts) => {
  opts.ctx.list.ensureCanEdit();
  return opts.next({
    ctx: opts.ctx,
  });
});

export const ensureListAtLeastOwner = experimental_trpcMiddleware<{
  ctx: AuthedContext & { list: List };
  input: { listId: string };
}>().create(async (opts) => {
  opts.ctx.list.ensureCanManage();
  return opts.next({
    ctx: opts.ctx,
  });
});

export const ensureInvitationAccess = experimental_trpcMiddleware<{
  ctx: AuthedContext;
  input: { invitationId: string };
}>().create(async (opts) => {
  const invitation = await ListInvitation.fromId(
    opts.ctx,
    opts.input.invitationId,
  );
  return opts.next({
    ctx: {
      ...opts.ctx,
      invitation,
    },
  });
});

export const listsAppRouter = router({
  create: listsProcedure
    .use(createEventLogMiddleware("list.create"))
    .input(zNewBookmarkListSchema)
    .output(zBookmarkListSchema)
    .mutation(async ({ input, ctx }) => {
      const list = await ctx.db.transaction(async (tx) => {
        const transactionCtx = asTransactionContext(ctx, tx);
        const list = await List.create(transactionCtx, input);
        await recordListSyncEvent(tx, [ctx.user.id], list.id, "create", [
          "name",
          "description",
          "icon",
          "parentId",
          "query",
        ]);
        return list;
      });
      addLogFields<"list.create">({ "list.id": list.id });
      return list.asZBookmarkList();
    }),
  edit: listsProcedure
    .input(zEditBookmarkListSchemaWithValidation)
    .output(zBookmarkListSchema)
    .use(ensureListAtLeastViewer)
    .use(ensureListAtLeastOwner)
    .mutation(async ({ input, ctx }) => {
      const list = await ctx.db.transaction(async (tx) => {
        const transactionCtx = asTransactionContext(ctx, tx);
        const list = await List.fromId(transactionCtx, input.listId);
        await list.update(input);
        const serialized = list.asZBookmarkList();
        await recordListSyncEvent(
          tx,
          await listSyncUserIds(
            transactionCtx,
            serialized.id,
            serialized.userId,
          ),
          serialized.id,
          "update",
          [
            ...(input.name !== undefined ? ["name"] : []),
            ...(input.description !== undefined ? ["description"] : []),
            ...(input.icon !== undefined ? ["icon"] : []),
            ...(input.parentId !== undefined ? ["parentId"] : []),
            ...(input.query !== undefined ? ["query"] : []),
            ...(input.public !== undefined ? ["public"] : []),
          ],
        );
        return serialized;
      });
      if (input.public !== undefined) {
        logEvent({
          "event.name": "list.share",
          "user.id": ctx.user.id,
          "list.id": input.listId,
          "list.public": input.public,
        });
      }
      return list;
    }),
  merge: listsProcedure
    .input(zMergeListSchema)
    .mutation(async ({ input, ctx }) => {
      await ctx.db.transaction(async (tx) => {
        const transactionCtx = asTransactionContext(ctx, tx);
        const [sourceList, targetList] = await Promise.all([
          List.fromId(transactionCtx, input.sourceId),
          List.fromId(transactionCtx, input.targetId),
        ]);
        sourceList.ensureCanManage();
        targetList.ensureCanManage();
        const source = sourceList.asZBookmarkList();
        const target = targetList.asZBookmarkList();
        const [sourceUserIds, targetUserIds] = await Promise.all([
          listSyncUserIds(transactionCtx, source.id, source.userId),
          listSyncUserIds(transactionCtx, target.id, target.userId),
        ]);
        await sourceList.mergeInto(targetList, input.deleteSourceAfterMerge);
        await recordListSyncEvent(tx, targetUserIds, target.id, "update", [
          "bookmarks",
        ]);
        await recordListSyncEvent(
          tx,
          sourceUserIds,
          source.id,
          input.deleteSourceAfterMerge ? "delete" : "update",
          input.deleteSourceAfterMerge ? [] : ["bookmarks"],
        );
      });
    }),
  delete: listsProcedure
    .input(
      z.object({
        listId: z.string(),
        deleteChildren: z.boolean().optional().default(false),
      }),
    )
    .use(ensureListAtLeastViewer)
    .use(ensureListAtLeastOwner)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const transactionCtx = asTransactionContext(ctx, tx);
        const list = await List.fromId(transactionCtx, input.listId);
        const serialized = list.asZBookmarkList();
        const syncUserIds = await listSyncUserIds(
          transactionCtx,
          serialized.id,
          serialized.userId,
        );
        if (input.deleteChildren) {
          const children = await list.getChildren();
          for (const child of children) {
            const childList = child.asZBookmarkList();
            const childUserIds = await listSyncUserIds(
              transactionCtx,
              childList.id,
              childList.userId,
            );
            await child.delete();
            await recordListSyncEvent(
              tx,
              childUserIds,
              childList.id,
              "delete",
              [],
            );
          }
        }
        await list.delete();
        await recordListSyncEvent(tx, syncUserIds, serialized.id, "delete", []);
      });
    }),
  addToList: listsProcedure
    .input(
      z.object({
        listId: z.string(),
        bookmarkId: z.string(),
      }),
    )
    .use(ensureListAtLeastViewer)
    .use(ensureListAtLeastEditor)
    .use(ensureBookmarkOwnership)
    .mutation(async ({ input, ctx }) => {
      await ctx.db.transaction(async (tx) => {
        const transactionCtx = asTransactionContext(ctx, tx);
        const list = await List.fromId(transactionCtx, input.listId);
        await list.addBookmark(input.bookmarkId);
        const serialized = list.asZBookmarkList();
        await recordListSyncEvent(
          tx,
          await listSyncUserIds(
            transactionCtx,
            serialized.id,
            serialized.userId,
          ),
          serialized.id,
          "update",
          ["bookmarks"],
        );
      });
    }),
  removeFromList: listsProcedure
    .input(
      z.object({
        listId: z.string(),
        bookmarkId: z.string(),
      }),
    )
    .use(ensureListAtLeastViewer)
    .use(ensureListAtLeastEditor)
    .mutation(async ({ input, ctx }) => {
      await ctx.db.transaction(async (tx) => {
        const transactionCtx = asTransactionContext(ctx, tx);
        const list = await List.fromId(transactionCtx, input.listId);
        await list.removeBookmark(input.bookmarkId);
        const serialized = list.asZBookmarkList();
        await recordListSyncEvent(
          tx,
          await listSyncUserIds(
            transactionCtx,
            serialized.id,
            serialized.userId,
          ),
          serialized.id,
          "update",
          ["bookmarks"],
        );
      });
    }),
  get: listsProcedure
    .input(
      z.object({
        listId: z.string(),
      }),
    )
    .output(zBookmarkListSchema)
    .use(ensureListAtLeastViewer)
    .query(async ({ ctx }) => {
      return ctx.list.asZBookmarkList();
    }),
  list: listsProcedure
    .output(
      z.object({
        lists: z.array(zBookmarkListSchema),
      }),
    )
    .query(async ({ ctx }) => {
      const results = await List.getAll(ctx);
      return { lists: results.map((l) => l.asZBookmarkList()) };
    }),
  getListsOfBookmark: listsProcedure
    .input(z.object({ bookmarkId: z.string() }))
    .output(
      z.object({
        lists: z.array(zBookmarkListSchema),
      }),
    )
    .use(ensureBookmarkOwnership)
    .query(async ({ input, ctx }) => {
      const lists = await List.forBookmark(ctx, input.bookmarkId);
      return { lists: lists.map((l) => l.asZBookmarkList()) };
    }),
  stats: listsProcedure
    .output(
      z.object({
        stats: z.map(z.string(), z.number()),
      }),
    )
    .query(async ({ ctx }) => {
      const lists = await List.getAll(ctx);
      const sizes = await Promise.all(lists.map((l) => l.getSize()));
      return { stats: new Map(lists.map((l, i) => [l.id, sizes[i]])) };
    }),

  // Rss endpoints
  regenRssToken: listsProcedure
    .input(
      z.object({
        listId: z.string(),
      }),
    )
    .output(
      z.object({
        token: z.string(),
      }),
    )
    .use(ensureListAtLeastViewer)
    .use(ensureListAtLeastOwner)
    .mutation(async ({ ctx }) => {
      const token = await ctx.list.regenRssToken();
      return { token: token! };
    }),
  clearRssToken: listsProcedure
    .input(
      z.object({
        listId: z.string(),
      }),
    )
    .use(ensureListAtLeastViewer)
    .use(ensureListAtLeastOwner)
    .mutation(async ({ ctx }) => {
      await ctx.list.clearRssToken();
    }),
  getRssToken: listsProcedure
    .input(
      z.object({
        listId: z.string(),
      }),
    )
    .output(
      z.object({
        token: z.string().nullable(),
      }),
    )
    .use(ensureListAtLeastViewer)
    .use(ensureListAtLeastOwner)
    .query(async ({ ctx }) => {
      return { token: await ctx.list.getRssToken() };
    }),

  // Collaboration endpoints
  addCollaborator: listsProcedure
    .input(
      z.object({
        listId: z.string(),
        email: z.string().email(),
        role: z.enum(["viewer", "editor"]),
      }),
    )
    .output(
      z.object({
        invitationId: z.string(),
      }),
    )
    .use(
      createRateLimitMiddleware({
        name: "lists.addCollaborator",
        windowMs: 15 * 60 * 1000,
        maxRequests: 20,
      }),
    )
    .use(ensureListAtLeastViewer)
    .use(ensureListAtLeastOwner)
    .mutation(async ({ input, ctx }) => {
      const invitationId = await ctx.db.transaction(async (tx) => {
        const transactionCtx = asTransactionContext(ctx, tx);
        const list = await List.fromId(transactionCtx, input.listId);
        const invitationId = await list.addCollaboratorByEmail(
          input.email,
          input.role,
        );
        await recordListSyncEvent(tx, [ctx.user.id], list.id, "update", [
          "collaborators",
        ]);
        return invitationId;
      });
      return { invitationId };
    }),
  removeCollaborator: listsProcedure
    .input(
      z.object({
        listId: z.string(),
        userId: z.string(),
      }),
    )
    .use(ensureListAtLeastViewer)
    .use(ensureListAtLeastOwner)
    .mutation(async ({ input, ctx }) => {
      await ctx.db.transaction(async (tx) => {
        const transactionCtx = asTransactionContext(ctx, tx);
        const list = await List.fromId(transactionCtx, input.listId);
        const serialized = list.asZBookmarkList();
        const syncUserIds = await listSyncUserIds(
          transactionCtx,
          serialized.id,
          serialized.userId,
        );
        await list.removeCollaborator(input.userId);
        await recordListSyncEvent(
          tx,
          syncUserIds.filter((userId) => userId !== input.userId),
          serialized.id,
          "update",
          ["collaborators"],
        );
        await recordListSyncEvent(
          tx,
          [input.userId],
          serialized.id,
          "revoke",
          [],
        );
      });
    }),
  updateCollaboratorRole: listsProcedure
    .input(
      z.object({
        listId: z.string(),
        userId: z.string(),
        role: z.enum(["viewer", "editor"]),
      }),
    )
    .use(ensureListAtLeastViewer)
    .use(ensureListAtLeastOwner)
    .mutation(async ({ input, ctx }) => {
      await ctx.db.transaction(async (tx) => {
        const transactionCtx = asTransactionContext(ctx, tx);
        const list = await List.fromId(transactionCtx, input.listId);
        await list.updateCollaboratorRole(input.userId, input.role);
        const serialized = list.asZBookmarkList();
        await recordListSyncEvent(
          tx,
          await listSyncUserIds(
            transactionCtx,
            serialized.id,
            serialized.userId,
          ),
          serialized.id,
          "update",
          ["collaborators"],
        );
      });
    }),
  getCollaborators: listsProcedure
    .input(
      z.object({
        listId: z.string(),
      }),
    )
    .output(
      z.object({
        collaborators: z.array(
          z.object({
            id: z.string(),
            userId: z.string(),
            role: z.enum(["viewer", "editor"]),
            status: z.enum(["pending", "accepted", "declined"]),
            addedAt: z.date(),
            invitedAt: z.date(),
            user: z.object({
              id: z.string(),
              name: z.string(),
              email: z.string().nullable(),
              image: z.string().nullable(),
            }),
          }),
        ),
        owner: z
          .object({
            id: z.string(),
            name: z.string(),
            email: z.string().nullable(),
            image: z.string().nullable(),
          })
          .nullable(),
      }),
    )
    .use(ensureListAtLeastViewer)
    .query(async ({ ctx }) => {
      return await ctx.list.getCollaborators();
    }),

  acceptInvitation: listsProcedure
    .input(
      z.object({
        invitationId: z.string(),
      }),
    )
    .use(ensureInvitationAccess)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const transactionCtx = asTransactionContext(ctx, tx);
        const invitation = await ListInvitation.fromId(
          transactionCtx,
          input.invitationId,
        );
        const [invitationData] = await tx
          .select({
            listId: listInvitations.listId,
            listOwnerUserId: bookmarkLists.userId,
          })
          .from(listInvitations)
          .innerJoin(
            bookmarkLists,
            eq(bookmarkLists.id, listInvitations.listId),
          )
          .where(eq(listInvitations.id, invitation.id));
        await invitation.accept();
        if (invitationData) {
          await recordListSyncEvent(
            tx,
            [ctx.user.id, invitationData.listOwnerUserId],
            invitationData.listId,
            "create",
            ["collaborators"],
          );
        }
      });
    }),

  declineInvitation: listsProcedure
    .input(
      z.object({
        invitationId: z.string(),
      }),
    )
    .use(ensureInvitationAccess)
    .mutation(async ({ ctx }) => {
      await ctx.invitation.decline();
    }),

  revokeInvitation: listsProcedure
    .input(
      z.object({
        invitationId: z.string(),
      }),
    )
    .use(ensureInvitationAccess)
    .mutation(async ({ ctx }) => {
      await ctx.invitation.revoke();
    }),

  getPendingInvitations: listsProcedure
    .output(
      z.array(
        z.object({
          id: z.string(),
          listId: z.string(),
          role: z.enum(["viewer", "editor"]),
          invitedAt: z.date(),
          list: z.object({
            id: z.string(),
            name: z.string(),
            icon: z.string(),
            description: z.string().nullable(),
            owner: z
              .object({
                id: z.string(),
                name: z.string(),
                email: z.string(),
              })
              .nullable(),
          }),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      return ListInvitation.pendingForUser(ctx);
    }),

  leaveList: listsProcedure
    .input(
      z.object({
        listId: z.string(),
      }),
    )
    .use(ensureListAtLeastViewer)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const transactionCtx = asTransactionContext(ctx, tx);
        const list = await List.fromId(transactionCtx, input.listId);
        const serialized = list.asZBookmarkList();
        await list.leaveList();
        await recordListSyncEvent(
          tx,
          [ctx.user.id],
          serialized.id,
          "revoke",
          [],
        );
      });
    }),
});
