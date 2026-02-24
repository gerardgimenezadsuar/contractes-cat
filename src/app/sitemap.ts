import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/constants";
import { countAllPersonNames, listPersonNamesPage } from "@/lib/borme";

const STATIC_ROUTES = [
  "",
  "/about",
  "/analisi",
  "/contractes",
  "/empreses",
  "/organismes",
  "/persones",
  "/legal",
] as const;

// Search engines commonly cap each sitemap file at 50,000 URLs.
// We keep a conservative 40,000 limit to leave headroom for growth and avoid edge-case overflows.
const PERSONS_PER_SITEMAP = 40000;
const MIN_PERSON_SITEMAPS = 1;

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  const totalPersons = await countAllPersonNames();
  // Keep at least one dynamic persons sitemap even if counting fails temporarily.
  // This avoids dropping all person URLs from discovery during transient DB outages.
  const personSitemapCount = Math.max(
    MIN_PERSON_SITEMAPS,
    Math.ceil(totalPersons / PERSONS_PER_SITEMAP)
  );
  const totalSitemaps = 1 + personSitemapCount; // id 0 is static routes.
  return Array.from({ length: totalSitemaps }, (_, id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  if (id === 0) {
    return STATIC_ROUTES.map((route) => ({
      url: `${SITE_URL}${route}`,
      lastModified: now,
      changeFrequency: route === "" ? "daily" : "weekly",
      priority: route === "" ? 1 : 0.7,
    }));
  }

  const offset = (id - 1) * PERSONS_PER_SITEMAP;
  const personNames = await listPersonNamesPage(offset, PERSONS_PER_SITEMAP);
  return personNames.map((name) => ({
    url: `${SITE_URL}/persones/${encodeURIComponent(name)}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));
}
