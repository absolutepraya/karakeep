"use client";

import type { TRPCClient } from "@trpc/client";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { AppRouter } from "@karakeep/trpc/routers/_app";

import { useSession } from "@/lib/auth/client";

import { getReplicaOwnerUserId, purgeOfflineLibrary } from "./repository";
import { OfflineLibrarySyncCoordinator } from "./sync";
import type {
  BookmarkTagsMutation,
  BookmarkUpdateMutation,
  OfflineLibraryStatus,
  OfflineSyncClient,
} from "./sync";

interface OfflineLibraryContextValue {
  status: OfflineLibraryStatus;
  syncNow: () => Promise<void>;
  queueBookmarkUpdate: (mutation: BookmarkUpdateMutation) => Promise<void>;
  queueBookmarkTags: (mutation: BookmarkTagsMutation) => Promise<void>;
}

interface OfflineLibraryProviderProps {
  children: React.ReactNode;
  trpcClient: TRPCClient<AppRouter>;
}

const OfflineLibraryContext = createContext<OfflineLibraryContextValue | null>(null);

export function createOfflineSyncClient(
  trpcClient: TRPCClient<AppRouter>,
): OfflineSyncClient {
  return {
    snapshot: async () => await trpcClient.offlineSync.snapshot.query(),
    pull: async (input) => await trpcClient.offlineSync.pull.query(input),
    push: async (input) => await trpcClient.offlineSync.push.mutate(input),
  };
}

async function clearUserCaches(): Promise<void> {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_USER_CACHES" });
  }
}

export function OfflineLibraryProvider({
  children,
  trpcClient,
}: OfflineLibraryProviderProps) {
  const { data: session, status: sessionStatus } = useSession();
  const coordinator = useMemo(
    () => new OfflineLibrarySyncCoordinator(createOfflineSyncClient(trpcClient)),
    [trpcClient],
  );
  const activeUserIdRef = useRef<string | null>(null);
  const lifecycleRef = useRef<Promise<void>>(Promise.resolve());
  const userId = sessionStatus === "authenticated" ? session?.user?.id ?? null : null;
  const [status, setStatus] = useState<OfflineLibraryStatus>(
    coordinator.getStatus(),
  );

  useEffect(() => {
    const unsubscribe = coordinator.subscribe(setStatus);
    return () => {
      unsubscribe();
      coordinator.dispose();
    };
  }, [coordinator]);

  useEffect(() => {
    const sync = () => {
      if (activeUserIdRef.current) {
        void coordinator.syncNow().catch(() => undefined);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sync();
      }
    };
    const onOffline = () => {
      if (activeUserIdRef.current) {
        void coordinator.markOffline();
      }
    };
    const onWorkerMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "THUMBNAIL_USED") {
        void coordinator.afterThumbnailCacheWrite();
      }
    };
    const serviceWorker = navigator.serviceWorker;
    const hasServiceWorker =
      typeof serviceWorker?.addEventListener === "function" &&
      typeof serviceWorker.removeEventListener === "function";

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", sync);
    window.addEventListener("offline", onOffline);
    if (hasServiceWorker) {
      serviceWorker.addEventListener("message", onWorkerMessage);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", onOffline);
      if (hasServiceWorker) {
        serviceWorker.removeEventListener("message", onWorkerMessage);
      }
    };
  }, [coordinator]);

  useEffect(() => {
    let cancelled = false;
    lifecycleRef.current = lifecycleRef.current.then(async () => {
      const previousUserId = activeUserIdRef.current;
      if (userId === null) {
        await coordinator.deactivate();
        await purgeOfflineLibrary();
        await clearUserCaches();
        activeUserIdRef.current = null;
        return;
      }

      const persistedOwnerUserId = await getReplicaOwnerUserId();
      const principalChanged =
        previousUserId !== null && previousUserId !== userId;
      if (principalChanged || persistedOwnerUserId !== userId) {
        await coordinator.deactivate();
        await purgeOfflineLibrary();
        await clearUserCaches();
        activeUserIdRef.current = null;
      }

      if (cancelled) {
        return;
      }
      coordinator.activate(userId);
      activeUserIdRef.current = userId;
      if (navigator.onLine === false) {
        await coordinator.markOffline();
        return;
      }
      void coordinator.syncNow().catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [coordinator, userId]);

  const value = useMemo<OfflineLibraryContextValue>(
    () => ({
      status,
      syncNow: async () => {
        if (userId === null || activeUserIdRef.current !== userId) {
          throw new Error("Offline sync requires an authenticated user");
        }
        await coordinator.syncNow();
      },
      queueBookmarkUpdate: async (mutation) => {
        if (userId === null || activeUserIdRef.current !== userId) {
          throw new Error("Offline writes require an authenticated user");
        }
        await coordinator.queueBookmarkUpdate(mutation);
      },
      queueBookmarkTags: async (mutation) => {
        if (userId === null || activeUserIdRef.current !== userId) {
          throw new Error("Offline writes require an authenticated user");
        }
        await coordinator.queueBookmarkTags(mutation);
      },
    }),
    [coordinator, status, userId],
  );

  return (
    <OfflineLibraryContext.Provider value={value}>
      {children}
    </OfflineLibraryContext.Provider>
  );
}

function useOfflineLibraryContext(): OfflineLibraryContextValue {
  const context = useContext(OfflineLibraryContext);
  if (!context) {
    throw new Error("useOfflineLibrary must be used within OfflineLibraryProvider");
  }
  return context;
}

export function useOfflineLibrary(): OfflineLibraryContextValue {
  return useOfflineLibraryContext();
}

export function useOfflineLibraryStatus(): OfflineLibraryStatus {
  return useOfflineLibraryContext().status;
}
