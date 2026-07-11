import { describe, expect, it } from "vitest";

import type { ZBookmarkList } from "@karakeep/shared/types/lists";

import { resolveListParentId } from "./EditListModal";

describe("resolveListParentId", () => {
  it("uses the current folder for a new list created from a list page", () => {
    expect(
      resolveListParentId(
        undefined,
        undefined,
        "/dashboard/lists/gtl0i844at8scaotuhrkxs5t",
      ),
    ).toBe("gtl0i844at8scaotuhrkxs5t");
  });

  it("preserves an explicit parent or the parent of an edited list", () => {
    expect(
      resolveListParentId(
        undefined,
        { parentId: "explicit-parent" },
        "/dashboard/lists/current-folder",
      ),
    ).toBe("explicit-parent");

    expect(
      resolveListParentId(
        { parentId: null } as Pick<ZBookmarkList, "parentId">,
        undefined,
        "/dashboard/lists/current-folder",
      ),
    ).toBeNull();
  });

  it("keeps new lists at the root outside an individual list page", () => {
    expect(resolveListParentId(undefined, undefined, "/dashboard/lists")).toBe(
      undefined,
    );
  });
});
