import type { MetadataRoute } from "next";
import { MARKA } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: MARKA.name,
    short_name: MARKA.name,
    description: MARKA.description,
    background_color: "#ffffff",
    theme_color: "#ffffff",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    icons: [
      {
        src: "/brand/marka/marka-icon-16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/brand/marka/marka-icon-48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/brand/marka/marka-icon-128.png",
        sizes: "128x128",
        type: "image/png",
      },
      {
        src: "/brand/marka/marka-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/marka/marka-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/marka/marka-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/marka/marka-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/desktop.png",
        sizes: "3840x2307",
        type: "image/png",
        form_factor: "wide",
        label: `${MARKA.name} desktop bookmark library`,
      },
      {
        src: "/screenshots/mobile.png",
        sizes: "692x1498",
        type: "image/png",
        form_factor: "narrow",
        label: `${MARKA.name} mobile bookmark library`,
      },
    ],
  };
}
