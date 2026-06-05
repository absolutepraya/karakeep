"use client";

import type { z } from "zod";
import { createContext, useContext } from "react";
import { fallbackLng } from "@/lib/i18n/settings";

import type { BookmarksLayoutTypes, zUserLocalSettings } from "./types";

const defaultLayout: BookmarksLayoutTypes = "masonry";

export const UserLocalSettingsCtx = createContext<
  z.infer<typeof zUserLocalSettings>
>({
  bookmarkGridLayout: defaultLayout,
  lang: fallbackLng,
  gridColumns: 3,
  showNotes: false,
  showTags: true,
  showTitle: true,
  imageFit: "cover",
});

function useUserLocalSettings() {
  return useContext(UserLocalSettingsCtx);
}

export function useBookmarkDisplaySettings() {
  const settings = useUserLocalSettings();
  return {
    showNotes: settings.showNotes,
    showTags: settings.showTags,
    showTitle: settings.showTitle,
    imageFit: settings.imageFit,
  };
}

export function useBookmarkLayout() {
  // The stored layout applies on every screen size. Multi-column layouts
  // (masonry/grid) just render fewer columns on smaller viewports (capped at 2
  // on phones - see BookmarksGrid), so mobile defaults to a 2-column masonry
  // and the user can still switch layouts via the view options.
  return useUserLocalSettings().bookmarkGridLayout;
}

export function useInterfaceLang() {
  const settings = useUserLocalSettings();
  return settings.lang;
}

export function useGridColumns() {
  const settings = useUserLocalSettings();
  return settings.gridColumns;
}

export function bookmarkLayoutSwitch<T>(
  layout: BookmarksLayoutTypes,
  data: Record<BookmarksLayoutTypes, T>,
) {
  return data[layout];
}

export function useBookmarkLayoutSwitch<T>(
  data: Record<BookmarksLayoutTypes, T>,
) {
  const layout = useBookmarkLayout();
  return data[layout];
}
