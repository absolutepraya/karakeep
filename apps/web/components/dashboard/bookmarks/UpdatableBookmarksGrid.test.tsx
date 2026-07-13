// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ZGetBookmarksResponse } from "@karakeep/shared/types/bookmarks";
import type { OfflineLibraryStatus } from "@/lib/offline-library/sync";

declare global {
  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  }
}

const mocks = vi.hoisted(() => ({
  status: {
    kind: "offline",
    lastSyncedAt: new Date(),
    pendingWrites: 0,
  } as OfflineLibraryStatus,
  queryBookmarks: vi.fn(),
  countBookmarks: vi.fn(),
  isOfflineReplicaReady: vi.fn(),
  getBookmarks: vi.fn(),
  useInfiniteQuery: vi.fn(),
}));

vi.mock("@/lib/offline-library/provider", () => ({
  useOfflineLibraryStatus: () => mocks.status,
}));

vi.mock("@/lib/offline-library/repository", () => ({
  queryBookmarks: mocks.queryBookmarks,
  isOfflineReplicaReady: mocks.isOfflineReplicaReady,
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
  default: ({
    bookmarks,
    fetchNextPage,
  }: {
    bookmarks: Array<{ id: string }>;
    fetchNextPage: () => void;
  }) => (
    <div>
      {bookmarks.map((bookmark) => (
        <span key={bookmark.id}>{bookmark.id}</span>
      ))}
      <button type="button" onClick={fetchNextPage}>
        Load more
      </button>
    </div>
  ),
}));
import UpdatableBookmarksGrid from "./UpdatableBookmarksGrid";

const serverPage = {
  bookmarks: [],
  nextCursor: null,
} as ZGetBookmarksResponse;

afterEach(() => {
  cleanup();
  mocks.status = {
    kind: "offline",
    lastSyncedAt: new Date(),
    pendingWrites: 0,
  };
  mocks.queryBookmarks.mockReset();
  mocks.countBookmarks.mockReset();
  mocks.isOfflineReplicaReady.mockReset();
  mocks.getBookmarks.mockReset();
  mocks.useInfiniteQuery.mockReset();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

describe("UpdatableBookmarksGrid", () => {
  it("renders the local replica while offline instead of calling getBookmarks", async () => {
    mocks.queryBookmarks.mockResolvedValue({
      bookmarks: [{ id: "cached-bookmark" }],
      cursor: "1",
      nextCursor: null,
    });
    mocks.countBookmarks.mockResolvedValue(1);
    mocks.isOfflineReplicaReady.mockResolvedValue(true);

    render(
      <UpdatableBookmarksGrid query={{ archived: false }} bookmarks={serverPage} />,
    );

    expect(await screen.findByText("cached-bookmark")).toBeTruthy();
    expect(mocks.getBookmarks).not.toHaveBeenCalled();
  });

  it("uses the local unavailable state for a cold offline launch before constructing a server query", async () => {
    mocks.status = { kind: "initializing" };
    mocks.queryBookmarks.mockResolvedValue({
      bookmarks: [],
      cursor: null,
      nextCursor: null,
    });
    mocks.countBookmarks.mockResolvedValue(0);
    mocks.isOfflineReplicaReady.mockResolvedValue(false);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    render(
      <UpdatableBookmarksGrid query={{ archived: false }} bookmarks={serverPage} />,
    );

    expect(
      await screen.findByText(/offline library has not been downloaded/i),
    ).toBeTruthy();
    expect(mocks.getBookmarks).not.toHaveBeenCalled();
  });

  it("ignores a superseded local next page and keeps the new query cursor", async () => {
    const oldNextPage = Promise.withResolvers<{
      bookmarks: Array<{ id: string }>;
      cursor: string | null;
      nextCursor: { id: string; createdAt: Date } | null;
    }>();

    mocks.queryBookmarks.mockImplementation((query) => {
      if (query.archived === false && query.cursor === null) {
        return Promise.resolve({
          bookmarks: [{ id: "old-first" }],
          cursor: null,
          nextCursor: { id: "old-next", createdAt: new Date(1) },
        });
      }
      if (query.archived === false) {
        return oldNextPage.promise;
      }
      if (query.archived === true && query.cursor === null) {
        return Promise.resolve({
          bookmarks: [{ id: "new-first" }],
          cursor: null,
          nextCursor: { id: "new-next", createdAt: new Date(2) },
        });
      }
      return Promise.resolve({
        bookmarks: [{ id: "new-second" }],
        cursor: null,
        nextCursor: null,
      });
    });
    mocks.countBookmarks.mockResolvedValue(1);
    mocks.isOfflineReplicaReady.mockResolvedValue(true);

    const view = render(
      <UpdatableBookmarksGrid query={{ archived: false }} bookmarks={serverPage} />,
    );
    expect(await screen.findByText("old-first")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    view.rerender(
      <UpdatableBookmarksGrid query={{ archived: true }} bookmarks={serverPage} />,
    );
    expect(await screen.findByText("new-first")).toBeTruthy();
    oldNextPage.resolve({
      bookmarks: [{ id: "old-second" }],
      cursor: null,
      nextCursor: null,
    });
    await waitFor(() =>
      expect(screen.queryByText("old-second")).toBeNull(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("new-second")).toBeTruthy();
    expect(mocks.queryBookmarks).toHaveBeenLastCalledWith(
      expect.objectContaining({
        archived: true,
        cursor: { id: "new-next", createdAt: new Date(2) },
      }),
    );
  });

  it("retains SSR bookmarks while an empty local replica awaits online refresh", async () => {
    mocks.status = {
      kind: "online",
      lastSyncedAt: new Date(),
      pendingWrites: 0,
    };
    mocks.queryBookmarks.mockResolvedValue({
      bookmarks: [],
      cursor: null,
      nextCursor: null,
    });
    mocks.countBookmarks.mockResolvedValue(0);
    mocks.isOfflineReplicaReady.mockResolvedValue(false);
    mocks.useInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            bookmarks: [{ id: "server-bookmark" }],
            nextCursor: null,
          },
        ],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isFetchedAfterMount: false,
      refetch: vi.fn(),
    });

    render(
      <UpdatableBookmarksGrid query={{ archived: false }} bookmarks={serverPage} />,
    );

    expect(await screen.findByText("server-bookmark")).toBeTruthy();
  });
});
