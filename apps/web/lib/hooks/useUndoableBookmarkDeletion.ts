import { useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/client";
import usePendingBookmarkDeletionStore from "@/lib/store/usePendingBookmarkDeletionStore";

import { useDeleteBookmark } from "@karakeep/shared-react/hooks/bookmarks";

const UNDO_DELETE_DURATION = 5_000;

export function useUndoableBookmarkDeletion() {
  const { t } = useTranslation();
  const { mutateAsync: deleteBookmark } = useDeleteBookmark();
  const markPending = usePendingBookmarkDeletionStore(
    (state) => state.markPending,
  );
  const clearPending = usePendingBookmarkDeletionStore(
    (state) => state.clearPending,
  );
  const pendingBookmarkIds = usePendingBookmarkDeletionStore(
    (state) => state.pendingBookmarkIds,
  );

  const scheduleDeletes = useCallback(
    (bookmarkIds: string[]) => {
      const deletableBookmarkIds = bookmarkIds.filter(
        (bookmarkId) => !pendingBookmarkIds.includes(bookmarkId),
      );
      if (deletableBookmarkIds.length === 0) {
        return;
      }

      deletableBookmarkIds.forEach(markPending);
      let resolved = false;

      const commitDelete = () => {
        if (resolved) {
          return;
        }
        resolved = true;

        void Promise.allSettled(
          deletableBookmarkIds.map((bookmarkId) =>
            deleteBookmark({ bookmarkId }),
          ),
        ).then((results) => {
          deletableBookmarkIds.forEach(clearPending);
          if (results.some((result) => result.status === "rejected")) {
            toast.error(t("common.something_went_wrong"));
          }
        });
      };

      toast(t("toasts.bookmarks.deleted"), {
        duration: UNDO_DELETE_DURATION,
        action: {
          label: t("actions.undo", { defaultValue: "Undo" }),
          onClick: () => {
            if (resolved) {
              return;
            }
            resolved = true;
            deletableBookmarkIds.forEach(clearPending);
            toast.success(
              t("toasts.bookmarks.restored", {
                defaultValue: "Bookmark restored",
              }),
            );
          },
        },
        onAutoClose: commitDelete,
        onDismiss: commitDelete,
      });
    },
    [clearPending, deleteBookmark, markPending, pendingBookmarkIds, t],
  );

  const scheduleDelete = useCallback(
    (bookmarkId: string) => scheduleDeletes([bookmarkId]),
    [scheduleDeletes],
  );

  return { scheduleDelete, scheduleDeletes, pendingBookmarkIds };
}

export { UNDO_DELETE_DURATION };
