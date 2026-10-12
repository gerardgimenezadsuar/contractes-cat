// Ids shorter than this are placeholders ("0", "UTE", "N/A", "-", "||"...)
// shared by unrelated awardees. Keep in sync with AMBIGUOUS_ID_SOQL in api.ts.
export const MIN_COMPANY_ID_LENGTH = 5;

/**
 * True when the id alone doesn't identify a company: masked personal ids
 * ("*** 1234 **") or placeholder values. Such awardees are identified by
 * (id, name) instead.
 */
export function isAmbiguousCompanyId(id: string): boolean {
  return id.includes("**") || id.trim().length < MIN_COMPANY_ID_LENGTH;
}

export function normalizeCompanyName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

export function buildCompanyIdentityKey(id: string, name: string): string {
  if (!isAmbiguousCompanyId(id)) return id;
  return `${id}||${normalizeCompanyName(name)}`;
}

export function buildCompanyHref(id: string, name: string): string {
  const base = `/empreses/${encodeURIComponent(id)}`;
  if (!isAmbiguousCompanyId(id)) return base;
  const trimmed = name.trim();
  if (!trimmed) return base;
  return `${base}?name=${encodeURIComponent(trimmed)}`;
}
