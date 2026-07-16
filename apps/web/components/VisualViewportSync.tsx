"use client";

import { useEffect } from "react";

/**
 * Keeps `--vvh` (visual-viewport height), `--vvo` (its top offset), and
 * `--vvb` (the layout-viewport space below it) in sync with the visible area.
 *
 * iOS Safari does not shrink the layout viewport when the on-screen keyboard
 * opens. Centered dialogs use the visible viewport's size and offset; bottom
 * sheets use `--vvb` to keep their lower edge above the keyboard. On desktop
 * and without a keyboard, the vars describe the full window.
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
        `${Math.max(window.innerHeight - vv.height - vv.offsetTop, 0)}px`,
      );
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vvo");
      root.style.removeProperty("--vvb");
    };
  }, []);
  return null;
}
