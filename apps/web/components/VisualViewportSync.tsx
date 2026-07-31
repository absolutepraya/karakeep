"use client";

import { useEffect } from "react";

const KEYBOARD_SETTLE_DELAY_MS = 350;

function isTextEntryControl(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable ||
    (target instanceof HTMLInputElement &&
      ["email", "number", "password", "search", "tel", "text", "url"].includes(
        target.type,
      ))
  );
}

/**
 * Keeps visual viewport variables in sync with the visible area.
 *
 * iOS Safari does not shrink the layout viewport when the on-screen keyboard
 * opens. Centered dialogs use the visible viewport's size and offset. Bottom
 * sheets remain pinned to the screen edge and provide their own safe-area
 * padding. On desktop and without a keyboard, the vars describe the full
 * window.
 */
export default function VisualViewportSync() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const sync = () => {
      root.style.setProperty("--vvh", `${vv.height}px`);
      root.style.setProperty("--vvo", `${vv.offsetTop}px`);
      root.style.setProperty(
        "--vvb",
        `${Math.max(0, window.innerHeight - vv.offsetTop - vv.height)}px`,
      );
    };
    let keyboardSettleTimer: number | undefined;
    const recheckAfterKeyboardSettles = () => {
      if (keyboardSettleTimer !== undefined) {
        window.clearTimeout(keyboardSettleTimer);
      }
      keyboardSettleTimer = window.setTimeout(() => {
        keyboardSettleTimer = undefined;
        sync();
      }, KEYBOARD_SETTLE_DELAY_MS);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (isTextEntryControl(event.target)) {
        recheckAfterKeyboardSettles();
      }
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("focusin", onFocusIn, true);
    return () => {
      if (keyboardSettleTimer !== undefined) {
        window.clearTimeout(keyboardSettleTimer);
      }
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("focusin", onFocusIn, true);
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vvo");
      root.style.removeProperty("--vvb");
    };
  }, []);
  return null;
}
