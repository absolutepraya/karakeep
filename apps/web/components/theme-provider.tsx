"use client";

import type { ThemeProviderProps } from "@teispace/next-themes";
import {
  ThemeProvider as NextThemesProvider,
  useTheme,
} from "@teispace/next-themes";
import * as React from "react";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider scriptProps={{ "data-cfasync": "false" }} {...props}>
      {children}
    </NextThemesProvider>
  );
}

export function useToggleTheme() {
  const { theme, setTheme } = useTheme();
  if (theme == "dark") {
    return () => setTheme("light");
  } else {
    return () => setTheme("dark");
  }
}
