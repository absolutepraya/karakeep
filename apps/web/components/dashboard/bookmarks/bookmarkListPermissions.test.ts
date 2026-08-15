import { describe, expect, test } from "vitest";

import { canRemoveBookmarkFromList } from "./bookmarkListPermissions";

describe("bookmark list action permissions", () => {
  test("viewer cannot remove a bookmark even when they own it", () => {
    expect(
      canRemoveBookmarkFromList({
        listId: "list",
        listType: "manual",
        userRole: "viewer",
      }),
    ).toBe(false);
  });

  test("editor and owner can remove from a manual list", () => {
    for (const userRole of ["editor", "owner"] as const) {
      expect(
        canRemoveBookmarkFromList({
          listId: "list",
          listType: "manual",
          userRole,
        }),
      ).toBe(true);
    }
  });

  test("remove action requires a manual list context", () => {
    expect(
      canRemoveBookmarkFromList({
        listId: undefined,
        listType: "manual",
        userRole: "editor",
      }),
    ).toBe(false);
    expect(
      canRemoveBookmarkFromList({
        listId: "smart",
        listType: "smart",
        userRole: "editor",
      }),
    ).toBe(false);
  });
});
