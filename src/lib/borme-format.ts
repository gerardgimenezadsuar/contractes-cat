import type { CompanyLinkSpan } from "@/lib/borme";

const ENTITY_SUFFIX =
  /\b(SL|SA|SLU|SAU|SLP|SLL|SCCL|S\.?L\.?U?|S\.?A\.?U?|SOCIEDAD|SOCIETAT|AIE|FUNDACION|FUNDACIO|COOPERATIVA)\b\.?$/i;

// Organisations without a legal suffix ("FUTBOL CLUB BARCELONA", "AJUNTAMENT DE ...").
const ENTITY_WORD =
  /\b(CLUB|ASOCIACION|ASSOCIACIO|FEDERACION|FEDERACIO|AYUNTAMIENTO|AJUNTAMENT|CONSORCIO|CONSORCI|DIPUTACION|DIPUTACIO|UNIVERSIDAD|UNIVERSITAT|FUNDACION|FUNDACIO|GENERALITAT)\b/i;

/** True when a BORME officer name is a legal entity rather than a person. */
export function isEntityName(name: string): boolean {
  const trimmed = name.trim();
  return ENTITY_SUFFIX.test(trimmed) || ENTITY_WORD.test(trimmed);
}

function year(d: string | null): string {
  return d && d.length >= 4 ? d.slice(0, 4) : "";
}

/** "des de 2015", "2012–2019" or "2014". */
export function formatSpanPeriod(span: CompanyLinkSpan): string {
  const start = year(span.dateStart);
  if (!span.dateEnd) return start ? `des de ${start}` : "actual";
  const end = year(span.dateEnd);
  return start === end ? start : `${start}–${end}`;
}

/** Short Catalan label for an ownership / administration role. */
export function formatSpanRole(span: CompanyLinkSpan): string {
  if (span.roleClass === "OWNER") return "soci únic";
  const code = span.roleCode.toUpperCase();
  if (code.includes("VICEPRESID")) return "vicepresidència";
  if (code.includes("PRESIDEN")) return "presidència";
  if (code.includes("CONS_DEL") || code.includes("CONS_EJECUT")) return "conseller delegat";
  if (code.includes("SOLID")) return "adm. solidari";
  if (code.includes("CONJUNT") || code.includes("MANC")) return "adm. mancomunat";
  if (code.includes("UNICO")) return "adm. únic";
  return "administració";
}
