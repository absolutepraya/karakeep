"use client";

import React, { useCallback, useEffect, useState, type ReactNode } from "react";
import UploadDropzone from "@/components/dashboard/UploadDropzone";
import { useOfflineLibraryStatus } from "@/lib/offline-library/provider";
import {
  offlineLibraryDb,
  queryBookmarks,
  type OfflineBookmarkQuery,
} from "@/lib/offline-library/repository";
import { useSortOrderStore } from "@/lib/store/useSortOrderStore";
import { useInfiniteQuery } from "@tanstack/react-query";

import type {
  ZGetBookmarksRequest,
  ZGetBookmarksResponse,
} from "@karakeep/shared/types/bookmarks";
import type { ZCursor } from "@karakeep/shared/types/pagination";
import { BookmarkGridContextProvider } from "@karakeep/shared-react/hooks/bookmark-grid-context";
import { useTRPC } from "@karakeep/shared-react/trpc";

import BookmarksGrid from "./BookmarksGrid";
import OfflineLibraryUnavailable from "./OfflineLibraryUnavailable";

type UpdatableBookmarksGridProps = {
  query: Omit<ZGetBookmarksRequest, "sortOrder" | "includeContent">;
  bookmarks: ZGetBookmarksResponse;
  showEditorCard?: boolean;
  itemsPerPage?: number;
};

type LocalBookmarkPagination = {
  bookmarks: ZGetBookmarksResponse["bookmarks"];
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  isLoaded: boolean;
  bookmarkCount: number;
};

function toOfflineQuery(
  query: Omit<ZGetBookmarksRequest, "sortOrder" | "includeContent">,
  sortOrder: "asc" | "desc",
): OfflineBookmarkQuery {
  return {
    archived: query.archived,
    favourited: query.favourited,
    tagId: query.tagId,
    listId: query.listId,
    cursor: query.cursor ?? null,
    limit: query.limit,
    sortOrder,
  };
}

function useLocalBookmarkPagination(
  query: OfflineBookmarkQuery,
  enabled: boolean,
): LocalBookmarkPagination {
  const [bookmarks, setBookmarks] = useState<
    ZGetBookmarksResponse["bookmarks"]
  >([]);
  const [nextCursor, setNextCursor] = useState<ZCursor | null>(null);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  const {
    archived,
    favourited,
    tagId,
    listId,
    cursor,
    limit,
    sortOrder,
  } = query;

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setBookmarks([]);
      setNextCursor(null);
      setBookmarkCount(0);
      setIsLoaded(false);
      return;
    }

    setIsLoaded(false);
    void Promise.all([
      queryBookmarks({
        archived,
        favourited,
        tagId,
        listId,
        cursor,
        limit,
        sortOrder,
      }),
      offlineLibraryDb.bookmarks.count(),
    ]).then(([page, count]) => {
      if (cancelled) {
        return;
      }
      setBookmarks(page.bookmarks);
      setNextCursor(page.nextCursor);
      setBookmarkCount(count);
      setIsLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [archived, cursor, enabled, favourited, limit, listId, sortOrder, tagId]);

  const fetchNextPage = useCallback(async () => {
    if (!enabled || !nextCursor || isFetchingNextPage) {
      return;
    }

    setIsFetchingNextPage(true);
    try {
      const page = await queryBookmarks({
        archived,
        favourited,
        tagId,
        listId,
        cursor: nextCursor,
        limit,
        sortOrder,
      });
      setBookmarks((currentBookmarks) => [
        ...currentBookmarks,
        ...page.bookmarks,
      ]);
      setNextCursor(page.nextCursor);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [
    archived,
    enabled,
    favourited,
    isFetchingNextPage,
    limit,
    listId,
    nextCursor,
    sortOrder,
    tagId,
  ]);

  return {
    bookmarks,
    hasNextPage: nextCursor !== null,
    fetchNextPage,
    isFetchingNextPage,
    isLoaded,
    bookmarkCount,
  };
}

function BookmarkGrid({
  bookmarks,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  showEditorCard,
}: Pick<
  LocalBookmarkPagination,
  "bookmarks" | "hasNextPage" | "fetchNextPage" | "isFetchingNextPage"
> & { showEditorCard: boolean }) {
  const grid = (
    <BookmarksGrid
      bookmarks={bookmarks}
      hasNextPage={hasNextPage}
      fetchNextPage={fetchNextPage}
      isFetchingNextPage={isFetchingNextPage}
      showEditorCard={showEditorCard}
    />
  );

  return showEditorCard ? <UploadDropzone>{grid}</UploadDropzone> : grid;
}

function OfflineBookmarksGrid({
  query,
  showEditorCard,
  lastSyncedAt,
}: Pick<UpdatableBookmarksGridProps, "query"> & {
  showEditorCard: boolean;
  lastSyncedAt: Date | null;
}) {
  let sortOrder = useSortOrderStore((state) => state.sortOrder);
  if (sortOrder === "relevance") {
    sortOrder = "desc";
  }
  const local = useLocalBookmarkPagination(
    toOfflineQuery(query, sortOrder),
    true,
  );

  if (lastSyncedAt === null && local.isLoaded && local.bookmarkCount === 0) {
    return <OfflineLibraryUnavailable />;
  }

  return <BookmarkGrid {...local} showEditorCard={showEditorCard} />;
}

function OnlineBookmarksGrid({
  query,
  initialBookmarks,
  showEditorCard,
}: Pick<UpdatableBookmarksGridProps, "query"> & {
  initialBookmarks: ZGetBookmarksResponse;
  showEditorCard: boolean;
}) {
  const api = useTRPC();
  let sortOrder = useSortOrderStore((state) => state.sortOrder);
  if (sortOrder === "relevance") {
    // Relevance is not supported in the `getBookmarks` endpoint.
    sortOrder = "desc";
  }

  const finalQuery = { ...query, sortOrder, includeContent: false };
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchedAfterMount,
    refetch,
  } = useInfiniteQuery(
    api.bookmarks.getBookmarks.infiniteQueryOptions(
      { ...finalQuery, useCursorV2: true },
      {
        initialData: () => ({
          pages: [initialBookmarks],
          pageParams: [query.cursor ?? null],
        }),
        initialCursor: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        refetchOnMount: true,
      },
    ),
  );
  const local = useLocalBookmarkPagination(
    toOfflineQuery(query, sortOrder),
    true,
  );

  useEffect(() => {
    refetch();
  }, [sortOrder, refetch]);

  const serverBookmarks = data.pages.flatMap((page) => page.bookmarks);
  const useLocalBookmarks = local.isLoaded && !isFetchedAfterMount;

  return (
    <BookmarkGrid
      bookmarks={useLocalBookmarks ? local.bookmarks : serverBookmarks}
      hasNextPage={
        useLocalBookmarks ? local.hasNextPage : (hasNextPage ?? false)
      }
      fetchNextPage={
        useLocalBookmarks ? local.fetchNextPage : fetchNextPage
      }
      isFetchingNextPage={
        useLocalBookmarks
          ? local.isFetchingNextPage
          : (isFetchingNextPage ?? false)
      }
      showEditorCard={showEditorCard}
    />
  );
}

export default function UpdatableBookmarksGrid({
  query,
  bookmarks: initialBookmarks,
  showEditorCard = false,
}: UpdatableBookmarksGridProps) {
  const status = useOfflineLibraryStatus();
  let content: ReactNode;

  if (status.kind === "offline") {
    content = (
      <OfflineBookmarksGrid
        query={query}
        showEditorCard={showEditorCard}
        lastSyncedAt={status.lastSyncedAt}
      />
    );
  } else {
    content = (
      <OnlineBookmarksGrid
        query={query}
        initialBookmarks={initialBookmarks}
        showEditorCard={showEditorCard}
      />
    );
  }

  let sortOrder = useSortOrderStore((state) => state.sortOrder);
  if (sortOrder === "relevance") {
    sortOrder = "desc";
  }
  const finalQuery = { ...query, sortOrder, includeContent: false };

  return (
    <BookmarkGridContextProvider query={finalQuery}>
      {content}
    </BookmarkGridContextProvider>
  );
}
