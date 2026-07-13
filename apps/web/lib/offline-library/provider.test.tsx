// @vitest-environment jsdom

import "fake-indexeddb/auto";

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { offlineLibraryDb, replaceSnapshot } from "./repository";
import {
  OfflineLibraryProvider,
  useOfflineLibrary,
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

function UnauthenticatedCaller({
  onSettled,
}: {
  onSettled: (results: PromiseSettledResult<unknown>[]) => void;
}) {
  const library = useOfflineLibrary();
  const called = React.useRef(false);
  React.useEffect(() => {
    if (called.current) {
      return;
    }
    called.current = true;
    void Promise.allSettled([
      library.syncNow(),
      library.queueBookmarkUpdate({
        idempotencyKey: "e7da6e68-4b45-4f56-aa6f-bd0c0fbbc6b8",
        kind: "bookmark.update",
        bookmarkId: "bookmark-1",
        fields: { title: "Offline title" },
        baseVersions: { title: 0 },
      }),
      library.queueBookmarkTags({
        idempotencyKey: "b72a6d48-2d46-4f3a-8a85-650c2f4dcbd1",
        kind: "bookmark.tags",
        bookmarkId: "bookmark-1",
        tagIds: ["tag-1"],
        baseVersions: { tags: 0 },
      }),
    ]).then(onSettled);
  }, [library, onSettled]);
  return null;
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
    bookmarkRssFeedMemberships: [],
    bookmarkFieldVersions: [],
    cursor: "1",
  });
  trpc.offlineSync.pull.query.mockResolvedValue({ events: [], cursor: "1" });
});

afterEach(async () => {
  await offlineLibraryDb.delete();
  vi.clearAllMocks();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

test("starts synchronization only for an authenticated session", async () => {
  const postMessage = vi.fn();
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { controller: { postMessage } },
  });
  const screen = render(
    <OfflineLibraryProvider trpcClient={trpc as never}>
      <Status />
    </OfflineLibraryProvider>,
  );

  await waitFor(async () => {
    expect(trpc.offlineSync.snapshot.query).toHaveBeenCalledTimes(1);
    expect(screen.getByText("online")).toBeTruthy();
    expect(postMessage).toHaveBeenCalledWith({ type: "CLEAR_USER_CACHES" });
    await expect(
      offlineLibraryDb.metadata.get("replicaOwnerUserId"),
    ).resolves.toMatchObject({
      value: "user-1",
    });
  });
});

test("does not start synchronization on a cold offline launch", async () => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  const screen = render(
    <OfflineLibraryProvider trpcClient={trpc as never}>
      <Status />
    </OfflineLibraryProvider>,
  );

  await waitFor(() => {
    expect(screen.getByText("offline")).toBeTruthy();
  });
  expect(trpc.offlineSync.snapshot.query).not.toHaveBeenCalled();
});

test("purges the private replica and worker caches after logout", async () => {
  await replaceSnapshot(
    {
      bookmarks: [],
      lists: [],
      bookmarkListMemberships: [],
      bookmarkRssFeedMemberships: [],
      bookmarkFieldVersions: [],
      cursor: "1",
    },
    "user-1",
  );
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

test("purges a persisted replica owned by another user before initial activation", async () => {
  await replaceSnapshot(
    {
      bookmarks: [],
      lists: [],
      bookmarkListMemberships: [],
      bookmarkRssFeedMemberships: [],
      bookmarkFieldVersions: [],
      cursor: "1",
    },
    "user-1",
  );
  session.current = {
    data: { user: { id: "user-2" } },
    status: "authenticated",
  };
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
    expect(trpc.offlineSync.snapshot.query).toHaveBeenCalledOnce();
    expect(trpc.offlineSync.pull.query).not.toHaveBeenCalled();
    await expect(
      offlineLibraryDb.metadata.get("replicaOwnerUserId"),
    ).resolves.toMatchObject({
      value: "user-2",
    });
    expect(postMessage).toHaveBeenCalledWith({ type: "CLEAR_USER_CACHES" });
  });
});

test("purges before an in-process principal transition and snapshots the next user", async () => {
  const postMessage = vi.fn();
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { controller: { postMessage } },
  });
  const screen = render(
    <OfflineLibraryProvider trpcClient={trpc as never}>
      <Status />
    </OfflineLibraryProvider>,
  );
  await waitFor(() =>
    expect(trpc.offlineSync.snapshot.query).toHaveBeenCalledOnce(),
  );

  session.current = {
    data: { user: { id: "user-2" } },
    status: "authenticated",
  };
  screen.rerender(
    <OfflineLibraryProvider trpcClient={trpc as never}>
      <Status />
    </OfflineLibraryProvider>,
  );

  await waitFor(async () => {
    expect(trpc.offlineSync.snapshot.query).toHaveBeenCalledTimes(2);
    await expect(
      offlineLibraryDb.metadata.get("replicaOwnerUserId"),
    ).resolves.toMatchObject({
      value: "user-2",
    });
    expect(postMessage).toHaveBeenCalledWith({ type: "CLEAR_USER_CACHES" });
  });
});

test("purges on logout before activating a later authenticated principal", async () => {
  const screen = render(
    <OfflineLibraryProvider trpcClient={trpc as never}>
      <Status />
    </OfflineLibraryProvider>,
  );
  await waitFor(() =>
    expect(trpc.offlineSync.snapshot.query).toHaveBeenCalledOnce(),
  );

  session.current = { data: null, status: "unauthenticated" };
  screen.rerender(
    <OfflineLibraryProvider trpcClient={trpc as never}>
      <Status />
    </OfflineLibraryProvider>,
  );
  await waitFor(async () => {
    await expect(offlineLibraryDb.metadata.count()).resolves.toBe(0);
  });

  session.current = {
    data: { user: { id: "user-2" } },
    status: "authenticated",
  };
  screen.rerender(
    <OfflineLibraryProvider trpcClient={trpc as never}>
      <Status />
    </OfflineLibraryProvider>,
  );
  await waitFor(async () => {
    expect(trpc.offlineSync.snapshot.query).toHaveBeenCalledTimes(2);
    await expect(
      offlineLibraryDb.metadata.get("replicaOwnerUserId"),
    ).resolves.toMatchObject({
      value: "user-2",
    });
  });
});

test("rejects unauthenticated public calls without leaving an outbox mutation for a later user", async () => {
  session.current = { data: null, status: "loading" };
  const onSettled = vi.fn();
  const screen = render(
    <OfflineLibraryProvider trpcClient={trpc as never}>
      <UnauthenticatedCaller onSettled={onSettled} />
    </OfflineLibraryProvider>,
  );

  await waitFor(() => {
    expect(onSettled).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ status: "rejected" }),
        expect.objectContaining({ status: "rejected" }),
        expect.objectContaining({ status: "rejected" }),
      ]),
    );
  });
  await expect(offlineLibraryDb.outbox.count()).resolves.toBe(0);

  session.current = {
    data: { user: { id: "user-2" } },
    status: "authenticated",
  };
  screen.rerender(
    <OfflineLibraryProvider trpcClient={trpc as never}>
      <UnauthenticatedCaller onSettled={onSettled} />
    </OfflineLibraryProvider>,
  );

  await waitFor(() =>
    expect(trpc.offlineSync.snapshot.query).toHaveBeenCalledOnce(),
  );
  expect(trpc.offlineSync.push.mutate).not.toHaveBeenCalled();
  await expect(offlineLibraryDb.outbox.count()).resolves.toBe(0);
});
