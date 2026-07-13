"use client";

import { useEffect, useRef } from "react";

import { useSession } from "@/lib/auth/client";
import { recordThumbnailAccess } from "@/lib/offline-library/repository";

type WorkerMessage =
  | { type: "CLEAR_USER_CACHES" }
  | { type: "THUMBNAIL_USED"; url: string };

export default function ServiceWorkerRegistration() {
  const { status } = useSession();
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const sessionStatusRef = useRef(status);
  const hasClearedUserCachesRef = useRef(false);

  sessionStatusRef.current = status;

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
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => {
        registrationRef.current = registration;
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
    if (status === "authenticated") {
      hasClearedUserCachesRef.current = false;
      return;
    }

    if (status === "unauthenticated") {
      clearUserCaches();
    }
  }, [status]);

  return null;
}
