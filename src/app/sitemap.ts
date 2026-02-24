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

const PERSONS_PER_SITEMAP = 40000;

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  const totalPersons = await countAllPersonNames();
  const personSitemapCount = Math.ceil(totalPersons / PERSONS_PER_SITEMAP);
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
