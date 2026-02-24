/**
 * Production proxy for development.
 *
 * When PROD_PROXY_URL is set (e.g. "https://www.contractes.cat"), server-side
 * functions that depend on unavailable services (Turso, etc.) can fetch data
 * from the production API instead of returning empty results.
 */

const PROD_PROXY_URL = process.env.PROD_PROXY_URL;

export function prodProxyUrl(): string | null {
  return PROD_PROXY_URL || null;
}

export async function prodFetch<T>(path: string, fallback: T): Promise<T> {
  if (!PROD_PROXY_URL) return fallback;
  try {
    const url = `${PROD_PROXY_URL}${path}`;
    const res = await fetch(url, { next: { revalidate: 180 } });
    if (!res.ok) return fallback;
    return res.json();
  } catch {
    return fallback;
  }
}
