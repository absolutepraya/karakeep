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
    offset: number | null;
    anchor: string | null;
    percent: number | null;
  } | null>(null);
  const lastSavedOffset = useRef<number | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [restoreRequested, setRestoreRequested] = useState(false);

  useEffect(() => {
    setInitialProgress(null);
    lastSavedOffset.current = null;
    setBannerDismissed(false);
    setRestoreRequested(false);
  }, [bookmarkId]);

  useEffect(() => {
    if (readingProgressOffset === undefined) return;

    setInitialProgress(
      (current) =>
        current ?? {
          offset: readingProgressOffset ?? null,
          anchor: readingProgressAnchor ?? null,
          percent: readingProgressPercent ?? null,
        },
    );
  }, [readingProgressAnchor, readingProgressOffset, readingProgressPercent]);

  useEffect(() => {
    if (lastSavedOffset.current === null && initialProgress?.offset != null) {
      lastSavedOffset.current = initialProgress.offset;
    }
  }, [initialProgress]);

  const initialOffset = initialProgress?.offset ?? null;
  const initialAnchor = initialProgress?.anchor ?? null;
  const initialPercent = initialProgress?.percent ?? null;

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
      if (lastSavedOffset.current === position.offset) return;
      lastSavedOffset.current = position.offset;
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
        setBannerDismissed(true);
      }
    },
    [showBanner],
  );

  const onContinue = useCallback(() => {
    setRestoreRequested(true);
    setBannerDismissed(true);
  }, []);

  const onDismiss = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  return {
    // Banner
    showBanner,
    bannerPercent: initialPercent,
    onContinue,
    onDismiss,
    // ScrollProgressTracker props
    restorePosition: restoreRequested,
    readingProgressOffset: initialOffset,
    readingProgressAnchor: initialAnchor,
    onSavePosition,
    onScrollPositionChange,
  };
}
