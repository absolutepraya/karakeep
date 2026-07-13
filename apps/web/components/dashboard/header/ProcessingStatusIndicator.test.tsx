// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OfflineLibraryStatus } from "@/lib/offline-library/sync";

import ProcessingStatusIndicator from "./ProcessingStatusIndicator";

const mocks = vi.hoisted(() => ({
  conflicts: [] as Array<{
    bookmarkId: string;
    field: string;
    localValue: unknown;
    serverValue: unknown;
    serverVersion: number;
  }>,
  serverProcessing: {
    total: 0,
    tasks: [] as Array<{ kind: "crawling" | "embedding"; count: number }>,
  },
  status: {
    kind: "online",
    lastSyncedAt: new Date("2026-07-12T00:00:00Z"),
    pendingWrites: 0,
  } as OfflineLibraryStatus,
  syncNow: vi.fn(),
}));

function mockLibraryStatus(status: OfflineLibraryStatus) {
  mocks.status = status;
}

function mockServerProcessing(
  processing: typeof mocks.serverProcessing,
) {
  mocks.serverProcessing = processing;
}

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mocks.serverProcessing }),
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
  useOfflineLibrary: () => ({
    status: mocks.status,
    syncNow: mocks.syncNow,
  }),
  useOfflineLibraryStatus: () => mocks.status,
}));

vi.mock("@/lib/offline-library/repository", () => ({
  offlineLibraryDb: {
    bookmarks: { get: vi.fn() },
    conflicts: { toArray: () => Promise.resolve(mocks.conflicts) },
  },
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

afterEach(cleanup);

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
  });

  it("shows an offline state and pending writes", () => {
    mockLibraryStatus({
      kind: "offline",
      lastSyncedAt: new Date("2026-07-12T00:00:00Z"),
      pendingWrites: 2,
    });
    mockServerProcessing({ total: 0, tasks: [] });

    render(<ProcessingStatusIndicator />);

    expect(
      screen.getByRole("button", { name: /library activity.*offline.*2/i }),
    ).toBeTruthy();
    expect(screen.getByText("2 pending writes")).toBeTruthy();
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

    expect(
      screen.getByRole("button", { name: /library activity.*1 conflict/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /resolve 1 conflict/i }),
    ).toBeTruthy();
  });

  it("keeps server processing separate from local synchronization", () => {
    mockLibraryStatus({
      kind: "syncing",
      phase: "pulling",
      completed: 5,
      total: 10,
      pendingWrites: 1,
    });
    mockServerProcessing({
      total: 3,
      tasks: [{ kind: "crawling", count: 3 }],
    });

    render(<ProcessingStatusIndicator />);

    fireEvent.click(screen.getByRole("button", { name: /library activity/i }));
    expect(screen.getByText("Library sync")).toBeTruthy();
    expect(screen.getByText("Background processing")).toBeTruthy();
    expect(screen.getByText("Crawling")).toBeTruthy();
  });
});
