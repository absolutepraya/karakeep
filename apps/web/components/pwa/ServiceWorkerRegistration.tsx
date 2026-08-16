"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useSession } from "@/lib/auth/client";
import { recordThumbnailAccess } from "@/lib/offline-library/repository";

type WorkerMessage =
  | { type: "ACTIVATE_UPDATE" }
  | { type: "CLEAR_USER_CACHES" }
  | { type: "SET_DOCUMENT_CACHE_SESSION"; sessionId: string | null }
  | { type: "THUMBNAIL_USED"; url: string };

export type PwaUpdateStatus = "current" | "available" | "ready";

export interface PwaLifecycleState {
  appBuild: string;
  deployedBuild: string | null;
  updateStatus: PwaUpdateStatus;
}

const compiledServiceWorkerBuildVersion =
  process.env.NEXT_PUBLIC_SERVICE_WORKER_BUILD_VERSION;
const appBuild = compiledServiceWorkerBuildVersion ?? "development";
const serviceWorkerUrl = compiledServiceWorkerBuildVersion
  ? `/sw.js?v=${encodeURIComponent(compiledServiceWorkerBuildVersion)}`
  : "/sw.js";

const PwaLifecycleContext = createContext<PwaLifecycleState>({
  appBuild,
  deployedBuild: null,
  updateStatus: "current",
});

export function usePwaLifecycle() {
  return useContext(PwaLifecycleContext);
}

function isDeployBuild(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{7,40}$/i.test(value);
}

export default function ServiceWorkerRegistration({
  children,
}: {
  children?: ReactNode;
}) {
  const { data: session, status } = useSession();
  const [deployedBuild, setDeployedBuild] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] =
    useState<PwaUpdateStatus>("current");
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const sessionStatusRef = useRef(status);
  const sessionIdRef = useRef(session?.user?.id ?? null);
  const hasClearedUserCachesRef = useRef(false);
  const checkPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    sessionStatusRef.current = status;
    sessionIdRef.current = session?.user?.id ?? null;
  }, [session?.user?.id, status]);

  const clearUserCaches = () => {
    if (hasClearedUserCachesRef.current || !("serviceWorker" in navigator)) {
      return;
    }

    const worker =
      registrationRef.current?.active ?? navigator.serviceWorker.controller;
    if (!worker) {
      return;
    }

    worker.postMessage({ type: "CLEAR_USER_CACHES" } satisfies WorkerMessage);
    hasClearedUserCachesRef.current = true;
  };

  const syncDocumentCacheSession = () => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const worker =
      registrationRef.current?.active ?? navigator.serviceWorker.controller;
    worker?.postMessage({
      type: "SET_DOCUMENT_CACHE_SESSION",
      sessionId: sessionIdRef.current,
    } satisfies WorkerMessage);
  };

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const receiveWorkerMessage = (event: MessageEvent<WorkerMessage>) => {
      if (
        event.data?.type === "THUMBNAIL_USED" &&
        typeof event.data.url === "string"
      ) {
        void recordThumbnailAccess(event.data.url).catch(() => undefined);
      }
    };

    const handleControllerChange = () => {
      syncDocumentCacheSession();
      if (sessionStatusRef.current === "unauthenticated") {
        clearUserCaches();
      }
    };

    const runUpdateCheck = async () => {
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as { version?: unknown };
        if (!isDeployBuild(body.version)) {
          return;
        }

        setDeployedBuild(body.version);
        if (body.version === appBuild) {
          setUpdateStatus("current");
          return;
        }

        setUpdateStatus("available");
        const registration = await navigator.serviceWorker.register(
          `/sw.js?v=${encodeURIComponent(body.version)}`,
          {
            scope: "/",
            updateViaCache: "none",
          },
        );

        if (registration.waiting) {
          setUpdateStatus("ready");
          return;
        }

        const installing = registration.installing;
        if (installing) {
          const handleStateChange = () => {
            if (installing.state === "installed" && registration.waiting) {
              setUpdateStatus("ready");
              installing.removeEventListener("statechange", handleStateChange);
            }
          };
          installing.addEventListener("statechange", handleStateChange);
        }
      } catch {
        // Update discovery is best-effort and must never block app startup.
      }
    };

    const checkForUpdate = () => {
      if (checkPromiseRef.current) {
        return checkPromiseRef.current;
      }

      const promise = runUpdateCheck().finally(() => {
        if (checkPromiseRef.current === promise) {
          checkPromiseRef.current = null;
        }
      });
      checkPromiseRef.current = promise;
      return promise;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };

    navigator.serviceWorker.addEventListener("message", receiveWorkerMessage);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void (async () => {
      try {
        const existingRegistration =
          await navigator.serviceWorker.getRegistration("/");
        existingRegistration?.waiting?.postMessage({
          type: "ACTIVATE_UPDATE",
        } satisfies WorkerMessage);

        const registration = await navigator.serviceWorker.register(
          serviceWorkerUrl,
          {
            scope: "/",
            updateViaCache: "none",
          },
        );
        registrationRef.current = registration;
        syncDocumentCacheSession();
        if (sessionStatusRef.current === "unauthenticated") {
          clearUserCaches();
        }

        await checkForUpdate();
      } catch {
        // Service-worker registration is best-effort in unsupported/broken clients.
      }
    })();

    return () => {
      navigator.serviceWorker.removeEventListener(
        "message",
        receiveWorkerMessage,
      );
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    syncDocumentCacheSession();

    if (status === "authenticated") {
      hasClearedUserCachesRef.current = false;
      return;
    }

    if (status === "unauthenticated") {
      clearUserCaches();
    }
  }, [session?.user?.id, status]);

  return (
    <PwaLifecycleContext.Provider
      value={{ appBuild, deployedBuild, updateStatus }}
    >
      {children}
    </PwaLifecycleContext.Provider>
  );
}
