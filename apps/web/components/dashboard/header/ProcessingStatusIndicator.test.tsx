// @vitest-environment jsdom

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OfflineLibraryStatus } from "@/lib/offline-library/sync";

import ProcessingStatusIndicator from "./ProcessingStatusIndicator";

const mocks = vi.hoisted(() => ({
  conflicts: [] as {
    bookmarkId: string;
    field: string;
    localValue: unknown;
    serverValue: unknown;
    serverVersion: number;
  }[],
  rejections: [] as {
    idempotencyKey: string;
    bookmarkId: string;
    code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND";
    message: string;
  }[],
  discardRejectedMutation: vi.fn(),
  invalidateQueries: vi.fn(),
  serverProcessing: {
    total: 0,
    tasks: [] as {
      kind: "crawling" | "tagging" | "summarizing" | "importing";
      count: number;
    }[],
  },
  status: {
    kind: "online",
    lastSyncedAt: new Date("2026-07-12T00:00:00Z"),
    pendingWrites: 0,
  } as OfflineLibraryStatus,
  syncNow: vi.fn(),
  canReadOfflineReplica: true,
}));

function mockLibraryStatus(status: OfflineLibraryStatus) {
  mocks.status = status;
}

function mockServerProcessing(processing: typeof mocks.serverProcessing) {
  mocks.serverProcessing = processing;
}

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mocks.serverProcessing, dataUpdatedAt: 1 }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("@karakeep/shared-react/trpc", () => ({
  useTRPC: () => ({
    bookmarks: {
      getProcessingStatus: {
        queryOptions: () => ({}),
      },
      getBookmarks: {
        pathFilter: () => ({ queryKey: ["bookmarks", "getBookmarks"] }),
      },
      searchBookmarks: {
        pathFilter: () => ({ queryKey: ["bookmarks", "searchBookmarks"] }),
      },
    },
  }),
}));

vi.mock("@/lib/offline-library/provider", () => ({
  useOfflineLibrary: () => ({
    status: mocks.status,
    syncNow: mocks.syncNow,
    discardRejectedMutation: mocks.discardRejectedMutation,
  }),
  useOfflineLibraryStatus: () => mocks.status,
  useCanReadOfflineReplica: () => mocks.canReadOfflineReplica,
}));

vi.mock("@/lib/offline-library/repository", () => ({
  offlineLibraryDb: {
    bookmarks: { get: vi.fn() },
    conflicts: { toArray: () => Promise.resolve(mocks.conflicts) },
    rejections: { toArray: () => Promise.resolve(mocks.rejections) },
  },
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

afterEach(() => {
  cleanup();
  mocks.rejections = [];
  mocks.discardRejectedMutation.mockReset();
  mocks.invalidateQueries.mockReset();
});

describe("ProcessingStatusIndicator", () => {
  it("shows online state while idle", () => {
    mockLibraryStatus({
      kind: "online",
      lastSyncedAt: new Date("2026-07-12T00:00:00Z"),
      pendingWrites: 0,
    });
    mockServerProcessing({ total: 0, tasks: [] });

    render(<ProcessingStatusIndicator />);

    expect(
      screen.getByRole("button", { name: /library activity.*online/i }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /library activity/i }));
    expect(screen.getByText("Showing server data")).toBeTruthy();
  });

  it("shows an offline state and pending writes", () => {
    mockLibraryStatus({
      kind: "offline",
      lastSyncedAt: new Date("2026-07-12T00:00:00Z"),
      pendingWrites: 2,
    });
    mockServerProcessing({ total: 0, tasks: [] });

    render(<ProcessingStatusIndicator />);
    fireEvent.click(screen.getByRole("button", { name: /library activity/i }));

    expect(
      screen.getByRole("button", { name: /library activity.*offline.*2/i }),
    ).toBeTruthy();
    expect(screen.getByText("Showing offline replica")).toBeTruthy();
    expect(screen.getByText("2 pending writes")).toBeTruthy();
  });

  it("shows an actionable rejected offline change state", async () => {
    mockLibraryStatus({
      kind: "rejected",
      pendingWrites: 0,
      rejectionCount: 1,
    });
    mocks.rejections = [
      {
        idempotencyKey: "e7da6e68-4b45-4f56-aa6f-bd0c0fbbc6b8",
        bookmarkId: "bookmark-1",
        code: "FORBIDDEN",
        message: "User is not allowed to modify this bookmark",
      },
    ];
    mockServerProcessing({ total: 0, tasks: [] });

    render(<ProcessingStatusIndicator />);
    fireEvent.click(screen.getByRole("button", { name: /library activity/i }));

    expect(
      await screen.findByText(
        "The server could not apply a queued offline change.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Resolve 1 rejected change" }),
    ).toBeTruthy();
  });

  it("shows the last successful sync and safely retries after an error", async () => {
    mockLibraryStatus({
      kind: "online",
      lastSyncedAt: new Date("2026-07-12T00:00:00Z"),
      pendingWrites: 0,
    });
    mockServerProcessing({ total: 0, tasks: [] });
    const { rerender } = render(<ProcessingStatusIndicator />);

    mockLibraryStatus({
      kind: "error",
      message: "Network unavailable",
      retryAt: new Date("2026-07-12T00:05:00Z"),
      pendingWrites: 2,
    });
    mocks.syncNow.mockRejectedValueOnce(new Error("retry failed"));
    rerender(<ProcessingStatusIndicator />);

    fireEvent.click(screen.getByRole("button", { name: /library activity/i }));
    expect(screen.getByText(/Network unavailable/)).toBeTruthy();
    expect(screen.getByText(/Last synced/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry sync" }));
    await waitFor(() => expect(mocks.syncNow).toHaveBeenCalledTimes(1));
  });

  it("shows sync progress and queued writes", () => {
    mockLibraryStatus({
      kind: "syncing",
      phase: "pulling",
      completed: 5,
      total: 10,
      pendingWrites: 1,
    });
    mockServerProcessing({ total: 0, tasks: [] });

    render(<ProcessingStatusIndicator />);
    fireEvent.click(screen.getByRole("button", { name: /library activity/i }));

    expect(
      screen.getByRole("button", {
        name: /library activity.*syncing.*5 of 10/i,
      }),
    ).toBeTruthy();
    expect(screen.getByText("5 of 10 complete")).toBeTruthy();
    expect(screen.getByText("1 pending write")).toBeTruthy();
  });

  it("keeps a conflict visible until it is resolved", () => {
    mockLibraryStatus({
      kind: "conflict",
      pendingWrites: 1,
      conflictCount: 1,
    });
    mockServerProcessing({ total: 0, tasks: [] });

    render(<ProcessingStatusIndicator />);
    fireEvent.click(screen.getByRole("button", { name: /library activity/i }));

    expect(
      screen.getByRole("button", { name: /library activity.*1 conflict/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /resolve 1 conflict/i }),
    ).toBeTruthy();
  });

  it("shows core preparation separately from background enrichment", () => {
    mockLibraryStatus({
      kind: "offline",
      lastSyncedAt: new Date("2026-07-12T00:00:00Z"),
      pendingWrites: 1,
    });
    mockServerProcessing({
      total: 4,
      tasks: [
        { kind: "crawling", count: 1 },
        { kind: "tagging", count: 2 },
        { kind: "summarizing", count: 1 },
      ],
    });

    render(<ProcessingStatusIndicator />);

    const trigger = screen.getByRole("button", { name: /library activity/i });
    expect(trigger.getAttribute("aria-label")).toMatch(/1 bookmark preparing/i);
    expect(trigger.getAttribute("aria-label")).toMatch(
      /3 background enrichment tasks/i,
    );
    expect(screen.queryByText("Library sync")).toBeNull();
    expect(trigger.querySelector("svg")?.getAttribute("class")).not.toContain(
      "animate-spin",
    );

    fireEvent.click(trigger);
    expect(screen.getByText("Library sync")).toBeTruthy();
    expect(screen.getByText("Processing activity")).toBeTruthy();
    expect(screen.getByText("Preparing bookmarks")).toBeTruthy();
    expect(screen.getByText("Background enrichment")).toBeTruthy();
    expect(screen.getByText("Crawling")).toBeTruthy();
    expect(screen.getByText("Tagging")).toBeTruthy();
    expect(screen.getByText("Summarizing")).toBeTruthy();
    expect(screen.queryByText("Embedding")).toBeNull();
  });

  it("does not show background enrichment as a foreground count", () => {
    mockLibraryStatus({
      kind: "online",
      lastSyncedAt: new Date("2026-07-12T00:00:00Z"),
      pendingWrites: 0,
    });
    mockServerProcessing({
      total: 2,
      tasks: [{ kind: "tagging", count: 2 }],
    });

    render(<ProcessingStatusIndicator />);

    const trigger = screen.getByRole("button", { name: /library activity/i });
    expect(trigger.getAttribute("aria-label")).not.toMatch(/bookmark preparing/i);
    expect(trigger.textContent).not.toContain("2");
  });
});
