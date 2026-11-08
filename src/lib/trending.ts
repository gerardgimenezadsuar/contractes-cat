import { fetchAwardeeNamesByNifs } from "@/lib/api";
import { companyNifsFromPaths, organNamesFromPaths, type PathRow } from "@/lib/trending-paths";

/**
 * "Most visited this week" for the home page, read from Vercel Web Analytics.
 *
 * - Needs VERCEL_ANALYTICS_TOKEN (server-only). Without it everything returns
 *   empty and the block is not shown, so forks and local dev just skip it.
 * - Cached for a day in the Next data cache: about two analytics queries and
 *   one Socrata query per day, whatever the traffic.
 * - Spain only: most non-ES pageviews on entity pages are bots running JS.
 * - Companies and public bodies only. No people, and no masked ids (they are
 *   self-employed people): what others look up about a person is not ours to
 *   publish.
 */

const API = "https://api.vercel.com/v1/query/web-analytics/visits/aggregate";
// Not secrets: the token is what grants access.
const PROJECT_ID = process.env.VERCEL_ANALYTICS_PROJECT_ID || "prj_jRuZia6H1hqXZ0UzEzRcz5hwqtdu";
const TEAM_ID = process.env.VERCEL_ANALYTICS_TEAM_ID || "team_ZkHzf2BHitEXSHJaZTEoIjJd";
const CACHE_SECONDS = 86400;
const WINDOW_DAYS = 7;
const TOP_N = 3;

export interface TrendingCompany {
  nif: string;
  name: string;
}

export interface Trending {
  companies: TrendingCompany[];
  organs: string[];
}

async function topPaths(token: string, prefix: string): Promise<PathRow[]> {
  // Day-aligned window so the cache key only changes once a day.
  const until = new Date();
  until.setUTCHours(0, 0, 0, 0);
  const since = new Date(until.getTime() - WINDOW_DAYS * 86400 * 1000);
  const params = new URLSearchParams({
    projectId: PROJECT_ID,
    teamId: TEAM_ID,
    since: since.toISOString(),
    until: until.toISOString(),
    by: "requestPath",
    limit: "15",
    filter: `country eq 'ES' and startswith(requestPath, '${prefix}')`,
  });
  const res = await fetch(`${API}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: CACHE_SECONDS },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Vercel analytics ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ requestPath?: string; visitors?: number }> };
  return (json.data ?? [])
    .filter((row) => row.requestPath && row.requestPath !== "Others")
    .map((row) => ({ requestPath: row.requestPath as string, visitors: row.visitors ?? 0 }));
}

export async function fetchTrending(): Promise<Trending> {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const empty: Trending = { companies: [], organs: [] };
  if (!token) return empty;
  try {
    const [companyRows, organRows] = await Promise.all([topPaths(token, "/empreses/"), topPaths(token, "/organismes/")]);
    const nifs = companyNifsFromPaths(companyRows).slice(0, TOP_N * 2);
    const names = await fetchAwardeeNamesByNifs(nifs);
    return {
      companies: nifs.flatMap((nif) => (names.has(nif) ? [{ nif, name: names.get(nif) as string }] : [])).slice(0, TOP_N),
      organs: organNamesFromPaths(organRows).slice(0, TOP_N),
    };
  } catch (err) {
    console.error("fetchTrending failed:", err);
    return empty;
  }
}
