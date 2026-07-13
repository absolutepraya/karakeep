import {
  DEFAULT_NUM_BOOKMARKS_PER_PAGE,
  type ZBookmark,
  type ZSortOrder,
} from "@karakeep/shared/types/bookmarks";
import type { ZCursor } from "@karakeep/shared/types/pagination";
import {
  zOfflineSyncMutationSchema,
  type ZOfflineSyncConflict,
  type ZOfflineSyncCursor,
  type ZOfflineSyncEvent,
  type ZOfflineSyncMutation,
  type ZOfflineSyncSnapshot,
} from "@karakeep/shared/types/offlineSync";

import { offlineLibraryDb } from "./schema";

const SYNC_CURSOR_KEY = "syncCursor";
const REPLICA_STATE_KEY = "replicaState";
const REPLICA_OWNER_USER_ID_KEY = "replicaOwnerUserId";
const LEGACY_THUMBNAIL_CACHE_NAME = "karakeep-thumbnails";
const THUMBNAIL_CACHE_PREFIX = `${LEGACY_THUMBNAIL_CACHE_NAME}:`;

type OfflineBookmarkQuery = {
  archived?: boolean;
  favourited?: boolean;
  tagId?: string;
  listId?: string;
  rssFeedId?: string;
  sortOrder?: Exclude<ZSortOrder, "relevance">;
  cursor?: ZCursor | null;
  limit?: number;
};

type OfflineBookmarkPage = {
  bookmarks: ZBookmark[];
  cursor: ZOfflineSyncCursor | null;
  nextCursor: ZCursor | null;
};

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
      offlineLibraryDb.metadata,
    ],
    async () => {
      await Promise.all([
        offlineLibraryDb.bookmarks.clear(),
        offlineLibraryDb.lists.clear(),
        offlineLibraryDb.bookmarkListMemberships.clear(),
        offlineLibraryDb.bookmarkRssFeedMemberships.clear(),
        offlineLibraryDb.bookmarkFieldVersions.clear(),
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
      offlineLibraryDb.metadata,
    ],
    async () => {
      const replicaState = await offlineLibraryDb.metadata.get(REPLICA_STATE_KEY);
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

        await offlineLibraryDb.bookmarkFieldVersions.bulkPut(event.fieldVersions);
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
  return (
    await offlineLibraryDb.bookmarkFieldVersions.get([bookmarkId, field])
  )?.version;
}


export async function queryBookmarks(
  query: OfflineBookmarkQuery = {},
): Promise<OfflineBookmarkPage> {
  const [bookmarks, listMemberships, rssFeedMemberships, cursor] =
    await Promise.all([
      offlineLibraryDb.bookmarks.toArray(),
      offlineLibraryDb.bookmarkListMemberships.toArray(),
      offlineLibraryDb.bookmarkRssFeedMemberships.toArray(),
      offlineLibraryDb.metadata.get(SYNC_CURSOR_KEY),
    ]);
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
      if (query.archived !== undefined && bookmark.archived !== query.archived) {
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

  const [bookmarks, lists, memberships] = await Promise.all([
    offlineLibraryDb.bookmarks.toArray(),
    offlineLibraryDb.lists.toArray(),
    offlineLibraryDb.bookmarkListMemberships.toArray(),
  ]);
  const listNameById = new Map(lists.map((list) => [list.id, list.name]));
  const listIdsByBookmarkId = new Map<string, string[]>();
  for (const membership of memberships) {
    const listIds = listIdsByBookmarkId.get(membership.bookmarkId) ?? [];
    listIds.push(membership.listId);
    listIdsByBookmarkId.set(membership.bookmarkId, listIds);
  }

  return bookmarks.filter((bookmark) => {
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
          pendingMutation.kind === parsedMutation.data.kind,
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
      } else {
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
          queuedMutation = {
            ...parsedMutation.data,
            idempotencyKey: primaryMutation.idempotencyKey,
            baseVersions: primaryMutation.baseVersions,
          };
          supersededMutationKeys = pendingTags
            .slice(1)
            .map((pendingMutation) => pendingMutation.idempotencyKey);
          preservedQueuedAt = primaryMutation.queuedAt;
        }
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
            ...(fields.summary !== undefined ? { summary: fields.summary } : {}),
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
        } else {
          const tagsById = new Map(bookmark.tags.map((tag) => [tag.id, tag]));
          await offlineLibraryDb.bookmarks.put({
            ...bookmark,
            tags: parsedMutation.data.tagIds.map(
              (tagId) =>
                tagsById.get(tagId) ?? {
                  id: tagId,
                  name: "",
                  attachedBy: "human",
                },
            ),
          });
        }
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
): Promise<Array<ZOfflineSyncMutation & { queuedAt: number }>> {
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
  await offlineLibraryDb.outbox.bulkDelete(
    mutations
      .filter((mutation) => acknowledged.has(mutation.idempotencyKey))
      .map((mutation) => mutation.idempotencyKey),
  );
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

export async function isOfflineReplicaReady(): Promise<boolean> {
  return (
    (await offlineLibraryDb.metadata.get(REPLICA_STATE_KEY))?.value === "ready"
  );
}

export async function setReplicaOwnerUserId(userId: string): Promise<void> {
  await offlineLibraryDb.metadata.put({
    key: REPLICA_OWNER_USER_ID_KEY,
    value: userId,
  });
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
      thumbnailCaches.map(async (cache) => await cache?.delete(thumbnailRecord.url)),
    );
  }
  await offlineLibraryDb.thumbnailAccess.bulkDelete(
    thumbnailRecords.map((thumbnailRecord) => thumbnailRecord.url),
  );

  return thumbnailRecords.length;
}
