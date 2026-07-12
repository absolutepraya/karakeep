import "fake-indexeddb/auto";

import { afterEach, beforeEach, expect, test } from "vitest";

import { BookmarkTypes, type ZBookmark } from "@karakeep/shared/types/bookmarks";
import type {
  ZOfflineSyncEvent,
  ZOfflineSyncMutation,
  ZOfflineSyncSnapshot,
} from "@karakeep/shared/types/offlineSync";

import {
  applyEvents,
  enqueueMutation,
  evictLeastRecentlyUsedThumbnails,
  offlineLibraryDb,
  purgeOfflineLibrary,
  queryBookmarks,
  recordThumbnailAccess,
  replaceSnapshot,
  listPendingMutations,
  searchBookmarks,
} from "./repository";

const thumbnailCaches = new Map<string, Map<string, Response>>();

Object.defineProperty(globalThis, "caches", {
  configurable: true,
  value: {
    async delete(name: string) {
      return thumbnailCaches.delete(name);
    },
    async open(name: string) {
      const entries = thumbnailCaches.get(name) ?? new Map<string, Response>();
      thumbnailCaches.set(name, entries);
      return {
        async delete(url: string) {
          return entries.delete(url);
        },
      };
    },
  },
});

const bookmark = (overrides: Partial<ZBookmark> = {}): ZBookmark => ({
  id: "bookmark-1",
  createdAt: new Date("2026-07-10T00:00:00Z"),
  modifiedAt: null,
  title: "Offline article",
  archived: false,
  favourited: false,
  taggingStatus: null,
  summarizationStatus: null,
  embeddingStatus: null,
  note: "airplane",
  summary: null,
  source: "web",
  userId: "user-1",
  tags: [{ id: "tag-1", name: "Travel", attachedBy: "human" }],
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
    htmlContent: "private archive content",
    contentAssetId: null,
    crawledAt: null,
    crawlStatus: null,
    author: null,
    publisher: null,
    datePublished: null,
    dateModified: null,
  },
  assets: [],
  ...overrides,
});

const snapshotWith = (overrides: Partial<ZBookmark> = {}): ZOfflineSyncSnapshot => ({
  bookmarks: [bookmark(overrides)],
  lists: [],
  cursor: "12",
});

const snapshot = snapshotWith();

const pendingMutation: ZOfflineSyncMutation = {
  idempotencyKey: "e7da6e68-4b45-4f56-aa6f-bd0c0fbbc6b8",
  kind: "bookmark.update",
  bookmarkId: "bookmark-1",
  fields: { title: "Updated offline" },
  baseVersions: { title: 0 },
};

beforeEach(async () => {
  await offlineLibraryDb.delete();
  await offlineLibraryDb.open();
  thumbnailCaches.clear();
});

afterEach(async () => {
  await offlineLibraryDb.delete();
  thumbnailCaches.clear();
});

test("replaces a snapshot atomically and preserves its cursor", async () => {
  await replaceSnapshot(snapshot);

  await expect(queryBookmarks({ archived: false })).resolves.toMatchObject({
    cursor: snapshot.cursor,
    bookmarks: [{ id: "bookmark-1" }],
  });
});

test("searches only replicated fields", async () => {
  await replaceSnapshot(snapshotWith({ title: "Offline article", note: "airplane" }));

  await expect(searchBookmarks("airplane")).resolves.toMatchObject([
    { id: "bookmark-1" },
  ]);
  await expect(searchBookmarks("private archive")).resolves.toEqual([]);
});

test("purge removes every user-scoped table", async () => {
  await replaceSnapshot(snapshot);
  await enqueueMutation(pendingMutation);
  await purgeOfflineLibrary();

  await expect(offlineLibraryDb.bookmarks.count()).resolves.toBe(0);
  await expect(offlineLibraryDb.outbox.count()).resolves.toBe(0);
});

test("evicts the oldest thumbnail records before bookmark metadata", async () => {
  await replaceSnapshot(snapshot);
  await recordThumbnailAccess("/api/assets/old", new Date("2026-07-11T00:00:00Z"));
  await recordThumbnailAccess("/api/assets/new", new Date("2026-07-12T00:00:00Z"));
  await evictLeastRecentlyUsedThumbnails(1);

  await expect(caches.open("karakeep-thumbnails")).resolves.toBeDefined();
  await expect(offlineLibraryDb.bookmarks.count()).resolves.toBe(1);
  await expect(offlineLibraryDb.thumbnailAccess.toArray()).resolves.toEqual([
    { url: "/api/assets/new", lastAccessedAt: new Date("2026-07-12T00:00:00Z").getTime() },
  ]);
});

test("applies deletion events and advances the replica cursor together", async () => {
  const event: ZOfflineSyncEvent = {
    sequence: 13,
    userId: "user-1",
    entityType: "bookmark",
    entityId: "bookmark-1",
    operation: "delete",
    changedFields: [],
    createdAt: new Date("2026-07-13T00:00:00Z"),
  };
  await replaceSnapshot(snapshot);
  await applyEvents([event], "13");

  await expect(queryBookmarks()).resolves.toMatchObject({
    cursor: "13",
    bookmarks: [],
  });
});

test("queues supported mutations with the local bookmark update", async () => {
  await replaceSnapshot(snapshot);
  await enqueueMutation(pendingMutation);

  await expect(queryBookmarks()).resolves.toMatchObject({
    bookmarks: [{ title: "Updated offline" }],
  });
  await expect(listPendingMutations()).resolves.toMatchObject([
    { idempotencyKey: pendingMutation.idempotencyKey, kind: "bookmark.update" },
  ]);
});
