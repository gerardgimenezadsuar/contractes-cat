import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/constants";
import { countAllPersonNames } from "@/lib/borme";

// Must match sitemap chunk size: we keep 40,000 URLs per file as a safe buffer under the 50,000 sitemap limit.
const PERSONS_PER_SITEMAP = 40000;
const MIN_PERSON_SITEMAPS = 1;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const totalPersons = await countAllPersonNames();
  // Keep at least one persons sitemap listed even if count cannot be read.
  const personSitemapCount = Math.max(
    MIN_PERSON_SITEMAPS,
    Math.ceil(totalPersons / PERSONS_PER_SITEMAP)
  );
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
