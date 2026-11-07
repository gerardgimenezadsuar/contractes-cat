/**
 * Which BORME roles mean real control of a company. Mirrors role_class() in
 * scripts/borme_build_company_graph.py so the company network and the person
 * pages use the same definition.
 *
 *   OWNER  sole shareholder (socio / accionista único)
 *   ADMIN  administrators (except insolvency, judicial and substitute ones)
 *          and board control roles (president, vice-president, CEO)
 *   null   everything else: apoderats, plain consejeros, secretaries,
 *          liquidators, ...
 */
export type ControlRole = "OWNER" | "ADMIN";

const CONTROL_BOARD = /(PRESIDEN|VICEPRESID|COPRESID|CONS_DEL|CONS_EJECUT)/;
const EXCLUDED_ADMIN = /(CONCURS|CONC$|JUDICIAL|SUPL|SUP_MAN)/;

export function classifyControlRole(relationType: string, roleTitleCode: string | null | undefined): ControlRole | null {
  const code = (roleTitleCode || "").toUpperCase();
  if (relationType === "SOCIO_UNICO" || relationType === "ACCIONISTA_UNICO") return "OWNER";
  if (relationType === "ADMINISTRADOR") return EXCLUDED_ADMIN.test(code) ? null : "ADMIN";
  if (relationType === "ORGANO_GOBIERNO") return CONTROL_BOARD.test(code) ? "ADMIN" : null;
  return null;
}

/** Officers in more companies than this are treated as professional administrators. */
export const PROFESSIONAL_ADMIN_THRESHOLD = 20;

/** Merge [start, end] periods (YYYYMMDD, end null = ongoing) into non-overlapping ones. */
export function mergePeriods(periods: Array<{ start: string; end: string | null }>): Array<{ start: string; end: string | null }> {
  const sorted = periods.filter((p) => p.start).sort((a, b) => a.start.localeCompare(b.start));
  const out: Array<{ start: string; end: string | null }> = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && (last.end === null || p.start <= last.end)) {
      if (last.end !== null && (p.end === null || p.end > last.end)) last.end = p.end;
    } else {
      out.push({ ...p });
    }
  }
  return out;
}
