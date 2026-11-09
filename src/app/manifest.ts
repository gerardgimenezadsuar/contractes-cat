import type { MetadataRoute } from "next";
import { ICON_VERSION, SITE_DESCRIPTION, SITE_NAME } from "@/config/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} · Contractació pública a Catalunya`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: "ca",
    start_url: "/?utm_source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: `/icons/icon-192.png?v=${ICON_VERSION}`, sizes: "192x192", type: "image/png" },
      { src: `/icons/icon-512.png?v=${ICON_VERSION}`, sizes: "512x512", type: "image/png" },
      { src: `/icons/icon-512-maskable.png?v=${ICON_VERSION}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
