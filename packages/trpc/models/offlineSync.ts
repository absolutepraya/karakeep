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
import { List } from "./lists";

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

async function applyBookmarkTags(
  tx: KarakeepDBTransaction,
  userId: string,
  mutation: Extract<ZOfflineSyncMutation, { kind: "bookmark.tags" }>,
): Promise<void> {
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

  await tx
    .delete(tagsOnBookmarks)
    .where(eq(tagsOnBookmarks.bookmarkId, mutation.bookmarkId));
  if (tagIds.length > 0) {
    await tx.insert(tagsOnBookmarks).values(
      tagIds.map((tagId) => ({
        bookmarkId: mutation.bookmarkId,
        tagId,
        attachedBy: "human" as const,
      })),
    );
  }
  await tx
    .update(bookmarks)
    .set({ modifiedAt: new Date() })
    .where(eq(bookmarks.id, mutation.bookmarkId));
}

export async function recordOfflineSyncEvent(
  tx: KarakeepDBTransaction,
  userId: string,
  entityType: ZOfflineSyncEntityType,
  entityId: string,
  operation: ZOfflineSyncOperation,
  changedFields: string[],
): Promise<number> {
  if (entityType === "bookmark" && operation === "update") {
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
    const bookmarkRows = await Promise.all(
      [...bookmarkIds].map(async (bookmarkId) =>
        (await Bookmark.fromId(transactionContext, bookmarkId, false)).asZBookmark(),
      ),
    );

    return {
      bookmarks: bookmarkRows,
      lists: lists.map((list) => list.asZBookmarkList()),
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
  try {
    return await ctx.db.transaction(
      async (tx) => {
        const acknowledged: string[] = [];
        const conflicts: ZOfflineSyncConflict[] = [];

        for (const mutation of mutations) {
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
          if (receipt) {
            const replay = receipt.result as ZOfflineSyncPushResult;
            if (mutations.length === 1) {
              return replay;
            }
            acknowledged.push(...replay.acknowledged);
            conflicts.push(...replay.conflicts);
            continue;
          }

          await assertBookmarkOwner(tx, ctx.user.id, mutation.bookmarkId);
          const changedFields =
            mutation.kind === "bookmark.update"
              ? Object.keys(mutation.fields)
              : ["tags"];
          const mutationConflicts: ZOfflineSyncConflict[] = [];
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
              mutationConflicts.push({
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

          let mutationResult: ZOfflineSyncPushResult;
          if (mutationConflicts.length > 0) {
            mutationResult = {
              acknowledged: [],
              conflicts: mutationConflicts,
              cursor: await currentCursor(tx, ctx.user.id),
            };
            conflicts.push(...mutationConflicts);
          } else {
            if (mutation.kind === "bookmark.update") {
              await applyBookmarkUpdate(tx, mutation);
            } else {
              await applyBookmarkTags(tx, ctx.user.id, mutation);
            }
            const sequence = await recordOfflineSyncEvent(
              tx,
              ctx.user.id,
              "bookmark",
              mutation.bookmarkId,
              "update",
              changedFields,
            );
            mutationResult = {
              acknowledged: [mutation.idempotencyKey],
              conflicts: [],
              cursor: cursorForSequence(sequence),
            };
            acknowledged.push(mutation.idempotencyKey);
          }

          await tx.insert(offlineSyncMutationReceipts).values({
            userId: ctx.user.id,
            idempotencyKey: mutation.idempotencyKey,
            result: mutationResult,
            createdAt: new Date(),
          });
        }

        return {
          acknowledged,
          conflicts,
          cursor: await currentCursor(tx, ctx.user.id),
        };
      },
      { behavior: "immediate" },
    );
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to apply offline sync mutations",
      cause: error,
    });
  }
}
