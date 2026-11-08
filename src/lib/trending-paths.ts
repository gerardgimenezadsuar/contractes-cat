import { isAmbiguousCompanyId } from "./company-identity.ts";

/** With ~900 real visitors a week, one person must not be enough to make the list. */
export const MIN_VISITORS = 3;

export interface PathRow {
  requestPath: string;
  visitors: number;
}

/** Company NIFs from /empreses/<NIF> paths, most visited first. */
export function companyNifsFromPaths(rows: PathRow[]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (row.visitors < MIN_VISITORS) continue;
    const match = safeDecode(row.requestPath).match(/^\/empreses\/([^/?#]+)$/);
    const nif = match?.[1]?.trim().toUpperCase();
    if (!nif || isAmbiguousCompanyId(nif) || out.includes(nif)) continue;
    out.push(nif);
  }
  return out;
}

/** Public-body names from /organismes/<name> paths, most visited first. */
export function organNamesFromPaths(rows: PathRow[]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (row.visitors < MIN_VISITORS) continue;
    const match = safeDecode(row.requestPath).match(/^\/organismes\/([^/?#]+)$/);
    const name = match?.[1]?.trim();
    if (!name || out.includes(name)) continue;
    out.push(name);
  }
  return out;
}

function safeDecode(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}
