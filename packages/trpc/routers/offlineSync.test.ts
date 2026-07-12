import { describe, expect, test } from "vitest";

import {
  zOfflineSyncPullInputSchema,
  zOfflineSyncPushInputSchema,
} from "@karakeep/shared/types/offlineSync";

describe("offline sync contracts", () => {
  test("accepts a field-versioned bookmark update", () => {
    expect(
      zOfflineSyncPushInputSchema.parse({
        mutations: [
          {
            idempotencyKey: "0a42a35d-afe8-4b34-91ba-1ca4767c1fe0",
            bookmarkId: "bookmark-1",
            kind: "bookmark.update",
            fields: { title: "Read later" },
            baseVersions: { title: 7 },
          },
        ],
      }).mutations[0].kind,
    ).toBe("bookmark.update");
  });

  test("rejects uploads and destructive operations", () => {
    expect(() =>
      zOfflineSyncPushInputSchema.parse({
        mutations: [{ idempotencyKey: "x", kind: "bookmark.delete" }],
      }),
    ).toThrow();
  });
  test("accepts a versioned bookmark tag update", () => {
    expect(
      zOfflineSyncPushInputSchema.parse({
        mutations: [
          {
            idempotencyKey: "2d068a43-97e4-4417-9ca3-202fd12415d5",
            bookmarkId: "bookmark-1",
            kind: "bookmark.tags",
            tagIds: ["tag-1"],
            baseVersions: { tags: 3 },
          },
        ],
      }).mutations[0].kind,
    ).toBe("bookmark.tags");
  });

  test("rejects an update without changed fields", () => {
    expect(() =>
      zOfflineSyncPushInputSchema.parse({
        mutations: [
          {
            idempotencyKey: "e6fa59f6-f45d-43a0-9284-08f6c245e07e",
            bookmarkId: "bookmark-1",
            kind: "bookmark.update",
            fields: {},
            baseVersions: {},
          },
        ],
      }),
    ).toThrow();
  });

  test("rejects invalid idempotency keys and cursors", () => {
    expect(() =>
      zOfflineSyncPushInputSchema.parse({
        mutations: [
          {
            idempotencyKey: "not-a-uuid",
            bookmarkId: "bookmark-1",
            kind: "bookmark.tags",
            tagIds: [],
            baseVersions: { tags: 0 },
          },
        ],
      }),
    ).toThrow();
    expect(() => zOfflineSyncPullInputSchema.parse({ cursor: "-1" })).toThrow();
  });

  test("requires base versions for exactly the changed bookmark fields", () => {
    const mutation = {
      idempotencyKey: "4e50ebfa-8859-48d5-b9a4-dfe8324b85ae",
      bookmarkId: "bookmark-1",
      kind: "bookmark.update" as const,
      fields: { title: "Read later" },
    };

    expect(() =>
      zOfflineSyncPushInputSchema.parse({
        mutations: [{ ...mutation, baseVersions: {} }],
      }),
    ).toThrow();
    expect(() =>
      zOfflineSyncPushInputSchema.parse({
        mutations: [{ ...mutation, baseVersions: { title: 7, note: 2 } }],
      }),
    ).toThrow();
  });
});
