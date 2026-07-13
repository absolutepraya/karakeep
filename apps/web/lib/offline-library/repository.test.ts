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
  getBookmarkFieldVersion,
  listPendingMutations,
  offlineLibraryDb,
  purgeOfflineLibrary,
  queryBookmarks,
  recordThumbnailAccess,
  replaceSnapshot,
  searchBookmarks,
} from "./repository";

const thumbnailCaches = new Map<string, Map<string, Response>>();

Object.defineProperty(globalThis, "caches", {
  configurable: true,
  value: {
    async keys() {
      return [...thumbnailCaches.keys()];
    },
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
  bookmarkListMemberships: [],
  bookmarkRssFeedMemberships: [],
  bookmarkFieldVersions: [
    { bookmarkId: "bookmark-1", field: "title", version: 0 },
    { bookmarkId: "bookmark-1", field: "tags", version: 0 },
  ],
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
  await replaceSnapshot(snapshot, "user-1");

  await expect(queryBookmarks({ archived: false })).resolves.toMatchObject({
    cursor: snapshot.cursor,
    bookmarks: [{ id: "bookmark-1" }],
  });
  await expect(getBookmarkFieldVersion("bookmark-1", "title")).resolves.toBe(0);
  await expect(getBookmarkFieldVersion("bookmark-1", "note")).resolves.toBeUndefined();
});

test("searches only replicated fields", async () => {
  await replaceSnapshot(snapshotWith({ title: "Offline article", note: "airplane" }), "user-1");

  await expect(searchBookmarks("airplane")).resolves.toMatchObject([
    { id: "bookmark-1" },
  ]);
  await expect(searchBookmarks("private archive")).resolves.toEqual([]);
});

test("filters by explicit membership and searches associated list names", async () => {
  const membershipSnapshot: ZOfflineSyncSnapshot = {
    ...snapshot,
    lists: [
      {
        id: "list-1",
        name: "Reading queue",
        description: null,
        icon: "folder",
        parentId: null,
        type: "manual",
        query: null,
        public: false,
        hasCollaborators: false,
        userRole: "owner",
      },
    ],
    bookmarkListMemberships: [{ bookmarkId: "bookmark-1", listId: "list-1" }],
  };
  await replaceSnapshot(membershipSnapshot, "user-1");

  await expect(queryBookmarks({ listId: "list-1" })).resolves.toMatchObject({
    bookmarks: [{ id: "bookmark-1" }],
  });
  await expect(searchBookmarks("reading queue")).resolves.toMatchObject([
    { id: "bookmark-1" },
  ]);
});

test("filters an offline RSS feed page to bookmarks imported from that feed", async () => {
  await replaceSnapshot(
    {
      ...snapshot,
      bookmarks: [
        bookmark({ id: "feed-bookmark", source: "rss" }),
        bookmark({ id: "unrelated-bookmark", source: "rss" }),
      ],
      bookmarkRssFeedMemberships: [
        { bookmarkId: "feed-bookmark", rssFeedId: "feed-1" },
        { bookmarkId: "unrelated-bookmark", rssFeedId: "feed-2" },
      ],
    },
    "user-1",
  );

  await expect(queryBookmarks({ rssFeedId: "feed-1" })).resolves.toMatchObject({
    bookmarks: [{ id: "feed-bookmark" }],
    nextCursor: null,
  });
});

test("purge removes every user-scoped table and its cached thumbnails", async () => {
  await replaceSnapshot(snapshot, "user-1");
  await enqueueMutation(pendingMutation, "user-1");
  await recordThumbnailAccess("/api/assets/private");
  thumbnailCaches.set(
    "karakeep-thumbnails",
    new Map([["/api/assets/private", new Response("private")]]),
  );
  await purgeOfflineLibrary();

  await expect(offlineLibraryDb.bookmarks.count()).resolves.toBe(0);
  await expect(offlineLibraryDb.outbox.count()).resolves.toBe(0);
  await expect(offlineLibraryDb.thumbnailAccess.count()).resolves.toBe(0);
  expect(thumbnailCaches.has("karakeep-thumbnails")).toBe(false);
});

test("evicts the oldest cached thumbnail before bookmark metadata", async () => {
  await replaceSnapshot(snapshot, "user-1");
  await recordThumbnailAccess("/api/assets/old", new Date("2026-07-11T00:00:00Z"));
  await recordThumbnailAccess("/api/assets/new", new Date("2026-07-12T00:00:00Z"));
  thumbnailCaches.set(
    "karakeep-thumbnails",
    new Map([
      ["/api/assets/old", new Response("old")],
      ["/api/assets/new", new Response("new")],
    ]),
  );
  await evictLeastRecentlyUsedThumbnails(1);

  expect(thumbnailCaches.get("karakeep-thumbnails")?.has("/api/assets/old")).toBe(false);
  expect(thumbnailCaches.get("karakeep-thumbnails")?.has("/api/assets/new")).toBe(true);
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
    fieldVersions: [],
    createdAt: new Date("2026-07-13T00:00:00Z"),
  };
  await replaceSnapshot(snapshot, "user-1");
  await applyEvents([event], "13");

  await expect(queryBookmarks()).resolves.toMatchObject({
    cursor: "13",
    bookmarks: [],
  });
});

test("replaces, applies, and removes bookmark field versions atomically", async () => {
  await replaceSnapshot(snapshot, "user-1");
  await applyEvents(
    [
      {
        sequence: 13,
        userId: "user-1",
        entityType: "bookmark",
        entityId: "bookmark-1",
        operation: "update",
        changedFields: ["title"],
        fieldVersions: [
          { bookmarkId: "bookmark-1", field: "title", version: 1 },
        ],
        createdAt: new Date("2026-07-13T00:00:00Z"),
      },
    ],
    "13",
  );
  await expect(getBookmarkFieldVersion("bookmark-1", "title")).resolves.toBe(1);

  await replaceSnapshot(
    {
      ...snapshot,
      bookmarkFieldVersions: [
        { bookmarkId: "bookmark-1", field: "note", version: 2 },
      ],
    },
    "user-1",
  );
  await expect(getBookmarkFieldVersion("bookmark-1", "title")).resolves.toBeUndefined();
  await expect(getBookmarkFieldVersion("bookmark-1", "note")).resolves.toBe(2);

  await applyEvents(
    [
      {
        sequence: 14,
        userId: "user-1",
        entityType: "bookmark",
        entityId: "bookmark-1",
        operation: "delete",
        changedFields: [],
        fieldVersions: [],
        createdAt: new Date("2026-07-13T00:00:00Z"),
      },
    ],
    "14",
  );
  await expect(getBookmarkFieldVersion("bookmark-1", "note")).resolves.toBeUndefined();
});

test("does not establish a replica cursor from an empty cold delta", async () => {
  await applyEvents([], "13");

  await expect(offlineLibraryDb.metadata.toArray()).resolves.toEqual([
    { key: "replicaState", value: "stale" },
  ]);
  await expect(queryBookmarks()).resolves.toMatchObject({
    cursor: null,
    bookmarks: [],
  });
});

test("does not establish a replica cursor from a deletion-only cold delta", async () => {
  await applyEvents(
    [
      {
        sequence: 13,
        userId: "user-1",
        entityType: "bookmark",
        entityId: "bookmark-1",
        operation: "delete",
        changedFields: [],
        fieldVersions: [],
        createdAt: new Date("2026-07-13T00:00:00Z"),
      },
    ],
    "13",
  );

  await expect(offlineLibraryDb.metadata.toArray()).resolves.toEqual([
    { key: "replicaState", value: "stale" },
  ]);
  await expect(queryBookmarks()).resolves.toMatchObject({
    cursor: null,
    bookmarks: [],
  });
});

test("preserves stale state across empty delta batches", async () => {
  const updateEvent: ZOfflineSyncEvent = {
    sequence: 13,
    userId: "user-1",
    entityType: "bookmark",
    entityId: "bookmark-1",
    operation: "update",
    changedFields: ["title"],
    fieldVersions: [],
    createdAt: new Date("2026-07-13T00:00:00Z"),
  };
  await replaceSnapshot(snapshot, "user-1");
  await applyEvents([updateEvent], "13");
  await applyEvents([], "14");

  await expect(offlineLibraryDb.metadata.get("replicaState")).resolves.toEqual({
    key: "replicaState",
    value: "stale",
  });
});

test("purges all replica data and thumbnails on list revocation", async () => {
  const revokeEvent: ZOfflineSyncEvent = {
    sequence: 13,
    userId: "user-1",
    entityType: "list",
    entityId: "list-1",
    operation: "revoke",
    changedFields: [],
    fieldVersions: [],
    createdAt: new Date("2026-07-13T00:00:00Z"),
  };
  await replaceSnapshot(snapshot, "user-1");
  await recordThumbnailAccess("/api/assets/revoked");
  thumbnailCaches.set(
    "karakeep-thumbnails:https://app.example/:v1",
    new Map([["/api/assets/revoked", new Response("revoked")]]),
  );
  await applyEvents([revokeEvent], "13");

  await expect(offlineLibraryDb.bookmarks.count()).resolves.toBe(0);
  await expect(offlineLibraryDb.thumbnailAccess.count()).resolves.toBe(0);
  expect(
    thumbnailCaches.has("karakeep-thumbnails:https://app.example/:v1"),
  ).toBe(false);
});

test("queues supported mutations with the local bookmark update", async () => {
  await replaceSnapshot(snapshot, "user-1");
  await enqueueMutation(pendingMutation, "user-1");

  await expect(queryBookmarks()).resolves.toMatchObject({
    bookmarks: [{ title: "Updated offline" }],
  });
  await expect(listPendingMutations("user-1")).resolves.toMatchObject([
    { idempotencyKey: pendingMutation.idempotencyKey, kind: "bookmark.update" },
  ]);
});

test("queues tag mutations with the optimistic local tag set", async () => {
  const tagMutation: ZOfflineSyncMutation = {
    idempotencyKey: "b72a6d48-2d46-4f3a-8a85-650c2f4dcbd1",
    kind: "bookmark.tags",
    bookmarkId: "bookmark-1",
    tagIds: ["tag-2"],
    baseVersions: { tags: 0 },
  };
  await replaceSnapshot(snapshot, "user-1");
  await enqueueMutation(tagMutation, "user-1");

  await expect(queryBookmarks()).resolves.toMatchObject({
    bookmarks: [{ tags: [{ id: "tag-2" }] }],
  });
  await expect(listPendingMutations("user-1")).resolves.toMatchObject([
    { idempotencyKey: tagMutation.idempotencyKey, kind: "bookmark.tags" },
  ]);
});

test("rejects unsupported mutations before changing the replica", async () => {
  await replaceSnapshot(snapshot, "user-1");

  await expect(
    enqueueMutation({
      idempotencyKey: "d2436c5e-5a6e-4fb1-9eb0-c1d57fb5a47d",
      kind: "bookmark.delete",
      bookmarkId: "bookmark-1",
    } as unknown as ZOfflineSyncMutation, "user-1"),
  ).rejects.toThrow("Unsupported offline mutation");
  await expect(offlineLibraryDb.outbox.count()).resolves.toBe(0);
  await expect(queryBookmarks()).resolves.toMatchObject({
    bookmarks: [{ title: "Offline article" }],
  });
});
