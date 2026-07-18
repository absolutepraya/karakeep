import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ReadingPosition } from "@karakeep/shared/utils/reading-progress-dom";

import { useTRPC } from "../trpc";

interface UseReadingProgressOptions {
  bookmarkId: string;
}

/**
 * Unified reading progress hook for web and mobile.
 *
 * Handles:
 * - Fetching reading progress via its own tRPC query
 * - Capturing initial reading position (stable across query re-fetches)
 * - "Continue reading" banner state and auto-dismiss on scroll past 15%
 * - Lazy saving via onSavePosition (idle, visibility change, unmount)
 * - Deduplication of save calls by offset
 *
 * Pass the returned `onSavePosition` and `onScrollPositionChange` to ScrollProgressTracker.
 */
export function useReadingProgress({ bookmarkId }: UseReadingProgressOptions) {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const { data: progressData } = useQuery(
    api.bookmarks.getReadingProgress.queryOptions({ bookmarkId }),
  );

  const readingProgressOffset = progressData?.readingProgressOffset;
  const readingProgressAnchor = progressData?.readingProgressAnchor;
  const readingProgressPercent = progressData?.readingProgressPercent;

  // Capture the first loaded progress value, then retain it across query
  // refetches. Effects keep render pure for concurrent React work.
  const [initialProgress, setInitialProgress] = useState<{
    bookmarkId: string;
    offset: number | null;
    anchor: string | null;
    percent: number | null;
  } | null>(null);
  const lastSavedPosition = useRef<{
    bookmarkId: string;
    offset: number;
  } | null>(null);
  const [bannerDismissedBookmarkId, setBannerDismissedBookmarkId] = useState<
    string | null
  >(null);
  const [restoreRequestedBookmarkId, setRestoreRequestedBookmarkId] = useState<
    string | null
  >(null);

  useEffect(() => {
    lastSavedPosition.current = null;
    setBannerDismissedBookmarkId(null);
    setRestoreRequestedBookmarkId(null);
  }, [bookmarkId]);

  useEffect(() => {
    if (readingProgressOffset === undefined) return;

    setInitialProgress((current) =>
      current?.bookmarkId === bookmarkId
        ? current
        : {
            bookmarkId,
            offset: readingProgressOffset ?? null,
            anchor: readingProgressAnchor ?? null,
            percent: readingProgressPercent ?? null,
          },
    );
  }, [
    bookmarkId,
    readingProgressAnchor,
    readingProgressOffset,
    readingProgressPercent,
  ]);

  useEffect(() => {
    if (
      initialProgress?.bookmarkId === bookmarkId &&
      initialProgress.offset != null &&
      lastSavedPosition.current?.bookmarkId !== bookmarkId
    ) {
      lastSavedPosition.current = {
        bookmarkId,
        offset: initialProgress.offset,
      };
    }
  }, [bookmarkId, initialProgress]);

  const activeInitialProgress =
    initialProgress?.bookmarkId === bookmarkId ? initialProgress : null;
  const initialOffset = activeInitialProgress?.offset ?? null;
  const initialAnchor = activeInitialProgress?.anchor ?? null;
  const initialPercent = activeInitialProgress?.percent ?? null;
  const bannerDismissed = bannerDismissedBookmarkId === bookmarkId;

  const showBanner =
    !!initialOffset &&
    initialOffset > 0 &&
    initialPercent != null &&
    initialPercent >= 10 &&
    initialPercent < 100 &&
    !bannerDismissed;

  // Save mutation
  const { mutate: updateProgress } = useMutation(
    api.bookmarks.updateReadingProgress.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          api.bookmarks.getReadingProgress.pathFilter(),
        );
      },
    }),
  );

  // Lazy save — called by ScrollProgressTracker on idle/visibility/beforeunload/unmount
  const onSavePosition = useCallback(
    (position: ReadingPosition) => {
      if (showBanner) return;
      if (
        lastSavedPosition.current?.bookmarkId === bookmarkId &&
        lastSavedPosition.current.offset === position.offset
      ) {
        return;
      }
      lastSavedPosition.current = { bookmarkId, offset: position.offset };
      updateProgress({
        bookmarkId,
        readingProgressOffset: position.offset,
        readingProgressAnchor: position.anchor,
        readingProgressPercent: position.percent,
      });
    },
    [bookmarkId, showBanner, updateProgress],
  );

  const onScrollPositionChange = useCallback(
    (position: ReadingPosition) => {
      if (showBanner && position.percent > 15) {
        setBannerDismissedBookmarkId(bookmarkId);
      }
    },
    [bookmarkId, showBanner],
  );

  const onContinue = useCallback(() => {
    setRestoreRequestedBookmarkId(bookmarkId);
    setBannerDismissedBookmarkId(bookmarkId);
  }, [bookmarkId]);

  const onDismiss = useCallback(() => {
    setBannerDismissedBookmarkId(bookmarkId);
  }, [bookmarkId]);

  return {
    // Banner
    showBanner,
    bannerPercent: initialPercent,
    onContinue,
    onDismiss,
    // ScrollProgressTracker props
    restorePosition: restoreRequestedBookmarkId === bookmarkId,
    readingProgressOffset: initialOffset,
    readingProgressAnchor: initialAnchor,
    onSavePosition,
    onScrollPositionChange,
  };
}
