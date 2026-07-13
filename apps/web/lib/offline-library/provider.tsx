"use client";

import type { TRPCClient } from "@trpc/client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { AppRouter } from "@karakeep/trpc/routers/_app";

import { useSession } from "@/lib/auth/client";

import { purgeOfflineLibrary } from "./repository";
import {
  OfflineLibrarySyncCoordinator,
  type BookmarkTagsMutation,
  type BookmarkUpdateMutation,
  type OfflineLibraryStatus,
  type OfflineSyncClient,
} from "./sync";

type OfflineLibraryContextValue = {
  status: OfflineLibraryStatus;
  syncNow: () => Promise<void>;
  queueBookmarkUpdate: (mutation: BookmarkUpdateMutation) => Promise<void>;
  queueBookmarkTags: (mutation: BookmarkTagsMutation) => Promise<void>;
};

type OfflineLibraryProviderProps = {
  children: React.ReactNode;
  trpcClient: TRPCClient<AppRouter>;
};

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

function clearUserCaches(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_USER_CACHES" });
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
    if (sessionStatus === "authenticated" && session?.user?.id) {
      coordinator.activate();
      const sync = () => {
        void coordinator.syncNow().catch(() => undefined);
      };
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          sync();
        }
      };
      const onOnline = () => sync();
      const onOffline = () => {
        void coordinator.markOffline();
      };
      const onWorkerMessage = (
        event: MessageEvent<{ type?: string }>,
      ) => {
        if (event.data?.type === "THUMBNAIL_USED") {
          void coordinator.afterThumbnailCacheWrite();
        }
      };
      const hasServiceWorker = "serviceWorker" in navigator;

      if (hasServiceWorker) {
        navigator.serviceWorker.addEventListener("message", onWorkerMessage);
      }


      sync();
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      return () => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
        if (hasServiceWorker) {
          navigator.serviceWorker.removeEventListener("message", onWorkerMessage);
        }
        coordinator.deactivate();
      };
    }

    if (sessionStatus !== "loading") {
      coordinator.deactivate();
      void purgeOfflineLibrary().finally(clearUserCaches);
    }
  }, [coordinator, session?.user?.id, sessionStatus]);

  const value = useMemo<OfflineLibraryContextValue>(
    () => ({
      status,
      syncNow: async () => await coordinator.syncNow(),
      queueBookmarkUpdate: async (mutation) =>
        await coordinator.queueBookmarkUpdate(mutation),
      queueBookmarkTags: async (mutation) => await coordinator.queueBookmarkTags(mutation),
    }),
    [coordinator, status],
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
