import Dexie, { type Table } from "dexie";

import type { ZBookmark } from "@karakeep/shared/types/bookmarks";
import type { ZBookmarkList } from "@karakeep/shared/types/lists";
import type {
  ZOfflineSyncConflict,
  ZOfflineSyncMutation,
} from "@karakeep/shared/types/offlineSync";

export class OfflineLibraryDatabase extends Dexie {
  bookmarks!: Table<ZBookmark, string>;
  lists!: Table<ZBookmarkList, string>;
  metadata!: Table<{ key: string; value: string }, string>;
  outbox!: Table<ZOfflineSyncMutation & { queuedAt: number }, string>;
  conflicts!: Table<ZOfflineSyncConflict, string>;
  thumbnailAccess!: Table<{ url: string; lastAccessedAt: number }, string>;

  constructor() {
    super("karakeep-offline-library");
    this.version(1).stores({
      bookmarks: "id, archived, favourited, createdAt, modifiedAt, userId, *tags.id",
      lists: "id, userRole, parentId",
      metadata: "key",
      outbox: "idempotencyKey, bookmarkId, kind, queuedAt",
      conflicts: "id, bookmarkId, field",
      thumbnailAccess: "url, lastAccessedAt",
    });
  }
}

export const offlineLibraryDb = new OfflineLibraryDatabase();
