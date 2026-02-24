/**
 * Centralized production proxy helpers for local development.
 *
 * When PROD_PROXY_URL is configured in development, server-side reads can
 * fall back to production API endpoints instead of returning empty values.
 */

import type { Contract } from "./types";

const PROD_PROXY_URL = process.env.PROD_PROXY_URL;
const NODE_ENV = process.env.NODE_ENV;
const PROD_PROXY_REVALIDATE_SECONDS = 180;

export interface PersonContractsProxyFallback {
  contracts: Contract[];
  total: number;
  totalAmount: number;
}

export function shouldUseProductionProxy(hasDbClient: boolean, canReadDb: boolean): boolean {
  return !hasDbClient || !canReadDb;
}

function isProductionProxyEnabled(): boolean {
  return NODE_ENV === "development" && Boolean(PROD_PROXY_URL);
}

function buildProductionProxyUrl(path: string): string {
  const base = (PROD_PROXY_URL || "").replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function proxyPathAdminHistory(nif: string): string {
  return `/api/borme/${encodeURIComponent(nif)}`;
}

export function proxyPathPersonProfile(personName: string): string {
  return `/api/persones/${encodeURIComponent(personName)}/profile`;
}

export function proxyPathPersonSearch(query: string, page: number): string {
  const params = new URLSearchParams({
    search: query,
    page: String(page),
  });
  return `/api/persones?${params.toString()}`;
}

export function proxyPathPersonContracts(personName: string, page = 1): string {
  const params = new URLSearchParams({
    page: String(page),
    sort: "date-desc",
  });
  return `/api/persones/${encodeURIComponent(personName)}/contractes?${params.toString()}`;
}

export async function fetchFromProductionProxy<T>(path: string, fallback: T): Promise<T> {
  if (!isProductionProxyEnabled()) return fallback;
  try {
    const url = buildProductionProxyUrl(path);
    const res = await fetch(url, {
      next: { revalidate: PROD_PROXY_REVALIDATE_SECONDS },
    });
    if (!res.ok) return fallback;
    return res.json();
  } catch {
    return fallback;
  }
}

interface ProxyPersonContractsResponse {
  data: Contract[];
  total: number;
  totalAmount: number;
}

export async function fetchPersonContractsProxyFallback(
  personName: string
): Promise<PersonContractsProxyFallback | null> {
  const response = await fetchFromProductionProxy<ProxyPersonContractsResponse | null>(
    proxyPathPersonContracts(personName, 1),
    null
  );
  if (!response || !Array.isArray(response.data) || response.data.length === 0) return null;
  return {
    contracts: response.data,
    total: Number(response.total || 0),
    totalAmount: Number(response.totalAmount || 0),
  };
}
