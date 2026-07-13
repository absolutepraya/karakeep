// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OfflineLibraryStatus } from "@/lib/offline-library/sync";

import {
  useOfflineSafeBookmarkTags,
  useOfflineSafeBookmarkUpdate,
} from "./useOfflineSafeBookmarkMutation";

const mocks = vi.hoisted(() => ({
  getBookmark: vi.fn(),
  getBookmarkFieldVersion: vi.fn(),
  onlineUpdateMutateAsync: vi.fn(),
  onlineTagsMutateAsync: vi.fn(),
  queueBookmarkTags: vi.fn(),
  queueBookmarkUpdate: vi.fn(),
  status: null as unknown as OfflineLibraryStatus,
}));

vi.mock("@/lib/offline-library/provider", () => ({
  useOfflineLibrary: () => ({
    status: mocks.status,
    queueBookmarkUpdate: mocks.queueBookmarkUpdate,
    queueBookmarkTags: mocks.queueBookmarkTags,
  }),
}));

vi.mock("@/lib/offline-library/repository", () => ({
  getBookmarkFieldVersion: mocks.getBookmarkFieldVersion,
  offlineLibraryDb: { bookmarks: { get: mocks.getBookmark } },
}));

vi.mock("@karakeep/shared-react/hooks/bookmarks", () => ({
  useUpdateBookmark: () => ({
    mutateAsync: mocks.onlineUpdateMutateAsync,
    isPending: false,
    error: null,
  }),
  useUpdateBookmarkTags: () => ({
    mutateAsync: mocks.onlineTagsMutateAsync,
    isPending: false,
    error: null,
  }),
}));

function mockOfflineStatus() {
  mocks.status = {
    kind: "offline",
    lastSyncedAt: new Date(),
    pendingWrites: 0,
  };
}

function mockOnlineStatus() {
  mocks.status = {
    kind: "online",
    lastSyncedAt: new Date(),
    pendingWrites: 0,
  };
}

describe("useOfflineSafeBookmarkMutation", () => {
  beforeEach(() => {
    mockOfflineStatus();
    mocks.getBookmark.mockReset();
    mocks.getBookmarkFieldVersion.mockReset();
    mocks.onlineUpdateMutateAsync.mockReset();
    mocks.onlineTagsMutateAsync.mockReset();
    mocks.queueBookmarkUpdate.mockReset();
    mocks.queueBookmarkTags.mockReset();
    mocks.getBookmarkFieldVersion.mockResolvedValue(4);
    mocks.queueBookmarkUpdate.mockResolvedValue(undefined);
    mocks.queueBookmarkTags.mockResolvedValue(undefined);
  });

  it("queues a favourite toggle offline with the replica field version", async () => {
    const { result } = renderHook(() => useOfflineSafeBookmarkUpdate());

    await act(async () => {
      await result.current.mutateAsync({ bookmarkId: "b1", favourited: true });
    });

    expect(mocks.queueBookmarkUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        bookmarkId: "b1",
        kind: "bookmark.update",
        fields: { favourited: true },
        baseVersions: { favourited: 4 },
      }),
    );
    expect(mocks.onlineUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it("requires verified replica field versions before queuing offline", async () => {
    mocks.getBookmarkFieldVersion.mockResolvedValue(undefined);
    const { result } = renderHook(() => useOfflineSafeBookmarkUpdate());

    await expect(
      result.current.mutateAsync({ bookmarkId: "b1", archived: true }),
    ).rejects.toThrow("requires an internet connection");

    expect(mocks.queueBookmarkUpdate).not.toHaveBeenCalled();
  });

  it("does not queue a multi-field update when any field version is absent", async () => {
    mocks.getBookmarkFieldVersion.mockImplementation(async (_bookmarkId, field) =>
      field === "note" ? undefined : 4,
    );
    const { result } = renderHook(() => useOfflineSafeBookmarkUpdate());

    await expect(
      result.current.mutateAsync({
        bookmarkId: "b1",
        archived: true,
        note: "Keep for later",
      }),
    ).rejects.toThrow("requires an internet connection");

    expect(mocks.queueBookmarkUpdate).not.toHaveBeenCalled();
  });

  it("rejects a mixed offline update instead of discarding its unsupported field", async () => {
    const { result } = renderHook(() => useOfflineSafeBookmarkUpdate());

    await expect(
      result.current.mutateAsync({
        bookmarkId: "b1",
        title: "Keep this title",
        createdAt: new Date("2026-07-13T00:00:00Z"),
      }),
    ).rejects.toThrow("requires an internet connection");

    expect(mocks.queueBookmarkUpdate).not.toHaveBeenCalled();
  });

  it("uses the existing online mutation when connectivity is verified", async () => {
    mockOnlineStatus();
    mocks.onlineUpdateMutateAsync.mockResolvedValue({ id: "b1" });
    const { result } = renderHook(() => useOfflineSafeBookmarkUpdate());

    await act(async () => {
      await result.current.mutateAsync({ bookmarkId: "b1", archived: true });
    });

    expect(mocks.onlineUpdateMutateAsync).toHaveBeenCalledWith({
      bookmarkId: "b1",
      archived: true,
    });
    expect(mocks.queueBookmarkUpdate).not.toHaveBeenCalled();
  });

  it("queues known tag replacements offline", async () => {
    mocks.getBookmark.mockResolvedValue({
      id: "b1",
      tags: [{ id: "tag-1", name: "Existing", attachedBy: "human" }],
    });
    mocks.getBookmarkFieldVersion.mockResolvedValue(3);
    const { result } = renderHook(() => useOfflineSafeBookmarkTags());

    await act(async () => {
      await result.current.mutateAsync({
        bookmarkId: "b1",
        attach: [{ tagId: "tag-2", tagName: "Added" }],
        detach: [],
      });
    });

    expect(mocks.queueBookmarkTags).toHaveBeenCalledWith(
      expect.objectContaining({
        bookmarkId: "b1",
        kind: "bookmark.tags",
        tagIds: ["tag-1", "tag-2"],
        baseVersions: { tags: 3 },
      }),
    );
  });
});
