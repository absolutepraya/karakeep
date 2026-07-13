// @vitest-environment jsdom

import "fake-indexeddb/auto";

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BookmarkTypes } from "@karakeep/shared/types/bookmarks";
import type { ZBookmark } from "@karakeep/shared/types/bookmarks";
import type { OfflineLibraryStatus } from "@/lib/offline-library/sync";
import {
  offlineLibraryDb,
  saveConflict,
} from "@/lib/offline-library/repository";

import ProcessingStatusIndicator from "./ProcessingStatusIndicator";

const mocks = vi.hoisted(() => ({
  status: {
    kind: "conflict",
    pendingWrites: 1,
    conflictCount: 1,
  } as OfflineLibraryStatus,
  syncNow: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { total: 0, tasks: [] } }),
}));

vi.mock("@karakeep/shared-react/trpc", () => ({
  useTRPC: () => ({
    bookmarks: {
      getProcessingStatus: {
        queryOptions: () => ({}),
      },
    },
  }),
}));

vi.mock("@/lib/offline-library/provider", () => ({
  useOfflineLibrary: () => ({ syncNow: mocks.syncNow }),
  useOfflineLibraryStatus: () => mocks.status,
}));

vi.mock("@/components/ui/popover", () => {
  const PopoverContext = React.createContext<{
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  } | null>(null);

  return {
    Popover: ({ children }: { children: React.ReactNode }) => {
      const [open, setOpen] = React.useState(false);
      return (
        <PopoverContext.Provider value={{ open, setOpen }}>
          {children}
        </PopoverContext.Provider>
      );
    },
    PopoverTrigger: ({
      children,
    }: {
      children: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
    }) => {
      const context = React.useContext(PopoverContext);
      if (!context) throw new Error("PopoverTrigger requires Popover");
      return React.cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          children.props.onClick?.(event);
          context.setOpen((open) => !open);
        },
      });
    },
    PopoverContent: ({ children }: { children: React.ReactNode }) => {
      const context = React.useContext(PopoverContext);
      return context?.open ? <div>{children}</div> : null;
    },
  };
});

const conflict = {
  bookmarkId: "bookmark-1",
  field: "title",
  localValue: "Offline title",
  serverValue: "Server title",
  serverVersion: 4,
};

const bookmark: ZBookmark = {
  id: "bookmark-1",
  createdAt: new Date("2026-07-10T00:00:00Z"),
  modifiedAt: null,
  title: "Offline title",
  archived: false,
  favourited: false,
  taggingStatus: null,
  summarizationStatus: null,
  embeddingStatus: null,
  note: "airplane",
  summary: null,
  source: "web",
  userId: "user-1",
  tags: [],
  content: {
    type: BookmarkTypes.LINK,
    url: "https://example.com/offline",
    title: null,
    description: null,
    imageUrl: null,
    imageAssetId: null,
    screenshotAssetId: null,
    pdfAssetId: null,
    fullPageArchiveAssetId: null,
    videoAssetId: null,
    favicon: null,
    htmlContent: null,
    contentAssetId: null,
    crawledAt: null,
    crawlStatus: null,
    author: null,
    publisher: null,
    datePublished: null,
    dateModified: null,
  },
  assets: [],
};

beforeEach(async () => {
  await offlineLibraryDb.delete();
  await offlineLibraryDb.open();
  await offlineLibraryDb.transaction(
    "rw",
    [offlineLibraryDb.bookmarks, offlineLibraryDb.bookmarkFieldVersions],
    async () => {
      await offlineLibraryDb.bookmarks.put(bookmark);
      await offlineLibraryDb.bookmarkFieldVersions.put({
        bookmarkId: conflict.bookmarkId,
        field: conflict.field,
        version: 1,
      });
    },
  );
  await saveConflict(conflict);
});

afterEach(async () => {
  cleanup();
  await offlineLibraryDb.delete();
  mocks.syncNow.mockClear();
});

describe("ProcessingStatusIndicator conflict resolution", () => {
  it("updates the server value and field version in the resolution transaction", async () => {
    render(<ProcessingStatusIndicator />);

    fireEvent.click(screen.getByRole("button", { name: /library activity/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Resolve 1 conflict" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Use server value" }),
    );

    await waitFor(async () => {
      expect(
        await offlineLibraryDb.bookmarkFieldVersions.get([
          conflict.bookmarkId,
          conflict.field,
        ]),
      ).toMatchObject({ version: conflict.serverVersion });
      expect(
        await offlineLibraryDb.bookmarks.get(conflict.bookmarkId),
      ).toMatchObject({
        title: conflict.serverValue,
      });
      expect(await offlineLibraryDb.conflicts.count()).toBe(0);
    });
  });
});
