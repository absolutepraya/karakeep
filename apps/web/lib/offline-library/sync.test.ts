import "fake-indexeddb/auto";

import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { BookmarkTypes, type ZBookmark } from "@karakeep/shared/types/bookmarks";
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
  replaceSnapshot,
} from "./repository";
import { OfflineLibrarySyncCoordinator, type OfflineSyncClient } from "./sync";

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
  await replaceSnapshot(snapshot);
  const client = makeClient();
  vi.mocked(client.pull).mockRejectedValueOnce(new Error("captive portal"));
  const coordinator = new OfflineLibrarySyncCoordinator(client);

  await expect(coordinator.syncNow()).rejects.toThrow("captive portal");
  expect(coordinator.getStatus()).toMatchObject({ kind: "error" });
});

test("replays queued writes once, then applies the returned delta", async () => {
  await replaceSnapshot(snapshot);
  await enqueueMutation(pendingMutation);
  const client = makeClient();
  const coordinator = new OfflineLibrarySyncCoordinator(client);

  await coordinator.syncNow();

  expect(client.push).toHaveBeenCalledTimes(1);
  await expect(listPendingMutations()).resolves.toHaveLength(0);
});

test("takes an atomic snapshot before the first online state", async () => {
  const client = makeClient();
  const coordinator = new OfflineLibrarySyncCoordinator(client);

  await coordinator.syncNow();

  expect(client.snapshot).toHaveBeenCalledTimes(1);
  expect(coordinator.getStatus()).toMatchObject({ kind: "online", pendingWrites: 0 });
});

test("saves conflicts and prioritizes them over online status", async () => {
  await replaceSnapshot(snapshot);
  await enqueueMutation(pendingMutation);
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

  await coordinator.syncNow();

  expect(coordinator.getStatus()).toEqual({
    kind: "conflict",
    pendingWrites: 1,
    conflictCount: 1,
  });
});
