// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ZGetBookmarksResponse } from "@karakeep/shared/types/bookmarks";

const mocks = vi.hoisted(() => ({
  status: {
    kind: "offline" as const,
    lastSyncedAt: new Date(),
    pendingWrites: 0,
  },
  queryBookmarks: vi.fn(),
  countBookmarks: vi.fn(),
  getBookmarks: vi.fn(),
  useInfiniteQuery: vi.fn(),
}));

vi.mock("@/lib/offline-library/provider", () => ({
  useOfflineLibraryStatus: () => mocks.status,
}));

vi.mock("@/lib/offline-library/repository", () => ({
  queryBookmarks: mocks.queryBookmarks,
  offlineLibraryDb: {
    bookmarks: { count: mocks.countBookmarks },
  },
}));

vi.mock("@/lib/store/useSortOrderStore", () => ({
  useSortOrderStore: () => "desc",
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: mocks.useInfiniteQuery,
}));

vi.mock("@karakeep/shared-react/trpc", () => ({
  useTRPC: () => ({
    bookmarks: {
      getBookmarks: {
        infiniteQueryOptions: mocks.getBookmarks,
      },
    },
  }),
}));

vi.mock("@karakeep/shared-react/hooks/bookmark-grid-context", () => ({
  BookmarkGridContextProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("@/components/dashboard/UploadDropzone", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("./BookmarksGrid", () => ({
  default: ({ bookmarks }: { bookmarks: Array<{ id: string }> }) => (
    <div>
      {bookmarks.map((bookmark) => (
        <span key={bookmark.id}>{bookmark.id}</span>
      ))}
    </div>
  ),
}));

import UpdatableBookmarksGrid from "./UpdatableBookmarksGrid";

const serverPage = {
  bookmarks: [],
  nextCursor: null,
} as ZGetBookmarksResponse;

afterEach(() => {
  mocks.status = {
    kind: "offline",
    lastSyncedAt: new Date(),
    pendingWrites: 0,
  };
  mocks.queryBookmarks.mockReset();
  mocks.countBookmarks.mockReset();
  mocks.getBookmarks.mockReset();
  mocks.useInfiniteQuery.mockReset();
});

describe("UpdatableBookmarksGrid", () => {
  it("renders the local replica while offline instead of calling getBookmarks", async () => {
    mocks.queryBookmarks.mockResolvedValue({
      bookmarks: [{ id: "cached-bookmark" }],
      cursor: "1",
      nextCursor: null,
    });
    mocks.countBookmarks.mockResolvedValue(1);

    render(
      <UpdatableBookmarksGrid query={{ archived: false }} bookmarks={serverPage} />,
    );

    expect(await screen.findByText("cached-bookmark")).toBeTruthy();
    expect(mocks.getBookmarks).not.toHaveBeenCalled();
  });
});
