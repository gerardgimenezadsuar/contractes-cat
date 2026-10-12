import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/constants";
import { listPersonNamesPage } from "@/lib/borme";
import { fetchCompanyIdsPage, fetchOrganNamesPage } from "@/lib/api";
import { listSitemapIds, resolveSitemapChunk, URLS_PER_SITEMAP } from "@/lib/sitemap-layout";

const STATIC_ROUTES = [
  "",
  "/about",
  "/cli",
  "/analisi",
  "/contractes",
  "/empreses",
  "/organismes",
  "/persones",
  "/legal",
] as const;

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  const ids = await listSitemapIds();
  return ids.map((id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  // Next 16 passes the sitemap id as a promise.
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const chunk = resolveSitemapChunk(Number(await id));
  if (!chunk) return [];
  const now = new Date();

  if (chunk.kind === "static") {
    return STATIC_ROUTES.map((route) => ({
      url: `${SITE_URL}${route}`,
      lastModified: now,
      changeFrequency: route === "" ? "daily" : "weekly",
      priority: route === "" ? 1 : 0.7,
    }));
  }

  const paths =
    chunk.kind === "persons"
      ? (await listPersonNamesPage(chunk.offset, URLS_PER_SITEMAP)).map(
          (name) => `/persones/${encodeURIComponent(name)}`
        )
      : chunk.kind === "companies"
        ? (await fetchCompanyIdsPage(chunk.offset, URLS_PER_SITEMAP)).map(
            (companyId) => `/empreses/${encodeURIComponent(companyId)}`
          )
        : (await fetchOrganNamesPage(chunk.offset, URLS_PER_SITEMAP)).map(
            (organName) => `/organismes/${encodeURIComponent(organName)}`
          );

  return paths.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));
}
