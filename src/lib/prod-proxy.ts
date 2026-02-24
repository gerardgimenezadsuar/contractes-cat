/**
 * Production proxy for development.
 *
 * When PROD_PROXY_URL is set (e.g. "https://www.contractes.cat"), server-side
 * functions that depend on unavailable services (Turso, etc.) can fetch data
 * from the production API instead of returning empty results.
 */

const PROD_PROXY_URL = process.env.PROD_PROXY_URL;
const NODE_ENV = process.env.NODE_ENV;

function isProdProxyEnabled(): boolean {
  // Safety guard: only enable proxying during local development.
  return NODE_ENV === "development" && Boolean(PROD_PROXY_URL);
}

export async function prodFetch<T>(path: string, fallback: T): Promise<T> {
  if (!isProdProxyEnabled()) return fallback;
  try {
    const url = `${PROD_PROXY_URL}${path}`;
    const res = await fetch(url, { next: { revalidate: 180 } });
    if (!res.ok) return fallback;
    return res.json();
  } catch {
    return fallback;
  }
}
