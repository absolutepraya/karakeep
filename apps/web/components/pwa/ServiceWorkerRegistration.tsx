"use client";

import { useEffect, useRef } from "react";

import { useSession } from "@/lib/auth/client";
import { recordThumbnailAccess } from "@/lib/offline-library/repository";

type WorkerMessage =
  | { type: "CLEAR_USER_CACHES" }
  | { type: "SET_DOCUMENT_CACHE_SESSION"; sessionId: string | null }
  | { type: "THUMBNAIL_USED"; url: string };

const serviceWorkerBuildVersion =
  process.env.NEXT_PUBLIC_SERVICE_WORKER_BUILD_VERSION;
const serviceWorkerUrl = serviceWorkerBuildVersion
  ? `/sw.js?v=${encodeURIComponent(serviceWorkerBuildVersion)}`
  : "/sw.js";

export default function ServiceWorkerRegistration() {
  const { data: session, status } = useSession();
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const sessionStatusRef = useRef(status);
  const sessionIdRef = useRef(session?.user?.id ?? null);
  const hasClearedUserCachesRef = useRef(false);

  sessionStatusRef.current = status;
  sessionIdRef.current = session?.user?.id ?? null;

  const clearUserCaches = () => {
    if (
      hasClearedUserCachesRef.current ||
      !("serviceWorker" in navigator)
    ) {
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

    navigator.serviceWorker.addEventListener("message", receiveWorkerMessage);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    void navigator.serviceWorker
      .register(serviceWorkerUrl, {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => {
        registrationRef.current = registration;
        syncDocumentCacheSession();
        if (sessionStatusRef.current === "unauthenticated") {
          clearUserCaches();
        }
      })
      .catch(() => undefined);

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
