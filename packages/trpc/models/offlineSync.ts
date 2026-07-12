import { TRPCError } from "@trpc/server";
import { and, asc, eq, gt, inArray, max } from "drizzle-orm";

import type { KarakeepDBTransaction } from "@karakeep/db";
import {
  bookmarkLinks,
  bookmarks,
  bookmarksInLists,
  bookmarkTexts,
  bookmarkTags,
  listCollaborators,
  offlineSyncEvents,
  offlineSyncFieldVersions,
  offlineSyncMutationReceipts,
  tagsOnBookmarks,
} from "@karakeep/db/schema";
import { triggerSearchReindex } from "@karakeep/shared-server";
import type {
  ZOfflineSyncConflict,
  ZOfflineSyncEntityType,
  ZOfflineSyncMutation,
  ZOfflineSyncOperation,
  ZOfflineSyncPullResult,
  ZOfflineSyncPushResult,
  ZOfflineSyncSnapshot,
} from "@karakeep/shared/types/offlineSync";

import type { AuthedContext } from "../index";
import { Bookmark } from "./bookmarks";
import { RuleEngine } from "../lib/ruleEngine";
import { List } from "./lists";

import { WebhooksService } from "./webhooks.service";
const bookmarkFieldNames = new Set([
  "title",
  "archived",
  "favourited",
  "note",
  "summary",
  "url",
  "description",
  "author",
  "publisher",
  "text",
  "tags",
]);

function asTransactionContext(
  ctx: AuthedContext,
  db: KarakeepDBTransaction,
): AuthedContext {
  return { ...ctx, db } as unknown as AuthedContext;
}

function cursorForSequence(sequence: number | null | undefined): string {
  return String(sequence ?? 0);
}

async function currentCursor(
  tx: KarakeepDBTransaction,
  userId: string,
): Promise<string> {
  const [result] = await tx
    .select({ sequence: max(offlineSyncEvents.sequence) })
    .from(offlineSyncEvents)
    .where(eq(offlineSyncEvents.userId, userId));
  return cursorForSequence(result?.sequence);
}

async function getBookmarkFieldValue(
  tx: KarakeepDBTransaction,
  bookmarkId: string,
  field: string,
): Promise<unknown> {
  switch (field) {
    case "title":
    case "archived":
    case "favourited":
    case "note":
    case "summary": {
      const [bookmark] = await tx
        .select({
          title: bookmarks.title,
          archived: bookmarks.archived,
          favourited: bookmarks.favourited,
          note: bookmarks.note,
          summary: bookmarks.summary,
        })
        .from(bookmarks)
        .where(eq(bookmarks.id, bookmarkId));
      return bookmark?.[field];
    }
    case "url":
    case "description":
    case "author":
    case "publisher": {
      const [link] = await tx
        .select({
          url: bookmarkLinks.url,
          description: bookmarkLinks.description,
          author: bookmarkLinks.author,
          publisher: bookmarkLinks.publisher,
        })
        .from(bookmarkLinks)
        .where(eq(bookmarkLinks.id, bookmarkId));
      return link?.[field];
    }
    case "text": {
      const [text] = await tx
        .select({ text: bookmarkTexts.text })
        .from(bookmarkTexts)
        .where(eq(bookmarkTexts.id, bookmarkId));
      return text?.text;
    }
    case "tags": {
      const tags = await tx
        .select({ id: bookmarkTags.id })
        .from(tagsOnBookmarks)
        .innerJoin(bookmarkTags, eq(bookmarkTags.id, tagsOnBookmarks.tagId))
        .where(eq(tagsOnBookmarks.bookmarkId, bookmarkId));
      return tags.map((tag) => tag.id).sort();
    }
    default:
      return undefined;
  }
}

async function assertBookmarkOwner(
  tx: KarakeepDBTransaction,
  userId: string,
  bookmarkId: string,
): Promise<void> {
  const [bookmark] = await tx
    .select({ userId: bookmarks.userId })
    .from(bookmarks)
    .where(eq(bookmarks.id, bookmarkId));

  if (!bookmark) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Bookmark not found" });
  }
  if (bookmark.userId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User is not allowed to modify this bookmark",
    });
  }
}

async function applyBookmarkUpdate(
  tx: KarakeepDBTransaction,
  mutation: Extract<ZOfflineSyncMutation, { kind: "bookmark.update" }>,
): Promise<void> {
  const { bookmarkId, fields } = mutation;
  const commonUpdates: {
    title?: string | null;
    archived?: boolean;
    favourited?: boolean;
    note?: string;
    summary?: string | null;
    modifiedAt: Date;
  } = { modifiedAt: new Date() };
  let hasCommonUpdate = false;

  if (fields.title !== undefined) {
    commonUpdates.title = fields.title;
    hasCommonUpdate = true;
  }
  if (fields.archived !== undefined) {
    commonUpdates.archived = fields.archived;
    hasCommonUpdate = true;
  }
  if (fields.favourited !== undefined) {
    commonUpdates.favourited = fields.favourited;
    hasCommonUpdate = true;
  }
  if (fields.note !== undefined) {
    commonUpdates.note = fields.note;
    hasCommonUpdate = true;
  }
  if (fields.summary !== undefined) {
    commonUpdates.summary = fields.summary;
    hasCommonUpdate = true;
  }

  if (hasCommonUpdate) {
    await tx
      .update(bookmarks)
      .set(commonUpdates)
      .where(eq(bookmarks.id, bookmarkId));
  }

  const linkUpdates: {
    url?: string;
    description?: string | null;
    author?: string | null;
    publisher?: string | null;
  } = {};
  if (fields.url !== undefined) linkUpdates.url = fields.url.trim();
  if (fields.description !== undefined) linkUpdates.description = fields.description;
  if (fields.author !== undefined) linkUpdates.author = fields.author;
  if (fields.publisher !== undefined) linkUpdates.publisher = fields.publisher;

  if (Object.keys(linkUpdates).length > 0) {
    const result = await tx
      .update(bookmarkLinks)
      .set(linkUpdates)
      .where(eq(bookmarkLinks.id, bookmarkId));
    if (result.changes === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot update link fields on a non-link bookmark",
      });
    }
    if (!hasCommonUpdate) {
      await tx
        .update(bookmarks)
        .set({ modifiedAt: new Date() })
        .where(eq(bookmarks.id, bookmarkId));
    }
  }

  if (fields.text !== undefined) {
    const result = await tx
      .update(bookmarkTexts)
      .set({ text: fields.text })
      .where(eq(bookmarkTexts.id, bookmarkId));
    if (result.changes === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot update text on a non-text bookmark",
      });
    }
    if (!hasCommonUpdate && Object.keys(linkUpdates).length === 0) {
      await tx
        .update(bookmarks)
        .set({ modifiedAt: new Date() })
        .where(eq(bookmarks.id, bookmarkId));
    }
  }
}

type BookmarkTagDelta = {
  attached: string[];
  detached: string[];
};

async function applyBookmarkTags(
  tx: KarakeepDBTransaction,
  userId: string,
  mutation: Extract<ZOfflineSyncMutation, { kind: "bookmark.tags" }>,
): Promise<BookmarkTagDelta> {
  const tagIds = [...new Set(mutation.tagIds)];
  if (tagIds.length > 0) {
    const ownedTags = await tx
      .select({ id: bookmarkTags.id })
      .from(bookmarkTags)
      .where(
        and(
          eq(bookmarkTags.userId, userId),
          inArray(bookmarkTags.id, tagIds),
        ),
      );
    if (ownedTags.length !== tagIds.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot attach tags owned by another user",
      });
    }
  }

  const currentTags = await tx
    .select({ tagId: tagsOnBookmarks.tagId })
    .from(tagsOnBookmarks)
    .where(eq(tagsOnBookmarks.bookmarkId, mutation.bookmarkId));
  const currentTagIds = new Set(currentTags.map(({ tagId }) => tagId));
  const requestedTagIds = new Set(tagIds);
  const detached = currentTags
    .map(({ tagId }) => tagId)
    .filter((tagId) => !requestedTagIds.has(tagId));
  const attached = tagIds.filter((tagId) => !currentTagIds.has(tagId));

  if (detached.length > 0) {
    await tx
      .delete(tagsOnBookmarks)
      .where(
        and(
          eq(tagsOnBookmarks.bookmarkId, mutation.bookmarkId),
          inArray(tagsOnBookmarks.tagId, detached),
        ),
      );
  }
  if (attached.length > 0) {
    await tx.insert(tagsOnBookmarks).values(
      attached.map((tagId) => ({
        bookmarkId: mutation.bookmarkId,
        tagId,
        attachedBy: "human" as const,
      })),
    );
  }
  if (attached.length > 0 || detached.length > 0) {
    await tx
      .update(bookmarks)
      .set({ modifiedAt: new Date() })
      .where(eq(bookmarks.id, mutation.bookmarkId));
  }

  return { attached, detached };
}

async function triggerBookmarkUpdateEffects(
  ctx: AuthedContext,
  mutation: ZOfflineSyncMutation,
  tagDelta: BookmarkTagDelta | undefined,
): Promise<void> {
  const bookmark = (
    await Bookmark.fromId(ctx, mutation.bookmarkId, false)
  ).asZBookmark();

  const ruleEvents =
    mutation.kind === "bookmark.tags"
      ? [
          ...(tagDelta?.detached.map((tagId) => ({
            type: "tagRemoved" as const,
            tagId,
          })) ?? []),
          ...(tagDelta?.attached.map((tagId) => ({
            type: "tagAdded" as const,
            tagId,
          })) ?? []),
        ]
      : [
          ...(mutation.fields.favourited === true
            ? [{ type: "favourited" as const }]
            : []),
          ...(mutation.fields.archived === true
            ? [{ type: "archived" as const }]
            : []),
        ];

  await Promise.all([
    ruleEvents.length > 0
      ? RuleEngine.triggerOnEvent(
          bookmark.userId,
          mutation.bookmarkId,
          ruleEvents,
          undefined,
          ctx.db,
        )
      : Promise.resolve(),
    triggerSearchReindex(mutation.bookmarkId, { groupId: ctx.user.id }),
    new WebhooksService(ctx.db).triggerWebhook(
      mutation.bookmarkId,
      "edited",
      bookmark.userId,
      { groupId: ctx.user.id },
    ),
  ]);
}

async function advanceOfflineSyncFieldVersions(
  tx: KarakeepDBTransaction,
  entityType: ZOfflineSyncEntityType,
  entityId: string,
  operation: ZOfflineSyncOperation,
  changedFields: string[],
): Promise<void> {
  if (entityType !== "bookmark" || operation !== "update") return;

  for (const field of changedFields) {
    if (!bookmarkFieldNames.has(field)) continue;
    const [existing] = await tx
      .select({ version: offlineSyncFieldVersions.version })
      .from(offlineSyncFieldVersions)
      .where(
        and(
          eq(offlineSyncFieldVersions.bookmarkId, entityId),
          eq(offlineSyncFieldVersions.field, field),
        ),
      );
    const version = (existing?.version ?? 0) + 1;
    await tx
      .insert(offlineSyncFieldVersions)
      .values({ bookmarkId: entityId, field, version })
      .onConflictDoUpdate({
        target: [
          offlineSyncFieldVersions.bookmarkId,
          offlineSyncFieldVersions.field,
        ],
        set: { version },
      });
  }
}

export async function recordOfflineSyncEvent(
  tx: KarakeepDBTransaction,
  userId: string,
  entityType: ZOfflineSyncEntityType,
  entityId: string,
  operation: ZOfflineSyncOperation,
  changedFields: string[],
): Promise<number> {
  const [event] = await tx
    .insert(offlineSyncEvents)
    .values({
      userId,
      entityType,
      entityId,
      operation,
      changedFields,
      createdAt: new Date(),
    })
    .returning({ sequence: offlineSyncEvents.sequence });
  return event.sequence;
}

export async function getOfflineSyncBookmarkRecipientIds(
  tx: KarakeepDBTransaction,
  ownerId: string,
  bookmarkId: string,
): Promise<string[]> {
  const collaborators = await tx
    .select({ userId: listCollaborators.userId })
    .from(bookmarksInLists)
    .innerJoin(
      listCollaborators,
      eq(listCollaborators.listId, bookmarksInLists.listId),
    )
    .where(eq(bookmarksInLists.bookmarkId, bookmarkId));

  return [...new Set([ownerId, ...collaborators.map(({ userId }) => userId)])];
}

export async function recordOfflineSyncEvents(
  tx: KarakeepDBTransaction,
  ownerId: string,
  recipientIds: string[],
  entityType: ZOfflineSyncEntityType,
  entityId: string,
  operation: ZOfflineSyncOperation,
  changedFields: string[],
): Promise<number[]> {
  await advanceOfflineSyncFieldVersions(
    tx,
    entityType,
    entityId,
    operation,
    changedFields,
  );

  const sequences: number[] = [];
  for (const userId of new Set([ownerId, ...recipientIds])) {
    sequences.push(
      await recordOfflineSyncEvent(
        tx,
        userId,
        entityType,
        entityId,
        operation,
        changedFields,
      ),
    );
  }
  return sequences;
}

export async function buildOfflineSyncSnapshot(
  ctx: AuthedContext,
): Promise<ZOfflineSyncSnapshot> {
  return await ctx.db.transaction(async (tx) => {
    const transactionContext = asTransactionContext(ctx, tx);
    const [ownedBookmarks, sharedBookmarks, lists] = await Promise.all([
      tx
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(eq(bookmarks.userId, ctx.user.id)),
      tx
        .select({ id: bookmarksInLists.bookmarkId })
        .from(bookmarksInLists)
        .innerJoin(
          listCollaborators,
          eq(listCollaborators.listId, bookmarksInLists.listId),
        )
        .where(eq(listCollaborators.userId, ctx.user.id)),
      List.getAll(transactionContext),
    ]);
    const bookmarkIds = new Set([
      ...ownedBookmarks.map((bookmark) => bookmark.id),
      ...sharedBookmarks.map((bookmark) => bookmark.id),
    ]);
    const snapshotLists = lists.map((list) => list.asZBookmarkList());
    const listIds = snapshotLists.map((list) => list.id);
    const bookmarkRows = await Promise.all(
      [...bookmarkIds].map(async (bookmarkId) =>
        (await Bookmark.fromId(transactionContext, bookmarkId, false)).asZBookmark(),
      ),
    );
    const bookmarkListMemberships =
      bookmarkIds.size === 0 || listIds.length === 0
        ? []
        : await tx
            .select({
              bookmarkId: bookmarksInLists.bookmarkId,
              listId: bookmarksInLists.listId,
            })
            .from(bookmarksInLists)
            .where(
              and(
                inArray(bookmarksInLists.bookmarkId, [...bookmarkIds]),
                inArray(bookmarksInLists.listId, listIds),
              ),
            );

    return {
      bookmarks: bookmarkRows,
      lists: snapshotLists,
      bookmarkListMemberships,
      cursor: await currentCursor(tx, ctx.user.id),
    };
  });
}

export async function pullOfflineSyncEvents(
  ctx: AuthedContext,
  cursor: string,
): Promise<ZOfflineSyncPullResult> {
  const sequence = Number(cursor);
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid sync cursor" });
  }

  return await ctx.db.transaction(async (tx) => {
    const events = await tx
      .select()
      .from(offlineSyncEvents)
      .where(
        and(
          eq(offlineSyncEvents.userId, ctx.user.id),
          gt(offlineSyncEvents.sequence, sequence),
        ),
      )
      .orderBy(asc(offlineSyncEvents.sequence));
    return {
      events: events.map((event) => ({
        ...event,
        entityType: event.entityType as ZOfflineSyncEntityType,
        operation: event.operation as ZOfflineSyncOperation,
      })),
      cursor: await currentCursor(tx, ctx.user.id),
    };
  });
}

export async function applyOfflineSyncMutations(
  ctx: AuthedContext,
  mutations: ZOfflineSyncMutation[],
): Promise<ZOfflineSyncPushResult> {
  if (mutations.length !== 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Offline sync pushes require exactly one mutation",
    });
  }

  let appliedMutation: ZOfflineSyncMutation | undefined;
  let appliedTagDelta: BookmarkTagDelta | undefined;
  try {
    const result = await ctx.db.transaction(
      async (tx) => {
        const mutation = mutations[0];
        const [receipt] = await tx
          .select({ result: offlineSyncMutationReceipts.result })
          .from(offlineSyncMutationReceipts)
          .where(
            and(
              eq(offlineSyncMutationReceipts.userId, ctx.user.id),
              eq(
                offlineSyncMutationReceipts.idempotencyKey,
                mutation.idempotencyKey,
              ),
            ),
          );
        if (receipt) return receipt.result as ZOfflineSyncPushResult;

        await assertBookmarkOwner(tx, ctx.user.id, mutation.bookmarkId);
        const changedFields =
          mutation.kind === "bookmark.update"
            ? Object.keys(mutation.fields)
            : ["tags"];
        const conflicts: ZOfflineSyncConflict[] = [];
        const baseVersions = mutation.baseVersions as Record<string, number>;
        for (const field of changedFields) {
          const [version] = await tx
            .select({ version: offlineSyncFieldVersions.version })
            .from(offlineSyncFieldVersions)
            .where(
              and(
                eq(offlineSyncFieldVersions.bookmarkId, mutation.bookmarkId),
                eq(offlineSyncFieldVersions.field, field),
              ),
            );
          const serverVersion = version?.version ?? 0;
          if (baseVersions[field] !== serverVersion) {
            conflicts.push({
              bookmarkId: mutation.bookmarkId,
              field,
              localValue:
                mutation.kind === "bookmark.update"
                  ? mutation.fields[field as keyof typeof mutation.fields]
                  : mutation.tagIds,
              serverValue: await getBookmarkFieldValue(
                tx,
                mutation.bookmarkId,
                field,
              ),
              serverVersion,
            });
          }
        }

        if (conflicts.length > 0) {
          const result = {
            acknowledged: [],
            conflicts,
            cursor: await currentCursor(tx, ctx.user.id),
          };
          await tx.insert(offlineSyncMutationReceipts).values({
            userId: ctx.user.id,
            idempotencyKey: mutation.idempotencyKey,
            result,
            createdAt: new Date(),
          });
          return result;
        }

        if (mutation.kind === "bookmark.update") {
          await applyBookmarkUpdate(tx, mutation);
        } else {
          appliedTagDelta = await applyBookmarkTags(tx, ctx.user.id, mutation);
        }
        const [sequence] = await recordOfflineSyncEvents(
          tx,
          ctx.user.id,
          await getOfflineSyncBookmarkRecipientIds(
            tx,
            ctx.user.id,
            mutation.bookmarkId,
          ),
          "bookmark",
          mutation.bookmarkId,
          "update",
          changedFields,
        );
        const result = {
          acknowledged: [mutation.idempotencyKey],
          conflicts: [],
          cursor: cursorForSequence(sequence),
        };
        await tx.insert(offlineSyncMutationReceipts).values({
          userId: ctx.user.id,
          idempotencyKey: mutation.idempotencyKey,
          result,
          createdAt: new Date(),
        });
        appliedMutation = mutation;
        return result;
      },
      { behavior: "immediate" },
    );
    if (appliedMutation) {
      await triggerBookmarkUpdateEffects(
        ctx,
        appliedMutation,
        appliedTagDelta,
      );
    }
    return result;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to apply offline sync mutations",
      cause: error,
    });
  }
}
