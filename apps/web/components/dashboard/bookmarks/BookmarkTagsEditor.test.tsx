// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookmarkTypes } from "@karakeep/shared/types/bookmarks";

import { BookmarkTagsEditor } from "./BookmarkTagsEditor";

vi.mock("@/components/ui/sonner", () => ({ toast: vi.fn() }));
vi.mock("@/lib/hooks/useOfflineSafeBookmarkMutation", () => ({
  isOfflineQueuedMutation: () => false,
  useOfflineSafeBookmarkTags: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("./TagsEditor", () => ({
  TagsEditor: ({ allowCreation }: { allowCreation: boolean }) => (
    <p>{allowCreation ? "Tag creation enabled" : "Tag creation disabled"}</p>
  ),
}));

describe("BookmarkTagsEditor", () => {
  it("keeps inline tag creation available while offline", () => {
    render(
      <BookmarkTagsEditor
        bookmark={{
          id: "bookmark-1",
          createdAt: new Date(),
          modifiedAt: null,
          title: null,
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
          assets: [],
          content: { type: BookmarkTypes.TEXT, text: "Offline note" },
        }}
      />,
    );

    expect(screen.getByText("Tag creation enabled")).toBeTruthy();
  });
});
