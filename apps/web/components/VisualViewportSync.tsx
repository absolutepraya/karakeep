"use client";

import { useEffect } from "react";

/**
 * Keeps `--vvh` (visual-viewport height) and `--vvo` (its top offset) on the
 * <html> element in sync with the actual visible area.
 *
 * iOS Safari does NOT shrink the layout viewport when the on-screen keyboard
 * opens — it just overlays it. A viewport-centered dialog therefore ends up
 * half-hidden behind the keyboard. Dialogs read these vars (see the
 * `.dialog-vv-center` rule in globals.css) to re-center within the *visible*
 * region and cap their height instead. On desktop / no-keyboard the vars equal
 * the full window, so centering is unchanged.
 */
export default function VisualViewportSync() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const sync = () => {
      root.style.setProperty("--vvh", `${vv.height}px`);
      root.style.setProperty("--vvo", `${vv.offsetTop}px`);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vvo");
    };
  }, []);
  return null;
}
