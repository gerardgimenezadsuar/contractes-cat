import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/constants";
import { countAllPersonNames } from "@/lib/borme";

const PERSONS_PER_SITEMAP = 40000;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const totalPersons = await countAllPersonNames();
  const personSitemapCount = Math.ceil(totalPersons / PERSONS_PER_SITEMAP);
  const sitemapUrls = Array.from({ length: 1 + personSitemapCount }, (_, id) => `${SITE_URL}/sitemap/${id}.xml`);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: sitemapUrls,
    host: SITE_URL,
  };
}
