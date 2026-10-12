import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    // The index lists every sitemap chunk (see app/sitemap.xml/route.ts).
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
