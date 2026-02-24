import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/constants";
import { listAllPersonNames } from "@/lib/borme";

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));

  const personNames = await listAllPersonNames();
  const personEntries: MetadataRoute.Sitemap = personNames.map((name) => ({
    url: `${SITE_URL}/persones/${encodeURIComponent(name)}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...staticEntries, ...personEntries];
}
