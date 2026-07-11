import { create } from "zustand";

interface PendingBookmarkDeletionState {
  pendingBookmarkIds: string[];
  markPending: (bookmarkId: string) => void;
  clearPending: (bookmarkId: string) => void;
}

const usePendingBookmarkDeletionStore = create<PendingBookmarkDeletionState>(
  (set) => ({
    pendingBookmarkIds: [],
    markPending: (bookmarkId) =>
      set((state) =>
        state.pendingBookmarkIds.includes(bookmarkId)
          ? state
          : {
              pendingBookmarkIds: [...state.pendingBookmarkIds, bookmarkId],
            },
      ),
    clearPending: (bookmarkId) =>
      set((state) => ({
        pendingBookmarkIds: state.pendingBookmarkIds.filter(
          (id) => id !== bookmarkId,
        ),
      })),
  }),
);

export default usePendingBookmarkDeletionStore;
