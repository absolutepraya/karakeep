import { describe, expect, test } from "vitest";

import { zOfflineSyncPushInputSchema } from "@karakeep/shared/types/offlineSync";

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
});
