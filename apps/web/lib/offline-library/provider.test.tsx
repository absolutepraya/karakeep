// @vitest-environment jsdom

import "fake-indexeddb/auto";

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { offlineLibraryDb, replaceSnapshot } from "./repository";
import {
  OfflineLibraryProvider,
  useOfflineLibraryStatus,
} from "./provider";

const session = vi.hoisted(
  () =>
    ({
      current: {
        data: { user: { id: "user-1" } },
        status: "authenticated",
      },
    }) as {
      current: {
        data: { user: { id: string } } | null;
        status: "authenticated" | "loading" | "unauthenticated";
      };
    },
);

vi.mock("@/lib/auth/client", () => ({
  useSession: () => session.current,
}));

const trpc = {
  offlineSync: {
    snapshot: { query: vi.fn() },
    pull: { query: vi.fn() },
    push: { mutate: vi.fn() },
  },
};

function Status() {
  const status = useOfflineLibraryStatus();
  return <output>{status.kind}</output>;
}

beforeEach(async () => {
  await offlineLibraryDb.delete();
  await offlineLibraryDb.open();
  session.current = {
    data: { user: { id: "user-1" } },
    status: "authenticated",
  };
  trpc.offlineSync.snapshot.query.mockResolvedValue({
    bookmarks: [],
    lists: [],
    bookmarkListMemberships: [],
    cursor: "1",
  });
  trpc.offlineSync.pull.query.mockResolvedValue({ events: [], cursor: "1" });
});

afterEach(async () => {
  await offlineLibraryDb.delete();
  vi.clearAllMocks();
});

test("starts synchronization only for an authenticated session", async () => {
  const screen = render(
    <OfflineLibraryProvider trpcClient={trpc as never}>
      <Status />
    </OfflineLibraryProvider>,
  );

  await waitFor(() => {
    expect(trpc.offlineSync.snapshot.query).toHaveBeenCalledTimes(1);
    expect(screen.getByText("online")).toBeTruthy();
  });
});

test("purges the private replica and worker caches after logout", async () => {
  await replaceSnapshot({
    bookmarks: [],
    lists: [],
    bookmarkListMemberships: [],
    cursor: "1",
  });
  session.current = { data: null, status: "unauthenticated" };
  const postMessage = vi.fn();
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { controller: { postMessage } },
  });

  render(
    <OfflineLibraryProvider trpcClient={trpc as never}>
      <Status />
    </OfflineLibraryProvider>,
  );

  await waitFor(async () => {
    expect(await offlineLibraryDb.metadata.count()).toBe(0);
    expect(postMessage).toHaveBeenCalledWith({ type: "CLEAR_USER_CACHES" });
  });
});
