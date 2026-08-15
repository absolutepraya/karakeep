import { describe, expect, test } from "vitest";

import type { ZBookmark } from "../types/bookmarks";
import { BookmarkTypes } from "../types/bookmarks";
import {
  getBookmarkRefreshInterval,
  isBookmarkStillLoading,
} from "./bookmarkUtils";

function linkBookmark(overrides: {
  crawlStatus?: "pending" | "success" | "failure" | null;
  crawledAt?: Date | null;
  taggingStatus?: "pending" | "success" | "failure" | null;
  summarizationStatus?: "pending" | "success" | "failure" | null;
}): ZBookmark {
  return {
    id: "bookmark-1",
    userId: "user-1",
    title: null,
    archived: false,
    favourited: false,
    note: null,
    summary: null,
    createdAt: new Date(),
    modifiedAt: new Date(),
    taggingStatus: overrides.taggingStatus ?? null,
    summarizationStatus: overrides.summarizationStatus ?? null,
    embeddingStatus: null,
    tags: [],
    assets: [],
    content: {
      type: BookmarkTypes.LINK,
      id: "bookmark-1",
      url: "https://example.com",
      title: "Example",
      description: "Example description",
      imageUrl: "https://example.com/og.jpg",
      imageAssetId: "image-asset",
      screenshotAssetId: null,
      favicon: null,
      htmlContent: "<p>Readable content</p>",
      contentAssetId: null,
      crawledAt:
        "crawledAt" in overrides ? overrides.crawledAt : new Date(),
      crawlStatus: overrides.crawlStatus ?? "success",
      crawlStatusCode: 200,
      author: null,
      publisher: null,
      datePublished: null,
      dateModified: null,
    },
  } as unknown as ZBookmark;
}

describe("bookmark loading semantics", () => {
  test("a core-ready link is not loading while AI enrichment is pending", () => {
    const bookmark = linkBookmark({
      crawlStatus: "success",
      taggingStatus: "pending",
      summarizationStatus: "pending",
    });

    expect(isBookmarkStillLoading(bookmark)).toBe(false);
    expect(getBookmarkRefreshInterval(bookmark)).toBe(false);
  });

  test("persisted core content is ready before the crawler job fully completes", () => {
    const bookmark = linkBookmark({
      crawlStatus: "pending",
      crawledAt: new Date(),
      taggingStatus: "pending",
      summarizationStatus: "pending",
    });

    expect(isBookmarkStillLoading(bookmark)).toBe(false);
    expect(getBookmarkRefreshInterval(bookmark)).toBe(false);
  });

  test("a link is still loading while its core crawl is pending", () => {
    const bookmark = linkBookmark({
      crawlStatus: "pending",
      crawledAt: null,
      taggingStatus: "pending",
      summarizationStatus: "pending",
    });

    expect(isBookmarkStillLoading(bookmark)).toBe(true);
    expect(getBookmarkRefreshInterval(bookmark)).toBe(1000);
  });
});
