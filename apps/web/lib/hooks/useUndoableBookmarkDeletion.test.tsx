// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUndoableBookmarkDeletion } from "./useUndoableBookmarkDeletion";
import usePendingBookmarkDeletionStore from "../store/usePendingBookmarkDeletionStore";

const mocks = vi.hoisted(() => ({
  deleteBookmark: vi.fn(),
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("@/lib/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

vi.mock("@karakeep/shared-react/hooks/bookmarks", () => ({
  useDeleteBookmark: () => ({ mutateAsync: mocks.deleteBookmark }),
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

describe("useUndoableBookmarkDeletion", () => {
  beforeEach(() => {
    mocks.deleteBookmark.mockClear();
    mocks.deleteBookmark.mockResolvedValue(undefined);
    mocks.toast.mockClear();
    mocks.toast.error.mockClear();
    mocks.toast.success.mockClear();
    usePendingBookmarkDeletionStore.setState({ pendingBookmarkIds: [] });
  });

  it("hides the bookmark immediately and commits deletion when the toast expires", async () => {
    const { result } = renderHook(() => useUndoableBookmarkDeletion());

    act(() => {
      result.current.scheduleDelete("bookmark-1");
    });

    expect(
      usePendingBookmarkDeletionStore.getState().pendingBookmarkIds,
    ).toEqual(["bookmark-1"]);

    const toastOptions = mocks.toast.mock.calls[0]?.[1];
    act(() => {
      toastOptions?.onAutoClose?.();
    });

    await waitFor(() => {
      expect(mocks.deleteBookmark).toHaveBeenCalledWith({
        bookmarkId: "bookmark-1",
      });
    });
    // Successful deletions keep the pending ID: the refetched query data
    // won't contain the bookmark, so the filter is a harmless no-op.
    // Clearing pending immediately would cause a brief reappearance
    // between clearPending and the debounced query refetch.
    expect(
      usePendingBookmarkDeletionStore.getState().pendingBookmarkIds,
    ).toEqual(["bookmark-1"]);
  });

  it("restores visibility and skips deletion when Undo is clicked", () => {
    const { result } = renderHook(() => useUndoableBookmarkDeletion());

    act(() => {
      result.current.scheduleDelete("bookmark-1");
    });

    const toastOptions = mocks.toast.mock.calls[0]?.[1];
    act(() => {
      toastOptions?.action?.onClick?.();
      toastOptions?.onAutoClose?.();
    });

    expect(mocks.deleteBookmark).not.toHaveBeenCalled();
    expect(
      usePendingBookmarkDeletionStore.getState().pendingBookmarkIds,
    ).toEqual([]);
  });
  it("commits every selected bookmark after a bulk delete toast expires", async () => {
    const { result } = renderHook(() => useUndoableBookmarkDeletion());

    act(() => {
      result.current.scheduleDeletes(["bookmark-1", "bookmark-2"]);
    });

    const toastOptions = mocks.toast.mock.calls[0]?.[1];
    act(() => {
      toastOptions?.onAutoClose?.();
    });

    await waitFor(() => {
      expect(mocks.deleteBookmark).toHaveBeenCalledTimes(2);
    });
    expect(mocks.deleteBookmark).toHaveBeenNthCalledWith(1, {
      bookmarkId: "bookmark-1",
    });
    expect(mocks.deleteBookmark).toHaveBeenNthCalledWith(2, {
      bookmarkId: "bookmark-2",
    });
  });

  it("restores visibility when deletion fails", async () => {
    mocks.deleteBookmark.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useUndoableBookmarkDeletion());

    act(() => {
      result.current.scheduleDelete("bookmark-1");
    });

    expect(
      usePendingBookmarkDeletionStore.getState().pendingBookmarkIds,
    ).toEqual(["bookmark-1"]);

    const toastOptions = mocks.toast.mock.calls[0]?.[1];
    act(() => {
      toastOptions?.onAutoClose?.();
    });

    await waitFor(() => {
      expect(mocks.toast.error).toHaveBeenCalled();
    });
    expect(
      usePendingBookmarkDeletionStore.getState().pendingBookmarkIds,
    ).toEqual([]);
  });
});
