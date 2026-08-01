import { DEFAULT_NUM_BOOKMARKS_PER_PAGE } from "@karakeep/shared/types/bookmarks";
import type { ZBookmark, ZSortOrder } from "@karakeep/shared/types/bookmarks";
import type { ZCursor } from "@karakeep/shared/types/pagination";
import { zOfflineSyncMutationSchema } from "@karakeep/shared/types/offlineSync";
import type {
  ZOfflineSyncConflict,
  ZOfflineSyncCursor,
  ZOfflineSyncEvent,
  ZOfflineSyncMutation,
  ZOfflineSyncRejection,
  ZOfflineSyncSnapshot,
} from "@karakeep/shared/types/offlineSync";

import { offlineLibraryDb } from "./schema";

const SYNC_CURSOR_KEY = "syncCursor";
const REPLICA_STATE_KEY = "replicaState";
const REPLICA_OWNER_USER_ID_KEY = "replicaOwnerUserId";
const LAST_SUCCESSFUL_SYNC_AT_KEY = "lastSuccessfulSyncAt";
const LEGACY_THUMBNAIL_CACHE_NAME = "karakeep-thumbnails";
const THUMBNAIL_CACHE_PREFIX = `${LEGACY_THUMBNAIL_CACHE_NAME}:`;

interface OfflineBookmarkQuery {
  archived?: boolean;
  favourited?: boolean;
  tagId?: string;
  listId?: string;
  rssFeedId?: string;
  sortOrder?: Exclude<ZSortOrder, "relevance">;
  cursor?: ZCursor | null;
  limit?: number;
}

interface OfflineBookmarkPage {
  bookmarks: ZBookmark[];
  cursor: ZOfflineSyncCursor | null;
  nextCursor: ZCursor | null;
}

type StoredConflict = ZOfflineSyncConflict & { id: string };

export { offlineLibraryDb };
export type { OfflineBookmarkPage, OfflineBookmarkQuery };

export async function replaceSnapshot(
  snapshot: ZOfflineSyncSnapshot,
  ownerUserId: string,
): Promise<void> {
  await offlineLibraryDb.transaction(
    "rw",
    [
      offlineLibraryDb.bookmarks,
      offlineLibraryDb.lists,
      offlineLibraryDb.bookmarkListMemberships,
      offlineLibraryDb.bookmarkRssFeedMemberships,
      offlineLibraryDb.bookmarkFieldVersions,
      offlineLibraryDb.tombstones,
      offlineLibraryDb.metadata,
    ],
    async () => {
      await Promise.all([
        offlineLibraryDb.bookmarks.clear(),
        offlineLibraryDb.lists.clear(),
        offlineLibraryDb.bookmarkListMemberships.clear(),
        offlineLibraryDb.bookmarkRssFeedMemberships.clear(),
        offlineLibraryDb.bookmarkFieldVersions.clear(),
        offlineLibraryDb.tombstones.clear(),
      ]);
      await Promise.all([
        offlineLibraryDb.bookmarks.bulkPut(snapshot.bookmarks),
        offlineLibraryDb.lists.bulkPut(snapshot.lists),
        offlineLibraryDb.bookmarkListMemberships.bulkPut(
          snapshot.bookmarkListMemberships,
        ),
        offlineLibraryDb.bookmarkRssFeedMemberships.bulkPut(
          snapshot.bookmarkRssFeedMemberships,
        ),
        offlineLibraryDb.bookmarkFieldVersions.bulkPut(
          snapshot.bookmarkFieldVersions,
        ),
        offlineLibraryDb.metadata.bulkPut([
          { key: SYNC_CURSOR_KEY, value: snapshot.cursor },
          { key: REPLICA_STATE_KEY, value: "ready" },
          { key: REPLICA_OWNER_USER_ID_KEY, value: ownerUserId },
        ]),
      ]);
    },
  );
}

export async function applyEvents(
  events: ZOfflineSyncEvent[],
  cursor: ZOfflineSyncCursor,
): Promise<void> {
  if (
    events.some(
      (event) => event.entityType === "list" && event.operation === "revoke",
    )
  ) {
    await purgeOfflineLibrary();
    return;
  }

  await offlineLibraryDb.transaction(
    "rw",
    [
      offlineLibraryDb.bookmarks,
      offlineLibraryDb.lists,
      offlineLibraryDb.bookmarkListMemberships,
      offlineLibraryDb.bookmarkRssFeedMemberships,
      offlineLibraryDb.bookmarkFieldVersions,
      offlineLibraryDb.tombstones,
      offlineLibraryDb.metadata,
    ],
    async () => {
      const replicaState =
        await offlineLibraryDb.metadata.get(REPLICA_STATE_KEY);
      const hasUnmaterializedEvents = events.some(
        (event) => event.operation !== "delete" && event.operation !== "revoke",
      );

      for (const event of events) {
        if (event.operation === "delete" || event.operation === "revoke") {
          if (event.entityType === "bookmark") {
            await Promise.all([
              offlineLibraryDb.bookmarks.delete(event.entityId),
              offlineLibraryDb.bookmarkListMemberships
                .where("bookmarkId")
                .equals(event.entityId)
                .delete(),
              offlineLibraryDb.bookmarkRssFeedMemberships
                .where("bookmarkId")
                .equals(event.entityId)
                .delete(),
              offlineLibraryDb.bookmarkFieldVersions
                .where("bookmarkId")
                .equals(event.entityId)
                .delete(),
              offlineLibraryDb.tombstones
                .where("bookmarkId")
                .equals(event.entityId)
                .delete(),
            ]);
            continue;
          }

          await Promise.all([
            offlineLibraryDb.lists.delete(event.entityId),
            offlineLibraryDb.bookmarkListMemberships
              .where("listId")
              .equals(event.entityId)
              .delete(),
          ]);
          continue;
        }

        await offlineLibraryDb.bookmarkFieldVersions.bulkPut(
          event.fieldVersions,
        );
      }
      const nextReplicaState =
        replicaState?.value === "ready" && !hasUnmaterializedEvents
          ? "ready"
          : "stale";
      await offlineLibraryDb.metadata.put({
        key: REPLICA_STATE_KEY,
        value: nextReplicaState,
      });
      if (replicaState) {
        await offlineLibraryDb.metadata.put({
          key: SYNC_CURSOR_KEY,
          value: cursor,
        });
      }
    },
  );
}
export async function getBookmarkFieldVersion(
  bookmarkId: string,
  field: string,
): Promise<number | undefined> {
  return (await offlineLibraryDb.bookmarkFieldVersions.get([bookmarkId, field]))
    ?.version;
}

export async function queryBookmarks(
  query: OfflineBookmarkQuery = {},
): Promise<OfflineBookmarkPage> {
  const [bookmarks, listMemberships, rssFeedMemberships, tombstones, cursor] =
    await Promise.all([
      offlineLibraryDb.bookmarks.toArray(),
      offlineLibraryDb.bookmarkListMemberships.toArray(),
      offlineLibraryDb.bookmarkRssFeedMemberships.toArray(),
      offlineLibraryDb.tombstones.toArray(),
      offlineLibraryDb.metadata.get(SYNC_CURSOR_KEY),
    ]);
  const tombstonedBookmarkIds = new Set(
    tombstones.map((tombstone) => tombstone.bookmarkId),
  );
  const sortOrder = query.sortOrder ?? "desc";
  const limit = Math.max(1, query.limit ?? DEFAULT_NUM_BOOKMARKS_PER_PAGE);
  const bookmarkIdsInList =
    query.listId === undefined
      ? undefined
      : new Set(
          listMemberships
            .filter((membership) => membership.listId === query.listId)
            .map((membership) => membership.bookmarkId),
        );
  const bookmarkIdsInRssFeed =
    query.rssFeedId === undefined
      ? undefined
      : new Set(
          rssFeedMemberships
            .filter((membership) => membership.rssFeedId === query.rssFeedId)
            .map((membership) => membership.bookmarkId),
        );
  const filtered = bookmarks
    .filter((bookmark) => {
      if (tombstonedBookmarkIds.has(bookmark.id)) {
        return false;
      }
      if (
        query.archived !== undefined &&
        bookmark.archived !== query.archived
      ) {
        return false;
      }
      if (
        query.favourited !== undefined &&
        bookmark.favourited !== query.favourited
      ) {
        return false;
      }
      if (
        query.tagId !== undefined &&
        !bookmark.tags.some((tag) => tag.id === query.tagId)
      ) {
        return false;
      }
      if (
        bookmarkIdsInList !== undefined &&
        !bookmarkIdsInList.has(bookmark.id)
      ) {
        return false;
      }
      if (
        bookmarkIdsInRssFeed !== undefined &&
        !bookmarkIdsInRssFeed.has(bookmark.id)
      ) {
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      const createdAtDifference =
        left.createdAt.getTime() - right.createdAt.getTime();
      if (createdAtDifference !== 0) {
        return sortOrder === "asc" ? createdAtDifference : -createdAtDifference;
      }
      return right.id.localeCompare(left.id);
    });
  const pageStart = query.cursor
    ? filtered.findIndex(
        (bookmark) =>
          bookmark.id === query.cursor?.id &&
          bookmark.createdAt.getTime() === query.cursor.createdAt.getTime(),
      ) + 1
    : 0;
  const bookmarksInPage = filtered.slice(pageStart, pageStart + limit);
  const lastBookmark = bookmarksInPage.at(-1);

  return {
    bookmarks: bookmarksInPage,
    cursor: cursor?.value ?? null,
    nextCursor:
      lastBookmark && pageStart + limit < filtered.length
        ? { id: lastBookmark.id, createdAt: lastBookmark.createdAt }
        : null,
  };
}

export async function searchBookmarks(query: string): Promise<ZBookmark[]> {
  const tokens = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  const [bookmarks, lists, memberships, tombstones] = await Promise.all([
    offlineLibraryDb.bookmarks.toArray(),
    offlineLibraryDb.lists.toArray(),
    offlineLibraryDb.bookmarkListMemberships.toArray(),
    offlineLibraryDb.tombstones.toArray(),
  ]);
  const tombstonedBookmarkIds = new Set(
    tombstones.map((tombstone) => tombstone.bookmarkId),
  );
  const listNameById = new Map(lists.map((list) => [list.id, list.name]));
  const listIdsByBookmarkId = new Map<string, string[]>();
  for (const membership of memberships) {
    const listIds = listIdsByBookmarkId.get(membership.bookmarkId) ?? [];
    listIds.push(membership.listId);
    listIdsByBookmarkId.set(membership.bookmarkId, listIds);
  }

  return bookmarks.filter((bookmark) => {
    if (tombstonedBookmarkIds.has(bookmark.id)) {
      return false;
    }
    const content = bookmark.content;
    const replicatedContent =
      content.type === "link"
        ? [content.title, content.url]
        : content.type === "text"
          ? [content.text, content.sourceUrl]
          : content.type === "asset"
            ? [content.fileName, content.sourceUrl]
            : [];
    const searchableText = [
      bookmark.title,
      bookmark.note,
      bookmark.summary,
      ...replicatedContent,
      ...bookmark.tags.map((tag) => tag.name),
      ...(listIdsByBookmarkId.get(bookmark.id) ?? []).map((listId) =>
        listNameById.get(listId),
      ),
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();

    return tokens.every((token) => searchableText.includes(token));
  });
}

export async function enqueueMutation(
  mutation: ZOfflineSyncMutation,
  ownerUserId: string,
): Promise<void> {
  const parsedMutation = zOfflineSyncMutationSchema.safeParse(mutation);
  if (!parsedMutation.success) {
    throw new TypeError("Unsupported offline mutation");
  }
  if (ownerUserId.length === 0) {
    throw new TypeError("Offline mutations require an owner");
  }

  await offlineLibraryDb.transaction(
    "rw",
    offlineLibraryDb.bookmarks,
    offlineLibraryDb.lists,
    offlineLibraryDb.bookmarkListMemberships,
    offlineLibraryDb.tombstones,
    offlineLibraryDb.outbox,
    async () => {
      const queuedAt = Date.now();
      const pendingMutations = await offlineLibraryDb.outbox
        .where("ownerUserId")
        .equals(ownerUserId)
        .sortBy("queuedAt");
      const matchingMutations = pendingMutations.filter(
        (pendingMutation) =>
          pendingMutation.bookmarkId === parsedMutation.data.bookmarkId &&
          pendingMutation.kind === parsedMutation.data.kind &&
          (pendingMutation.kind !== "bookmark.listMembership" ||
            (parsedMutation.data.kind === "bookmark.listMembership" &&
              pendingMutation.listId === parsedMutation.data.listId)),
      );
      let queuedMutation: ZOfflineSyncMutation = parsedMutation.data;
      let supersededMutationKeys: string[] = [];
      let preservedQueuedAt = queuedAt;

      if (parsedMutation.data.kind === "bookmark.update") {
        const pendingUpdates = matchingMutations.filter(
          (
            pendingMutation,
          ): pendingMutation is Extract<
            ZOfflineSyncMutation,
            { kind: "bookmark.update" }
          > & { ownerUserId: string; queuedAt: number } =>
            pendingMutation.kind === "bookmark.update",
        );
        const primaryMutation = pendingUpdates[0];
        if (primaryMutation) {
          const fields = { ...primaryMutation.fields };
          const baseVersions = { ...primaryMutation.baseVersions };

          for (const pendingUpdate of pendingUpdates.slice(1)) {
            Object.assign(fields, pendingUpdate.fields);
            for (const field of Object.keys(pendingUpdate.fields)) {
              baseVersions[field] ??= pendingUpdate.baseVersions[field]!;
            }
          }
          Object.assign(fields, parsedMutation.data.fields);
          for (const field of Object.keys(parsedMutation.data.fields)) {
            baseVersions[field] ??= parsedMutation.data.baseVersions[field]!;
          }

          queuedMutation = {
            idempotencyKey: primaryMutation.idempotencyKey,
            kind: "bookmark.update",
            bookmarkId: parsedMutation.data.bookmarkId,
            fields,
            baseVersions,
          };
          supersededMutationKeys = pendingUpdates
            .slice(1)
            .map((pendingMutation) => pendingMutation.idempotencyKey);
          preservedQueuedAt = primaryMutation.queuedAt;
        }
      } else if (parsedMutation.data.kind === "bookmark.tags") {
        const pendingTags = matchingMutations.filter(
          (
            pendingMutation,
          ): pendingMutation is Extract<
            ZOfflineSyncMutation,
            { kind: "bookmark.tags" }
          > & { ownerUserId: string; queuedAt: number } =>
            pendingMutation.kind === "bookmark.tags",
        );
        const primaryMutation = pendingTags[0];
        if (primaryMutation) {
          const finalTagIds = parsedMutation.data.tagIds;
          const createdTagsById = new Map(
            primaryMutation.createdTags.map((tag) => [tag.id, tag]),
          );
          for (const pendingTagMutation of pendingTags.slice(1)) {
            for (const tag of pendingTagMutation.createdTags) {
              createdTagsById.set(tag.id, tag);
            }
          }
          for (const tag of parsedMutation.data.createdTags) {
            createdTagsById.set(tag.id, tag);
          }
          queuedMutation = {
            ...parsedMutation.data,
            idempotencyKey: primaryMutation.idempotencyKey,
            baseVersions: primaryMutation.baseVersions,
            createdTags: [...createdTagsById.values()].filter((tag) =>
              finalTagIds.includes(tag.id),
            ),
          };
          supersededMutationKeys = pendingTags
            .slice(1)
            .map((pendingMutation) => pendingMutation.idempotencyKey);
          preservedQueuedAt = primaryMutation.queuedAt;
        }
      } else if (parsedMutation.data.kind === "bookmark.listMembership") {
        const pendingMembershipMutations = matchingMutations.filter(
          (
            pendingMutation,
          ): pendingMutation is Extract<
            ZOfflineSyncMutation,
            { kind: "bookmark.listMembership" }
          > & { ownerUserId: string; queuedAt: number } =>
            pendingMutation.kind === "bookmark.listMembership",
        );
        const primaryMutation = pendingMembershipMutations[0];
        if (primaryMutation) {
          queuedMutation = {
            ...parsedMutation.data,
            idempotencyKey: primaryMutation.idempotencyKey,
          };
          supersededMutationKeys = pendingMembershipMutations
            .slice(1)
            .map((pendingMutation) => pendingMutation.idempotencyKey);
          preservedQueuedAt = primaryMutation.queuedAt;
        }
      } else {
        const pendingDeletes = matchingMutations.filter(
          (
            pendingMutation,
          ): pendingMutation is Extract<
            ZOfflineSyncMutation,
            { kind: "bookmark.delete" }
          > & { ownerUserId: string; queuedAt: number } =>
            pendingMutation.kind === "bookmark.delete",
        );
        const primaryMutation = pendingDeletes[0];
        if (primaryMutation) {
          queuedMutation = {
            ...parsedMutation.data,
            idempotencyKey: primaryMutation.idempotencyKey,
          };
          preservedQueuedAt = primaryMutation.queuedAt;
        }
        supersededMutationKeys = [
          ...pendingDeletes.slice(1),
          ...pendingMutations.filter(
            (pendingMutation) =>
              pendingMutation.bookmarkId === parsedMutation.data.bookmarkId &&
              pendingMutation.kind !== "bookmark.delete",
          ),
        ].map((pendingMutation) => pendingMutation.idempotencyKey);
      }

      const bookmark = await offlineLibraryDb.bookmarks.get(
        parsedMutation.data.bookmarkId,
      );
      if (bookmark) {
        if (parsedMutation.data.kind === "bookmark.update") {
          const fields = parsedMutation.data.fields;
          const updatedBookmark: ZBookmark = {
            ...bookmark,
            ...(fields.title !== undefined ? { title: fields.title } : {}),
            ...(fields.archived !== undefined
              ? { archived: fields.archived }
              : {}),
            ...(fields.favourited !== undefined
              ? { favourited: fields.favourited }
              : {}),
            ...(fields.note !== undefined ? { note: fields.note } : {}),
            ...(fields.summary !== undefined
              ? { summary: fields.summary }
              : {}),
          };
          if (updatedBookmark.content.type === "link") {
            updatedBookmark.content = {
              ...updatedBookmark.content,
              ...(fields.url !== undefined ? { url: fields.url } : {}),
              ...(fields.description !== undefined
                ? { description: fields.description }
                : {}),
              ...(fields.author !== undefined ? { author: fields.author } : {}),
              ...(fields.publisher !== undefined
                ? { publisher: fields.publisher }
                : {}),
            };
          }
          if (
            updatedBookmark.content.type === "text" &&
            typeof fields.text === "string"
          ) {
            updatedBookmark.content = {
              ...updatedBookmark.content,
              text: fields.text,
            };
          }
          await offlineLibraryDb.bookmarks.put(updatedBookmark);
        } else if (parsedMutation.data.kind === "bookmark.tags") {
          const tagsById = new Map(bookmark.tags.map((tag) => [tag.id, tag]));
          const createdTagsById = new Map(
            parsedMutation.data.createdTags.map((tag) => [tag.id, tag]),
          );
          await offlineLibraryDb.bookmarks.put({
            ...bookmark,
            tags: parsedMutation.data.tagIds.map(
              (tagId) =>
                tagsById.get(tagId) ??
                (() => {
                  const createdTag = createdTagsById.get(tagId);
                  return {
                    id: tagId,
                    name: createdTag?.name ?? "",
                    attachedBy: "human" as const,
                  };
                })(),
            ),
          });
        }
      }
      if (parsedMutation.data.kind === "bookmark.listMembership") {
        const list = await offlineLibraryDb.lists.get(
          parsedMutation.data.listId,
        );
        if (
          !bookmark ||
          !list ||
          list.type !== "manual" ||
          list.userRole === "viewer"
        ) {
          throw new TypeError("Unsupported offline list membership");
        }
        if (parsedMutation.data.action === "add") {
          await offlineLibraryDb.bookmarkListMemberships.put({
            bookmarkId: parsedMutation.data.bookmarkId,
            listId: parsedMutation.data.listId,
          });
        } else {
          await offlineLibraryDb.bookmarkListMemberships.delete([
            parsedMutation.data.bookmarkId,
            parsedMutation.data.listId,
          ]);
        }
      }
      if (parsedMutation.data.kind === "bookmark.delete") {
        if (!bookmark || bookmark.userId !== ownerUserId) {
          throw new TypeError("Unsupported offline bookmark deletion");
        }
        await offlineLibraryDb.tombstones.put({
          idempotencyKey: queuedMutation.idempotencyKey,
          bookmarkId: parsedMutation.data.bookmarkId,
          ownerUserId,
          tombstonedAt: queuedAt,
        });
      }
      if (supersededMutationKeys.length > 0) {
        await offlineLibraryDb.outbox.bulkDelete(supersededMutationKeys);
      }
      await offlineLibraryDb.outbox.put({
        ...queuedMutation,
        ownerUserId,
        queuedAt: preservedQueuedAt,
      });
    },
  );
}

export async function listPendingMutations(
  ownerUserId: string,
): Promise<(ZOfflineSyncMutation & { queuedAt: number })[]> {
  const mutations = await offlineLibraryDb.outbox
    .where("ownerUserId")
    .equals(ownerUserId)
    .sortBy("queuedAt");
  return mutations.map(({ ownerUserId: _, ...mutation }) => mutation);
}

export async function deleteAcknowledgedMutations(
  ownerUserId: string,
  idempotencyKeys: string[],
): Promise<void> {
  const acknowledged = new Set(idempotencyKeys);
  const mutations = await offlineLibraryDb.outbox
    .where("ownerUserId")
    .equals(ownerUserId)
    .toArray();
  const acknowledgedMutationKeys = mutations
    .filter((mutation) => acknowledged.has(mutation.idempotencyKey))
    .map((mutation) => mutation.idempotencyKey);
  await offlineLibraryDb.outbox.bulkDelete(acknowledgedMutationKeys);
}

export async function saveConflict(
  conflict: ZOfflineSyncConflict,
): Promise<void> {
  const storedConflict: StoredConflict = {
    ...conflict,
    id: `${conflict.bookmarkId}:${conflict.field}`,
  };
  await offlineLibraryDb.conflicts.put(storedConflict);
}

export async function saveRejectedMutation(
  rejection: ZOfflineSyncRejection,
  ownerUserId: string,
): Promise<void> {
  await offlineLibraryDb.rejections.put({
    ...rejection,
    ownerUserId,
    rejectedAt: Date.now(),
  });
}

export async function deleteRejectedMutation(
  idempotencyKey: string,
): Promise<void> {
  await offlineLibraryDb.rejections.delete(idempotencyKey);
}

export async function discardBookmarkTombstone(
  idempotencyKey: string,
): Promise<void> {
  await offlineLibraryDb.tombstones.delete(idempotencyKey);
}

export async function purgeOfflineLibrary(): Promise<void> {
  await offlineLibraryDb.transaction(
    "rw",
    [
      offlineLibraryDb.bookmarks,
      offlineLibraryDb.lists,
      offlineLibraryDb.bookmarkListMemberships,
      offlineLibraryDb.bookmarkRssFeedMemberships,
      offlineLibraryDb.bookmarkFieldVersions,
      offlineLibraryDb.metadata,
      offlineLibraryDb.outbox,
      offlineLibraryDb.conflicts,
      offlineLibraryDb.rejections,
      offlineLibraryDb.tombstones,
      offlineLibraryDb.thumbnailAccess,
    ],
    async () => {
      await Promise.all([
        offlineLibraryDb.bookmarks.clear(),
        offlineLibraryDb.lists.clear(),
        offlineLibraryDb.bookmarkListMemberships.clear(),
        offlineLibraryDb.bookmarkRssFeedMemberships.clear(),
        offlineLibraryDb.bookmarkFieldVersions.clear(),
        offlineLibraryDb.metadata.clear(),
        offlineLibraryDb.outbox.clear(),
        offlineLibraryDb.conflicts.clear(),
        offlineLibraryDb.rejections.clear(),
        offlineLibraryDb.tombstones.clear(),
        offlineLibraryDb.thumbnailAccess.clear(),
      ]);
    },
  );
  const cacheStorage = globalThis.caches;
  const cacheNames =
    typeof cacheStorage?.keys === "function" ? await cacheStorage.keys() : [];
  await Promise.all(
    cacheNames
      .filter(
        (cacheName) =>
          cacheName === LEGACY_THUMBNAIL_CACHE_NAME ||
          cacheName.startsWith(THUMBNAIL_CACHE_PREFIX),
      )

      .map((cacheName) => cacheStorage?.delete(cacheName)),
  );
}

export async function getReplicaOwnerUserId(): Promise<string | null> {
  return (
    (await offlineLibraryDb.metadata.get(REPLICA_OWNER_USER_ID_KEY))?.value ??
    null
  );
}

export async function getLastSuccessfulSyncAt(): Promise<Date | null> {
  const value = (
    await offlineLibraryDb.metadata.get(LAST_SUCCESSFUL_SYNC_AT_KEY)
  )?.value;
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function saveLastSuccessfulSyncAt(date: Date): Promise<void> {
  await offlineLibraryDb.metadata.put({
    key: LAST_SUCCESSFUL_SYNC_AT_KEY,
    value: date.toISOString(),
  });
}

export async function isOfflineReplicaReady(): Promise<boolean> {
  return (
    (await offlineLibraryDb.metadata.get(REPLICA_STATE_KEY))?.value === "ready"
  );
}

export async function recordThumbnailAccess(
  url: string,
  accessedAt = new Date(),
): Promise<void> {
  await offlineLibraryDb.thumbnailAccess.put({
    url,
    lastAccessedAt: accessedAt.getTime(),
  });
}

export async function evictLeastRecentlyUsedThumbnails(
  count: number,
): Promise<number> {
  if (!Number.isInteger(count) || count <= 0) {
    return 0;
  }

  const thumbnailRecords = await offlineLibraryDb.thumbnailAccess
    .orderBy("lastAccessedAt")
    .limit(count)
    .toArray();
  if (thumbnailRecords.length === 0) {
    return 0;
  }

  const cacheStorage = globalThis.caches;
  const cacheNames =
    typeof cacheStorage?.keys === "function" ? await cacheStorage.keys() : [];
  const thumbnailCaches = await Promise.all(
    cacheNames
      .filter(
        (cacheName) =>
          cacheName === LEGACY_THUMBNAIL_CACHE_NAME ||
          cacheName.startsWith(THUMBNAIL_CACHE_PREFIX),
      )
      .map(async (cacheName) => await cacheStorage?.open(cacheName)),
  );
  for (const thumbnailRecord of thumbnailRecords) {
    await Promise.all(
      thumbnailCaches.map(
        async (cache) => await cache?.delete(thumbnailRecord.url),
      ),
    );
  }
  await offlineLibraryDb.thumbnailAccess.bulkDelete(
    thumbnailRecords.map((thumbnailRecord) => thumbnailRecord.url),
  );

  return thumbnailRecords.length;
}
