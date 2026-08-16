"use client";

import { useEffect, useRef } from "react";

import { useSession } from "@/lib/auth/client";
import { recordThumbnailAccess } from "@/lib/offline-library/repository";

type WorkerMessage =
  | { type: "ACTIVATE_UPDATE" }
  | { type: "CLEAR_USER_CACHES" }
  | { type: "SET_DOCUMENT_CACHE_SESSION"; sessionId: string | null }
  | { type: "THUMBNAIL_USED"; url: string };

const serviceWorkerBuildVersion =
  process.env.NEXT_PUBLIC_SERVICE_WORKER_BUILD_VERSION;
const serviceWorkerUrl = serviceWorkerBuildVersion
  ? `/sw.js?v=${encodeURIComponent(serviceWorkerBuildVersion)}`
  : "/sw.js";

function isDeployBuild(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{7,40}$/i.test(value);
}

export default function ServiceWorkerRegistration() {
  const { data: session, status } = useSession();
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const sessionStatusRef = useRef(status);
  const sessionIdRef = useRef(session?.user?.id ?? null);
  const hasClearedUserCachesRef = useRef(false);

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

    const checkForUpdate = async () => {
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as { version?: unknown };
        if (
          !isDeployBuild(body.version) ||
          body.version === serviceWorkerBuildVersion
        ) {
          return;
        }

        await navigator.serviceWorker.register(
          `/sw.js?v=${encodeURIComponent(body.version)}`,
          {
            scope: "/",
            updateViaCache: "none",
          },
        );
      } catch {
        // Update discovery is best-effort and must never block app startup.
      }
    };

    navigator.serviceWorker.addEventListener("message", receiveWorkerMessage);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

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

  return null;
}
