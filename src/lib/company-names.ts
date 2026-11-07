const LEGAL_TOKENS = /\b(Sl|Sa|Slu|Sau|Slp|Sll|Sccl|Scp|Aie|Ute|S\.l|S\.a|S\.l\.u|S\.a\.u)\b\.?/g;

/** Unicode-aware title case: "COMPAÑIA ESPAÑOLA" -> "Compañia Española" (not "CompañIa"). */
function titleCaseUnicode(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-'’/(.,&])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** BORME names are uppercase: title-case them but keep legal forms (SL, SA…) uppercase. */
export function formatBormeCompanyName(name: string): string {
  return titleCaseUnicode(name).replace(LEGAL_TOKENS, (m) => m.toUpperCase());
}

/**
 * Display name for a company coming from Turso: the contracts-dataset name
 * (`matched_name`) is kept as published unless it is all caps; BORME names
 * are reformatted.
 */
export function displayCompanyName(name: string, hasMatchedName: boolean): string {
  if (hasMatchedName && name !== name.toUpperCase()) return name;
  return formatBormeCompanyName(name);
}
