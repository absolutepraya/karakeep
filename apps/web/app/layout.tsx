import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import "./globals.css";
import "@fontsource/noto-color-emoji/emoji.css";
import "streamdown/styles.css";

import type { Viewport } from "next";
import React from "react";
import Providers from "@/lib/providers";
import { getUserLocalSettings } from "@/lib/userLocalSettings/userLocalSettings";
import { getServerAuthSession } from "@/server/auth";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";

import { clientConfig } from "@karakeep/shared/config";

// Inter + JetBrains Mono are variable fonts, so we load the full weight range
// (no `weight` needed). Theme preset fonts; emoji stays in the fallback chain.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  fallback: ["Noto Color Emoji", "system-ui", "sans-serif"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  fallback: ["Noto Color Emoji", "ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "Karakeep",
  applicationName: "Karakeep",
  description:
    "The Bookmark Everything app. Hoard links, notes, and images and they will get automatically tagged AI.",
  appleWebApp: {
    capable: true,
    title: "Karakeep",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    // Theme-aware favicon: the icon lives in the browser tab chrome, so it
    // tracks the OS/browser color scheme. Light tab -> dark (black) logo;
    // dark tab -> light (white) logo. favicon.ico remains the legacy fallback.
    icon: [
      {
        url: "/karakeep-dark.svg",
        media: "(prefers-color-scheme: light)",
        type: "image/svg+xml",
      },
      {
        url: "/karakeep-light.svg",
        media: "(prefers-color-scheme: dark)",
        type: "image/svg+xml",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerAuthSession();
  const userSettings = await getUserLocalSettings();
  const isRTL = userSettings.lang === "ar";
  return (
    <html
      lang={userSettings.lang}
      dir={isRTL ? "rtl" : "ltr"}
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <NuqsAdapter>
          <Providers
            session={session}
            clientConfig={clientConfig}
            userLocalSettings={await getUserLocalSettings()}
          >
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
          </Providers>
          <Toaster />
        </NuqsAdapter>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="https://unpkg.com/react-grab@0.1.44/dist/index.global.js"
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
      </body>
    </html>
  );
}
