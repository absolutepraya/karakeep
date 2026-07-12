import "fake-indexeddb/auto";

import { afterEach, expect, test } from "vitest";

import { offlineLibraryDb } from "./schema";

afterEach(async () => {
  await offlineLibraryDb.delete();
});

test("defines every offline-library table", async () => {
  await offlineLibraryDb.open();

  expect(offlineLibraryDb.tables.map((table) => table.name).sort()).toEqual([
    "bookmarks",
    "conflicts",
    "lists",
    "metadata",
    "outbox",
    "thumbnailAccess",
  ]);
});
