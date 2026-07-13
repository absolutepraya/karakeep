import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOfflineLibraryStatus } from "@/lib/offline-library/provider";
import { searchBookmarks } from "@/lib/offline-library/repository";
import { useSortOrderStore } from "@/lib/store/useSortOrderStore";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import type { ZBookmark } from "@karakeep/shared/types/bookmarks";
import { useTRPC } from "@karakeep/shared-react/trpc";
import { parseSearchQuery } from "@karakeep/shared/searchQueryParser";

import { useInSearchPageStore } from "../store/useInSearchPageStore";

function useSearchQuery() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  const pathname = usePathname();
  const lastQuery = useRef(searchQuery);

  // Only update the effective search query when on the search page.
  // This prevents the query from resetting when intercepting routes
  // change the URL (e.g., opening a bookmark preview dialog).
  if (pathname.startsWith("/dashboard/search")) {
    lastQuery.current = searchQuery;
  }

  const effectiveQuery = lastQuery.current;
  const parsed = useMemo(
    () => parseSearchQuery(effectiveQuery),
    [effectiveQuery],
  );
  return { searchQuery: effectiveQuery, parsedSearchQuery: parsed };
}

export function useDoBookmarkSearch() {
  const router = useRouter();
  const { searchQuery, parsedSearchQuery } = useSearchQuery();
  const isInSearchPage = useInSearchPageStore((val) => val.inSearchPage);
  const timeoutId = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    return () => {
      clearTimeout(timeoutId.current ?? undefined);
    };
  }, [timeoutId]);

  const doSearch = (val: string) => {
    timeoutId.current = null;
    router.replace(`/dashboard/search?q=${encodeURIComponent(val)}`);
  };

  const debounceSearch = (val: string) => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }
    timeoutId.current = setTimeout(() => {
      doSearch(val);
    }, 10);
  };

  return {
    doSearch,
    debounceSearch,
    searchQuery,
    parsedSearchQuery,
    isInSearchPage,
  };
}

export function useBookmarkSearch() {
  const api = useTRPC();
  const { searchQuery } = useSearchQuery();
  const sortOrder = useSortOrderStore((state) => state.sortOrder);
  const status = useOfflineLibraryStatus();
  const isOffline = status.kind === "offline";
  const [localBookmarks, setLocalBookmarks] = useState<ZBookmark[] | null>(
    null,
  );
  const [localError, setLocalError] = useState<Error | null>(null);

  const {
    data,
    isPending,
    isPlaceholderData,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery(
    api.bookmarks.searchBookmarks.infiniteQueryOptions(
      {
        text: searchQuery,
        sortOrder,
      },
      {
        enabled: !isOffline,
        placeholderData: keepPreviousData,
        gcTime: 0,
        initialCursor: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );

  useEffect(() => {
    if (isOffline) {
      return;
    }
    refetch();
  }, [isOffline, refetch, sortOrder]);

  useEffect(() => {
    let cancelled = false;

    if (!isOffline) {
      setLocalBookmarks(null);
      setLocalError(null);
      return;
    }

    setLocalBookmarks(null);
    setLocalError(null);
    void searchBookmarks(searchQuery).then(
      (bookmarks) => {
        if (!cancelled) {
          setLocalBookmarks(bookmarks);
        }
      },
      (reason: unknown) => {
        if (!cancelled) {
          setLocalError(
            reason instanceof Error
              ? reason
              : new Error("Unable to search the offline library"),
          );
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [isOffline, searchQuery]);

  if (isOffline) {
    if (localError) {
      throw localError;
    }

    return {
      error: undefined,
      data:
        localBookmarks === null
          ? undefined
          : { pages: [{ bookmarks: localBookmarks }] },
      isPending: localBookmarks === null,
      isPlaceholderData: false,
      hasNextPage: false,
      fetchNextPage: () => Promise.resolve(),
      isFetchingNextPage: false,
    };
  }

  if (error) {
    throw error;
  }

  return {
    error,
    data,
    isPending,
    isPlaceholderData,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  };
}
