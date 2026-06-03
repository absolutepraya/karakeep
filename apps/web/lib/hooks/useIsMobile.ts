"use client";

import { useSyncExternalStore } from "react";

// Below Tailwind's `sm` breakpoint (640px).
const MOBILE_QUERY = "(max-width: 639px)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {
      // No matchMedia on the server; nothing to unsubscribe.
    };
  }
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

/**
 * Tracks whether the viewport is in the mobile range (below the `sm`
 * breakpoint, 640px). SSR-safe: reports non-mobile on the server and the first
 * client paint, then corrects after hydration via matchMedia.
 */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
