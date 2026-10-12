import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/constants";
import { listSitemapIds } from "@/lib/sitemap-layout";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const ids = await listSitemapIds();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: ids.map((id) => `${SITE_URL}/sitemap/${id}.xml`),
    host: SITE_URL,
  };
}
