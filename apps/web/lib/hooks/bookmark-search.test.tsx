// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { ZBookmark } from "@karakeep/shared/types/bookmarks";

import { useLocalBookmarkSearch } from "./bookmark-search";

const mocks = vi.hoisted(() => ({
  liveQuerySubscribers: [] as {
    next: (value: unknown) => void;
    error: (reason: unknown) => void;
  }[],
  searchBookmarks: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/search",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("q=offline"),
}));

vi.mock("@/lib/offline-library/repository", () => ({
  searchBookmarks: mocks.searchBookmarks,
}));

vi.mock("dexie", () => ({
  liveQuery: (query: () => Promise<unknown>) => ({
    subscribe: (subscriber: {
      next: (value: unknown) => void;
      error: (reason: unknown) => void;
    }) => {
      mocks.liveQuerySubscribers.push(subscriber);
      void query().then(subscriber.next, subscriber.error);
      return {
        unsubscribe: () => {
          const index = mocks.liveQuerySubscribers.indexOf(subscriber);
          if (index >= 0) {
            mocks.liveQuerySubscribers.splice(index, 1);
          }
        },
      };
    },
  }),
}));

afterEach(() => {
  mocks.liveQuerySubscribers.length = 0;
  mocks.searchBookmarks.mockReset();
});

test("refreshes local search results after an optimistic replica write", async () => {
  mocks.searchBookmarks.mockResolvedValue([
    { id: "bookmark-1", title: "Before edit" } as ZBookmark,
  ]);

  const { result } = renderHook(() => useLocalBookmarkSearch());

  await waitFor(() => {
    expect(result.current.data?.pages[0]?.bookmarks[0]?.title).toBe(
      "Before edit",
    );
  });
  mocks.liveQuerySubscribers[0]?.next([
    { id: "bookmark-1", title: "Edited offline" } as ZBookmark,
  ]);

  await waitFor(() => {
    expect(result.current.data?.pages[0]?.bookmarks[0]?.title).toBe(
      "Edited offline",
    );
  });
});
