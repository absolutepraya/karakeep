import { describe, expect, it } from "vitest";

import { buildMeiliIndexName } from "./meiliIndexName";

describe("buildMeiliIndexName", () => {
  it("keeps existing index names when no prefix is configured", () => {
    expect(buildMeiliIndexName("bookmarks")).toBe("bookmarks");
    expect(buildMeiliIndexName("bookmarks_vectors", "")).toBe(
      "bookmarks_vectors",
    );
  });

  it("prefixes search and vector indexes consistently", () => {
    expect(buildMeiliIndexName("bookmarks", "issue-123_")).toBe(
      "issue-123_bookmarks",
    );
    expect(buildMeiliIndexName("bookmarks_vectors", "issue-123_")).toBe(
      "issue-123_bookmarks_vectors",
    );
  });
});
