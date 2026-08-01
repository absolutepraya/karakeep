import Dexie from "dexie";
import type { Table } from "dexie";

import type { ZBookmark } from "@karakeep/shared/types/bookmarks";
import type { ZBookmarkList } from "@karakeep/shared/types/lists";
import type {
  ZOfflineSyncBookmarkFieldVersion,
  ZOfflineSyncBookmarkListMembership,
  ZOfflineSyncBookmarkRssFeedMembership,
  ZOfflineSyncConflict,
  ZOfflineSyncMutation,
  ZOfflineSyncRejection,
} from "@karakeep/shared/types/offlineSync";

type StoredOfflineSyncMutation = ZOfflineSyncMutation & {
  ownerUserId: string;
  queuedAt: number;
};
type StoredOfflineSyncRejection = ZOfflineSyncRejection & {
  ownerUserId: string;
  rejectedAt: number;
};

export class OfflineLibraryDatabase extends Dexie {
  bookmarks!: Table<ZBookmark, string>;
  lists!: Table<ZBookmarkList, string>;
  metadata!: Table<{ key: string; value: string }, string>;
  outbox!: Table<StoredOfflineSyncMutation, string>;
  bookmarkListMemberships!: Table<
    ZOfflineSyncBookmarkListMembership,
    [string, string]
  >;
  bookmarkRssFeedMemberships!: Table<
    ZOfflineSyncBookmarkRssFeedMembership,
    [string, string]
  >;
  conflicts!: Table<ZOfflineSyncConflict, string>;
  rejections!: Table<StoredOfflineSyncRejection, string>;
  bookmarkFieldVersions!: Table<
    ZOfflineSyncBookmarkFieldVersion,
    [string, string]
  >;
  thumbnailAccess!: Table<{ url: string; lastAccessedAt: number }, string>;

  constructor(databaseName = "karakeep-offline-library") {
    super(databaseName);
    this.version(1).stores({
      bookmarks:
        "id, archived, favourited, createdAt, modifiedAt, userId, *tags.id",
      lists: "id, userRole, parentId",
      metadata: "key",
      outbox: "idempotencyKey, bookmarkId, kind, queuedAt",
      conflicts: "id, bookmarkId, field",
      thumbnailAccess: "url, lastAccessedAt",
    });
    this.version(2).stores({
      bookmarkListMemberships: "[bookmarkId+listId], bookmarkId, listId",
    });
    this.version(3).stores({
      outbox:
        "idempotencyKey, ownerUserId, [ownerUserId+queuedAt], bookmarkId, kind, queuedAt",
    });
    this.version(4)
      .stores({
        bookmarkFieldVersions: "[bookmarkId+field], bookmarkId, field",
      })
      .upgrade(async (tx) => {
        await tx.table("metadata").delete("syncCursor");
        await tx.table("metadata").put({
          key: "replicaState",
          value: "stale",
        });
      });
    this.version(5).stores({
      bookmarkRssFeedMemberships:
        "[bookmarkId+rssFeedId], bookmarkId, rssFeedId",
    });
    this.version(6).stores({
      rejections: "idempotencyKey, ownerUserId, [ownerUserId+rejectedAt]",
    });
  }
}

export const offlineLibraryDb = new OfflineLibraryDatabase();
