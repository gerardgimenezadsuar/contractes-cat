import { countAllPersonNames } from "@/lib/borme";
import { fetchCompanyIdsCount, fetchOrgansCount } from "@/lib/api";

// Search engines cap each sitemap file at 50,000 URLs. Smaller chunks keep each
// Socrata page well under the 2MB Next.js data-cache limit and the function timeout.
export const URLS_PER_SITEMAP = 10000;

// Each entity type owns a fixed id range, so a chunk can be served without
// knowing the live counts of the other types (and counts drifting never
// shifts which URLs a given sitemap id contains).
export const SITEMAP_RANGES = {
  persons: 1000,
  companies: 2000,
  organs: 3000,
} as const;
const RANGE_SIZE = 1000;

export type SitemapChunk =
  | { kind: "static" }
  | { kind: keyof typeof SITEMAP_RANGES; offset: number };

export function resolveSitemapChunk(id: number): SitemapChunk | null {
  if (id === 0) return { kind: "static" };
  for (const kind of Object.keys(SITEMAP_RANGES) as (keyof typeof SITEMAP_RANGES)[]) {
    const start = SITEMAP_RANGES[kind];
    if (id >= start && id < start + RANGE_SIZE) {
      return { kind, offset: (id - start) * URLS_PER_SITEMAP };
    }
  }
  return null;
}

function chunkIds(start: number, total: number): number[] {
  // Always list at least one chunk per type, even when a count fails.
  const count = Math.min(RANGE_SIZE, Math.max(1, Math.ceil(total / URLS_PER_SITEMAP)));
  return Array.from({ length: count }, (_, i) => start + i);
}

async function safeCount(label: string, fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch (error) {
    console.error(`Sitemap ${label} count failed:`, error);
    return 0;
  }
}

/** All sitemap ids to advertise (robots.txt / generateSitemaps). Never throws. */
export async function listSitemapIds(): Promise<number[]> {
  const [persons, companies, organs] = await Promise.all([
    safeCount("persons", countAllPersonNames),
    safeCount("companies", fetchCompanyIdsCount),
    safeCount("organs", () => fetchOrgansCount()),
  ]);
  return [
    0,
    ...chunkIds(SITEMAP_RANGES.persons, persons),
    ...chunkIds(SITEMAP_RANGES.companies, companies),
    ...chunkIds(SITEMAP_RANGES.organs, organs),
  ];
}
