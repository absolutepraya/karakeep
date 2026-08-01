import "fake-indexeddb/auto";

import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { BookmarkTypes } from "@karakeep/shared/types/bookmarks";
import type { ZBookmark } from "@karakeep/shared/types/bookmarks";
import type {
  ZOfflineSyncMutation,
  ZOfflineSyncPullResult,
  ZOfflineSyncPushResult,
  ZOfflineSyncSnapshot,
} from "@karakeep/shared/types/offlineSync";

import {
  enqueueMutation,
  listPendingMutations,
  offlineLibraryDb,
  queryBookmarks,
  replaceSnapshot,
  saveLastSuccessfulSyncAt,
} from "./repository";
import { OfflineLibrarySyncCoordinator } from "./sync";
import type { OfflineSyncClient } from "./sync";

const bookmark: ZBookmark = {
  id: "bookmark-1",
  createdAt: new Date("2026-07-10T00:00:00Z"),
  modifiedAt: null,
  title: "Offline article",
  archived: false,
  favourited: false,
  taggingStatus: null,
  summarizationStatus: null,
  embeddingStatus: null,
  note: null,
  summary: null,
  source: "web",
  userId: "user-1",
  tags: [],
  content: {
    type: BookmarkTypes.LINK,
    url: "https://example.com/offline",
    title: null,
    description: null,
    imageUrl: null,
    imageAssetId: null,
    screenshotAssetId: null,
    pdfAssetId: null,
    fullPageArchiveAssetId: null,
    precrawledArchiveAssetId: null,
    videoAssetId: null,
    favicon: null,
    htmlContent: null,
    contentAssetId: null,
    crawledAt: null,
    crawlStatus: null,
    author: null,
    publisher: null,
    datePublished: null,
    dateModified: null,
  },
  assets: [],
};

const snapshot: ZOfflineSyncSnapshot = {
  bookmarks: [bookmark],
  lists: [],
  bookmarkListMemberships: [],
  bookmarkRssFeedMemberships: [],
  bookmarkFieldVersions: [
    { bookmarkId: bookmark.id, field: "title", version: 0 },
  ],
  cursor: "12",
};

const pendingMutation: ZOfflineSyncMutation = {
  idempotencyKey: "e7da6e68-4b45-4f56-aa6f-bd0c0fbbc6b8",
  kind: "bookmark.update",
  bookmarkId: bookmark.id,
  fields: { title: "Updated offline" },
  baseVersions: { title: 0 },
};

const emptyDelta: ZOfflineSyncPullResult = { events: [], cursor: "12" };
const acknowledgedPush: ZOfflineSyncPushResult = {
  acknowledged: [pendingMutation.idempotencyKey],
  conflicts: [],
  rejections: [],
  cursor: "12",
};

function makeClient(): OfflineSyncClient {
  return {
    snapshot: vi.fn().mockResolvedValue(snapshot),
    pull: vi.fn().mockResolvedValue(emptyDelta),
    push: vi.fn().mockResolvedValue(acknowledgedPush),
  };
}

beforeEach(async () => {
  await offlineLibraryDb.delete();
  await offlineLibraryDb.open();
});

afterEach(async () => {
  await offlineLibraryDb.delete();
  vi.restoreAllMocks();
});

test("does not mark the replica online until pull succeeds", async () => {
  await replaceSnapshot(snapshot, "user-1");
  const client = makeClient();
  vi.mocked(client.pull).mockRejectedValueOnce(new Error("captive portal"));
  const coordinator = new OfflineLibrarySyncCoordinator(client);
  coordinator.activate("user-1");

  await expect(coordinator.syncNow()).rejects.toThrow("captive portal");
  expect(coordinator.getStatus()).toMatchObject({ kind: "error" });
});

test("replays queued writes once, then applies the returned delta", async () => {
  await replaceSnapshot(snapshot, "user-1");
  await enqueueMutation(pendingMutation, "user-1");
  const client = makeClient();
  const coordinator = new OfflineLibrarySyncCoordinator(client);
  coordinator.activate("user-1");

  await coordinator.syncNow();

  expect(client.push).toHaveBeenCalledTimes(1);
  await expect(listPendingMutations("user-1")).resolves.toHaveLength(0);
});

test("replays the final repeated offline edit without a version conflict", async () => {
  const firstMutation: ZOfflineSyncMutation = {
    idempotencyKey: "87bd61bb-35c0-4a54-bf39-e7cec9d43c9a",
    kind: "bookmark.update",
    bookmarkId: bookmark.id,
    fields: { favourited: true },
    baseVersions: { favourited: 0 },
  };
  const secondMutation: ZOfflineSyncMutation = {
    idempotencyKey: "b0b596a3-0ff2-4554-8d96-d0f2b593013a",
    kind: "bookmark.update",
    bookmarkId: bookmark.id,
    fields: { favourited: false },
    baseVersions: { favourited: 0 },
  };
  await replaceSnapshot(
    {
      ...snapshot,
      bookmarkFieldVersions: [
        ...snapshot.bookmarkFieldVersions,
        { bookmarkId: bookmark.id, field: "favourited", version: 0 },
      ],
    },
    "user-1",
  );
  const client = makeClient();
  vi.mocked(client.push).mockImplementation(async ({ mutations }) => ({
    acknowledged: mutations.map((mutation) => mutation.idempotencyKey),
    conflicts: [],
    rejections: [],
    cursor: "12",
  }));
  const coordinator = new OfflineLibrarySyncCoordinator(client);
  coordinator.activate("user-1");
  await coordinator.markOffline();

  await coordinator.queueBookmarkUpdate(firstMutation);
  await coordinator.queueBookmarkUpdate(secondMutation);
  await coordinator.syncNow();

  expect(client.push).toHaveBeenCalledWith({
    mutations: [
      expect.objectContaining({
        idempotencyKey: firstMutation.idempotencyKey,
        fields: { favourited: false },
        baseVersions: { favourited: 0 },
      }),
    ],
  });
  await expect(listPendingMutations("user-1")).resolves.toEqual([]);
  expect(coordinator.getStatus()).toMatchObject({
    kind: "online",
    pendingWrites: 0,
  });
});

test("takes an atomic snapshot before the first online state", async () => {
  const client = makeClient();
  const coordinator = new OfflineLibrarySyncCoordinator(client);
  coordinator.activate("user-1");

  await coordinator.syncNow();

  expect(client.snapshot).toHaveBeenCalledTimes(1);
  expect(coordinator.getStatus()).toMatchObject({
    kind: "online",
    pendingWrites: 0,
  });
});

test("restores the persisted last sync time for an offline launch", async () => {
  const syncedAt = new Date("2026-07-31T10:00:00.000Z");
  await replaceSnapshot(snapshot, "user-1");
  await saveLastSuccessfulSyncAt(syncedAt);
  const coordinator = new OfflineLibrarySyncCoordinator(makeClient());
  coordinator.activate("user-1");

  await coordinator.hydrateLastSuccessfulSyncAt();
  await coordinator.markOffline();

  expect(coordinator.getStatus()).toEqual({
    kind: "offline",
    lastSyncedAt: syncedAt,
    pendingWrites: 0,
  });
});

test("persists the time of a successful synchronization", async () => {
  const coordinator = new OfflineLibrarySyncCoordinator(makeClient());
  coordinator.activate("user-1");

  await coordinator.syncNow();

  await expect(
    offlineLibraryDb.metadata.get("lastSuccessfulSyncAt"),
  ).resolves.toMatchObject({ key: "lastSuccessfulSyncAt" });
});

test("requests persistent storage once after successful syncs", async () => {
  const originalStorage = navigator.storage;
  const persist = vi.fn().mockResolvedValue(true);
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: { persist },
  });
  const coordinator = new OfflineLibrarySyncCoordinator(makeClient());
  coordinator.activate("user-1");

  await coordinator.syncNow();
  await coordinator.syncNow();

  expect(persist).toHaveBeenCalledOnce();
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: originalStorage,
  });
});

test("does not fail a successful sync when persistent storage is unavailable", async () => {
  const originalStorage = navigator.storage;
  const persist = vi.fn().mockRejectedValue(new Error("storage denied"));
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: { persist },
  });
  const coordinator = new OfflineLibrarySyncCoordinator(makeClient());
  coordinator.activate("user-1");

  await coordinator.syncNow();

  expect(coordinator.getStatus()).toMatchObject({ kind: "online" });
  expect(persist).toHaveBeenCalledOnce();
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: originalStorage,
  });
});

test("keeps an online replica online during a background delta sync", async () => {
  await replaceSnapshot(snapshot, "user-1");
  const client = makeClient();
  const coordinator = new OfflineLibrarySyncCoordinator(client);
  coordinator.activate("user-1");

  await coordinator.syncNow();

  const statuses: string[] = [];
  const unsubscribe = coordinator.subscribe((status) => {
    statuses.push(status.kind);
  });
  statuses.length = 0;

  await coordinator.syncNow();
  unsubscribe();

  expect(client.pull).toHaveBeenCalledTimes(2);
  expect(statuses).not.toContain("syncing");
  expect(coordinator.getStatus()).toMatchObject({ kind: "online" });
});

test("refreshes the local replica from a snapshot after a remote delta", async () => {
  await replaceSnapshot(snapshot, "user-1");
  const client = makeClient();
  const refreshedSnapshot: ZOfflineSyncSnapshot = {
    ...snapshot,
    bookmarks: [{ ...bookmark, title: "Updated on another device" }],
    bookmarkFieldVersions: [
      { bookmarkId: bookmark.id, field: "title", version: 1 },
    ],
    cursor: "13",
  };
  vi.mocked(client.snapshot).mockResolvedValue(refreshedSnapshot);
  vi.mocked(client.pull)
    .mockResolvedValueOnce({
      events: [
        {
          sequence: 13,
          userId: "user-1",
          entityType: "bookmark",
          entityId: bookmark.id,
          operation: "update",
          changedFields: ["title"],
          fieldVersions: [
            { bookmarkId: bookmark.id, field: "title", version: 1 },
          ],
          createdAt: new Date("2026-07-18T00:00:00Z"),
        },
      ],
      cursor: "13",
    })
    .mockResolvedValueOnce({ events: [], cursor: "13" });
  const coordinator = new OfflineLibrarySyncCoordinator(client);
  coordinator.activate("user-1");

  await coordinator.syncNow();

  await expect(queryBookmarks()).resolves.toMatchObject({
    cursor: "13",
    bookmarks: [{ title: "Updated on another device" }],
  });
});

test("saves conflicts and prioritizes them over online status", async () => {
  await replaceSnapshot(snapshot, "user-1");
  await enqueueMutation(pendingMutation, "user-1");
  const client = makeClient();
  vi.mocked(client.push).mockResolvedValueOnce({
    ...acknowledgedPush,
    acknowledged: [],
    conflicts: [
      {
        bookmarkId: bookmark.id,
        field: "title",
        localValue: "Updated offline",
        serverValue: "Updated on server",
        serverVersion: 1,
      },
    ],
  });
  const coordinator = new OfflineLibrarySyncCoordinator(client);
  coordinator.activate("user-1");

  await coordinator.syncNow();

  expect(coordinator.getStatus()).toEqual({
    kind: "conflict",
    pendingWrites: 1,
    conflictCount: 1,
  });
});

test("records a rejected mutation without entering retry backoff", async () => {
  await replaceSnapshot(snapshot, "user-1");
  await enqueueMutation(pendingMutation, "user-1");
  const client = makeClient();
  vi.mocked(client.push).mockResolvedValueOnce({
    acknowledged: [],
    conflicts: [],
    rejections: [
      {
        idempotencyKey: pendingMutation.idempotencyKey,
        bookmarkId: pendingMutation.bookmarkId,
        code: "FORBIDDEN",
        message: "User is not allowed to modify this bookmark",
      },
    ],
    cursor: "12",
  });
  const coordinator = new OfflineLibrarySyncCoordinator(client);
  coordinator.activate("user-1");

  await coordinator.syncNow();

  expect(coordinator.getStatus()).toEqual({
    kind: "rejected",
    pendingWrites: 0,
    rejectionCount: 1,
  });
  await expect(
    offlineLibraryDb.rejections.get(pendingMutation.idempotencyKey),
  ).resolves.toMatchObject({
    message: "User is not allowed to modify this bookmark",
  });

  await coordinator.discardRejectedMutation(pendingMutation.idempotencyKey);

  expect(coordinator.getStatus()).toMatchObject({ kind: "online" });
  expect(client.snapshot).toHaveBeenCalledOnce();
  await expect(offlineLibraryDb.rejections.count()).resolves.toBe(0);
});

test("keeps pending mutations bound to their authenticated principal", async () => {
  await replaceSnapshot(snapshot, "user-1");
  await enqueueMutation(pendingMutation, "user-1");
  await expect(
    offlineLibraryDb.outbox.get(pendingMutation.idempotencyKey),
  ).resolves.toMatchObject({
    ownerUserId: "user-1",
  });

  await expect(listPendingMutations("user-2")).resolves.toHaveLength(0);
});

test("takes a snapshot instead of reusing another principal's cursor", async () => {
  await replaceSnapshot(snapshot, "user-1");
  await offlineLibraryDb.metadata.put({
    key: "replicaOwnerUserId",
    value: "user-1",
  });
  await enqueueMutation(pendingMutation, "user-1");
  const client = makeClient();
  const coordinator = new OfflineLibrarySyncCoordinator(client);
  coordinator.activate("user-2");

  await coordinator.syncNow();

  expect(client.snapshot).toHaveBeenCalledOnce();
  expect(client.pull).not.toHaveBeenCalled();
  expect(client.push).not.toHaveBeenCalled();
  await expect(offlineLibraryDb.outbox.count()).resolves.toBe(0);
});

test("preserves a conflict status when connectivity is lost", async () => {
  await replaceSnapshot(snapshot, "user-1");
  await enqueueMutation(pendingMutation, "user-1");
  const client = makeClient();
  vi.mocked(client.push).mockResolvedValueOnce({
    ...acknowledgedPush,
    acknowledged: [],
    conflicts: [
      {
        bookmarkId: bookmark.id,
        field: "title",
        localValue: "Updated offline",
        serverValue: "Updated on server",
        serverVersion: 1,
      },
    ],
  });
  const coordinator = new OfflineLibrarySyncCoordinator(client);
  coordinator.activate("user-1");

  await coordinator.syncNow();
  await coordinator.markOffline();

  expect(coordinator.getStatus()).toMatchObject({
    kind: "conflict",
    conflictCount: 1,
  });
});

test("evicts thumbnails after storage usage crosses the quota threshold", async () => {
  await offlineLibraryDb.thumbnailAccess.put({
    url: "/api/assets/thumbnail",
    lastAccessedAt: Date.now(),
  });
  const originalStorage = navigator.storage;
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: {
      estimate: vi
        .fn()
        .mockResolvedValueOnce({ usage: 80, quota: 100 })
        .mockResolvedValueOnce({ usage: 79, quota: 100 }),
    },
  });
  const client = makeClient();
  const coordinator = new OfflineLibrarySyncCoordinator(client);

  await coordinator.afterThumbnailCacheWrite();

  await expect(offlineLibraryDb.thumbnailAccess.count()).resolves.toBe(0);
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: originalStorage,
  });
});
