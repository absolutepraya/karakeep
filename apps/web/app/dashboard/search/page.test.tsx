// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OfflineLibraryStatus } from "@/lib/offline-library/sync";

const mocks = vi.hoisted(() => ({
  status: {
    kind: "online",
    lastSyncedAt: new Date(),
    pendingWrites: 0,
  } as OfflineLibraryStatus,
  useLocalBookmarkSearch: vi.fn(),
  useServerBookmarkSearch: vi.fn(),
}));

vi.mock("@/lib/hooks/bookmark-search", () => ({
  useLocalBookmarkSearch: mocks.useLocalBookmarkSearch,
  useServerBookmarkSearch: mocks.useServerBookmarkSearch,
}));

vi.mock("@/lib/offline-library/provider", () => ({
  useOfflineLibraryStatus: () => mocks.status,
}));

vi.mock("@/lib/store/useInSearchPageStore", () => ({
  useInSearchPageStore: () => ({ setInSearchPage: vi.fn() }),
}));

vi.mock("@/lib/store/useSortOrderStore", () => ({
  useSortOrderStore: () => ({ setSortOrder: vi.fn() }),
}));
vi.mock("@/components/dashboard/bookmarks/BookmarksGrid", () => ({
  default: ({ bookmarks }: { bookmarks: { id: string }[] }) => (
    <div>
      {bookmarks.map((bookmark) => (
        <span key={bookmark.id}>{bookmark.id}</span>
      ))}
    </div>
  ),
}));

vi.mock("@/components/dashboard/bookmarks/BookmarksGridSkeleton", () => ({
  default: () => <div>Loading</div>,
}));

import SearchPage from "./page";

const emptySearch = {
  data: { pages: [{ bookmarks: [] }] },
  hasNextPage: false,
  fetchNextPage: vi.fn(),
  isFetchingNextPage: false,
};

afterEach(() => {
  mocks.status = {
    kind: "online",
    lastSyncedAt: new Date(),
    pendingWrites: 0,
  };
  mocks.useLocalBookmarkSearch.mockReset();
  mocks.useServerBookmarkSearch.mockReset();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

describe("SearchPage", () => {
  it("does not create a server search after switching offline", () => {
    mocks.useServerBookmarkSearch.mockReturnValue({
      ...emptySearch,
      data: { pages: [{ bookmarks: [{ id: "server-result" }] }] },
    });
    mocks.useLocalBookmarkSearch.mockReturnValue({
      ...emptySearch,
      data: { pages: [{ bookmarks: [{ id: "local-result" }] }] },
    });

    const view = render(<SearchPage />);
    expect(screen.getByText("server-result")).toBeTruthy();
    expect(mocks.useServerBookmarkSearch).toHaveBeenCalledTimes(1);

    mocks.status = {
      kind: "offline",
      lastSyncedAt: new Date(),
      pendingWrites: 0,
    };
    view.rerender(<SearchPage />);

    expect(screen.getByText("local-result")).toBeTruthy();
    expect(mocks.useServerBookmarkSearch).toHaveBeenCalledTimes(1);
    expect(mocks.useLocalBookmarkSearch).toHaveBeenCalledTimes(1);
  });
});
