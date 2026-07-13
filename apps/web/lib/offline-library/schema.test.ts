import "fake-indexeddb/auto";
import Dexie from "dexie";

import { afterEach, expect, test } from "vitest";

import { OfflineLibraryDatabase, offlineLibraryDb } from "./schema";

afterEach(async () => {
  await offlineLibraryDb.delete();
});

test("defines every offline-library table", async () => {
  await offlineLibraryDb.open();

  expect(offlineLibraryDb.tables.map((table) => table.name).sort()).toEqual([
    "bookmarkFieldVersions",
    "bookmarkListMemberships",
    "bookmarks",
    "conflicts",
    "lists",
    "metadata",
    "outbox",
    "thumbnailAccess",
  ]);
});

test("invalidates a ready v3 replica so v4 synchronizes a snapshot", async () => {
  const databaseName = "offline-library-v3-upgrade";
  const legacyDb = new Dexie(databaseName);
  legacyDb.version(1).stores({
    bookmarks: "id, archived, favourited, createdAt, modifiedAt, userId, *tags.id",
    lists: "id, userRole, parentId",
    metadata: "key",
    outbox: "idempotencyKey, bookmarkId, kind, queuedAt",
    conflicts: "id, bookmarkId, field",
    thumbnailAccess: "url, lastAccessedAt",
  });
  legacyDb.version(2).stores({
    bookmarkListMemberships: "[bookmarkId+listId], bookmarkId, listId",
  });
  legacyDb.version(3).stores({
    outbox: "idempotencyKey, ownerUserId, [ownerUserId+queuedAt], bookmarkId, kind, queuedAt",
  });

  await legacyDb.open();
  await legacyDb.table("metadata").bulkPut([
    { key: "syncCursor", value: "42" },
    { key: "replicaState", value: "ready" },
    { key: "replicaOwnerUserId", value: "user-1" },
  ]);
  legacyDb.close();

  const upgradedDb = new OfflineLibraryDatabase(databaseName);
  try {
    await upgradedDb.open();

    await expect(upgradedDb.metadata.get("syncCursor")).resolves.toBeUndefined();
    await expect(upgradedDb.metadata.get("replicaState")).resolves.toEqual({
      key: "replicaState",
      value: "stale",
    });
    await expect(upgradedDb.metadata.get("replicaOwnerUserId")).resolves.toEqual({
      key: "replicaOwnerUserId",
      value: "user-1",
    });
  } finally {
    upgradedDb.close();
    await upgradedDb.delete();
  }
});
