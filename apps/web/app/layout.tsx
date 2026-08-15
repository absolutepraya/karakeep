import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import "./globals.css";
import "@fontsource/noto-color-emoji/emoji.css";
import "streamdown/styles.css";

import type { Viewport } from "next";
import { headers } from "next/headers";
import React from "react";
import { MARKA } from "@/lib/brand";
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
  fallback: [
    "Apple Color Emoji",
    "Noto Color Emoji",
    "system-ui",
    "sans-serif",
  ],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  fallback: [
    "Apple Color Emoji",
    "Noto Color Emoji",
    "ui-monospace",
    "monospace",
  ],
});

export const metadata: Metadata = {
  title: MARKA.name,
  applicationName: MARKA.name,
  description: MARKA.description,
  appleWebApp: {
    capable: true,
    title: MARKA.name,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    // Theme-aware favicon tracks the OS/browser color scheme.
    icon: [
      {
        url: MARKA.icon.light,
        media: "(prefers-color-scheme: light)",
        type: "image/png",
      },
      {
        url: MARKA.icon.dark,
        media: "(prefers-color-scheme: dark)",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: MARKA.icon.apple,
        sizes: "1024x1024",
        type: "image/png",
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
  // Coarse phone detection so the masonry grid can server-render the right
  // column count on the first paint (phones get <=2 cols) instead of flashing
  // down from the desktop default after hydration. The client still measures
  // the real viewport, so this is only a first-paint hint.
  const userAgent = (await headers()).get("user-agent") ?? "";
  const isMobile = /Mobi/i.test(userAgent);
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
            userLocalSettings={userSettings}
            isMobile={isMobile}
          >
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
          </Providers>
          <Toaster className="mobile-nav-toast-offset" />
        </NuqsAdapter>
        {process.env.NODE_ENV === "development" && (
          <Script
            // React Grab inspects and annotates the DOM. Loading it after the
            // browser is idle keeps it out of React's hydration window,
            // particularly on slower mobile devices.
            src="https://unpkg.com/react-grab@0.1.48/dist/index.global.js"
            strategy="lazyOnload"
            crossOrigin="anonymous"
          />
        )}
      </body>
    </html>
  );
}
