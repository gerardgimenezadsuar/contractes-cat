export function isMaskedCompanyId(id: string): boolean {
  return id.includes("**");
}

export function normalizeCompanyName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

export function buildCompanyIdentityKey(id: string, name: string): string {
  if (!isMaskedCompanyId(id)) return id;
  return `${id}||${normalizeCompanyName(name)}`;
}

export function buildCompanyHref(id: string, name: string): string {
  const base = `/empreses/${encodeURIComponent(id)}`;
  if (!isMaskedCompanyId(id)) return base;
  const trimmed = name.trim();
  if (!trimmed) return base;
  return `${base}?name=${encodeURIComponent(trimmed)}`;
}
