import { DEFAULT_NUM_BOOKMARKS_PER_PAGE, type ZBookmark, type ZSortOrder } from "@karakeep/shared/types/bookmarks";
import type { ZBookmarkList } from "@karakeep/shared/types/lists";
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
const THUMBNAIL_CACHE_NAME = "karakeep-thumbnails";

type OfflineBookmarkQuery = {
  archived?: boolean;
  favourited?: boolean;
  tagId?: string;
  listId?: string;
  sortOrder?: Exclude<ZSortOrder, "relevance">;
  cursor?: ZCursor | null;
  limit?: number;
};

type OfflineBookmarkPage = {
  bookmarks: ZBookmark[];
  cursor: ZOfflineSyncCursor | null;
  nextCursor: ZCursor | null;
};

type BookmarkWithLists = ZBookmark & {
  listIds?: string[];
  lists?: Array<{ id: string }>;
};

type StoredConflict = ZOfflineSyncConflict & { id: string };

export { offlineLibraryDb };
export type { OfflineBookmarkPage, OfflineBookmarkQuery };

export async function replaceSnapshot(snapshot: ZOfflineSyncSnapshot): Promise<void> {
  await offlineLibraryDb.transaction(
    "rw",
    offlineLibraryDb.bookmarks,
    offlineLibraryDb.lists,
    offlineLibraryDb.metadata,
    async () => {
      await Promise.all([
        offlineLibraryDb.bookmarks.clear(),
        offlineLibraryDb.lists.clear(),
      ]);
      await Promise.all([
        offlineLibraryDb.bookmarks.bulkPut(snapshot.bookmarks),
        offlineLibraryDb.lists.bulkPut(snapshot.lists),
        offlineLibraryDb.metadata.bulkPut([
          { key: SYNC_CURSOR_KEY, value: snapshot.cursor },
          { key: REPLICA_STATE_KEY, value: "ready" },
        ]),
      ]);
    },
  );
}

export async function applyEvents(
  events: ZOfflineSyncEvent[],
  cursor: ZOfflineSyncCursor,
): Promise<void> {
  await offlineLibraryDb.transaction(
    "rw",
    offlineLibraryDb.bookmarks,
    offlineLibraryDb.lists,
    offlineLibraryDb.metadata,
    async () => {
      await Promise.all(
        events.map(async (event) => {
          if (event.operation !== "delete" && event.operation !== "revoke") {
            return;
          }

          if (event.entityType === "bookmark") {
            await offlineLibraryDb.bookmarks.delete(event.entityId);
          } else {
            await offlineLibraryDb.lists.delete(event.entityId);
          }
        }),
      );
      await offlineLibraryDb.metadata.bulkPut([
        { key: SYNC_CURSOR_KEY, value: cursor },
        {
          key: REPLICA_STATE_KEY,
          value: events.some(
            (event) =>
              event.operation !== "delete" && event.operation !== "revoke",
          )
            ? "stale"
            : "ready",
        },
      ]);
    },
  );
}

export async function queryBookmarks(
  query: OfflineBookmarkQuery = {},
): Promise<OfflineBookmarkPage> {
  const [bookmarks, cursor] = await Promise.all([
    offlineLibraryDb.bookmarks.toArray(),
    offlineLibraryDb.metadata.get(SYNC_CURSOR_KEY),
  ]);
  const sortOrder = query.sortOrder ?? "desc";
  const limit = Math.max(1, query.limit ?? DEFAULT_NUM_BOOKMARKS_PER_PAGE);
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
      if (query.listId !== undefined) {
        const bookmarkWithLists = bookmark as BookmarkWithLists;
        const listIds = bookmarkWithLists.listIds ?? bookmarkWithLists.lists?.map((list) => list.id) ?? [];
        if (!listIds.includes(query.listId)) {
          return false;
        }
      }
      return true;
    })
    .sort((left, right) => {
      const createdAtDifference = left.createdAt.getTime() - right.createdAt.getTime();
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
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  const [bookmarks, lists] = await Promise.all([
    offlineLibraryDb.bookmarks.toArray(),
    offlineLibraryDb.lists.toArray(),
  ]);
  const listNameById = new Map(lists.map((list) => [list.id, list.name]));

  return bookmarks.filter((bookmark) => {
    const bookmarkWithLists = bookmark as BookmarkWithLists;
    const listIds = bookmarkWithLists.listIds ?? bookmarkWithLists.lists?.map((list) => list.id) ?? [];
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
      ...listIds.map((listId) => listNameById.get(listId)),
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLocaleLowerCase();

    return tokens.every((token) => searchableText.includes(token));
  });
}

export async function enqueueMutation(
  mutation: ZOfflineSyncMutation,
): Promise<void> {
  const parsedMutation = zOfflineSyncMutationSchema.safeParse(mutation);
  if (!parsedMutation.success) {
    throw new TypeError("Unsupported offline mutation");
  }

  await offlineLibraryDb.transaction(
    "rw",
    offlineLibraryDb.bookmarks,
    offlineLibraryDb.outbox,
    async () => {
      const bookmark = await offlineLibraryDb.bookmarks.get(mutation.bookmarkId);
      if (bookmark) {
        if (mutation.kind === "bookmark.update") {
          const fields = mutation.fields;
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
            tags: mutation.tagIds.map(
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
      await offlineLibraryDb.outbox.put({
        ...parsedMutation.data,
        queuedAt: Date.now(),
      });
    },
  );
}

export async function listPendingMutations(): Promise<
  Array<ZOfflineSyncMutation & { queuedAt: number }>
> {
  return await offlineLibraryDb.outbox.orderBy("queuedAt").toArray();
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
      offlineLibraryDb.metadata,
      offlineLibraryDb.outbox,
      offlineLibraryDb.conflicts,
      offlineLibraryDb.thumbnailAccess,
    ],
    async () => {
      await Promise.all([
        offlineLibraryDb.bookmarks.clear(),
        offlineLibraryDb.lists.clear(),
        offlineLibraryDb.metadata.clear(),
        offlineLibraryDb.outbox.clear(),
        offlineLibraryDb.conflicts.clear(),
        offlineLibraryDb.thumbnailAccess.clear(),
      ]);
    },
  );
  await globalThis.caches?.delete(THUMBNAIL_CACHE_NAME);
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

  const cache = await globalThis.caches?.open(THUMBNAIL_CACHE_NAME);
  for (const thumbnailRecord of thumbnailRecords) {
    await cache?.delete(thumbnailRecord.url);
  }
  await offlineLibraryDb.thumbnailAccess.bulkDelete(
    thumbnailRecords.map((thumbnailRecord) => thumbnailRecord.url),
  );

  return thumbnailRecords.length;
}
