"use client";

import { createContext, useContext } from "react";

// Server-derived rendering hints that are NOT user settings. Right now this is
// just a coarse "is this a phone" guess from the request User-Agent.
//
// Why it exists: the masonry grid (react-masonry-css) bakes its column count
// into the server-rendered HTML, but the server has no idea how wide the
// viewport is. Without a hint it always emits the desktop column count, so a
// phone paints the (too-wide) desktop layout from the SSR HTML and only drops
// to 2 columns once JS hydrates and measures `window` — a visible flash. Giving
// the grid a server hint lets the very first paint match the device.
export interface ServerHints {
  isMobile: boolean;
}

export const ServerHintsCtx = createContext<ServerHints>({ isMobile: false });

export function useServerIsMobile() {
  return useContext(ServerHintsCtx).isMobile;
}
