import { cache } from "react";
import { fetchAwardeeTotalsByNifs, fetchCompanyDetail } from "@/lib/api";
import { loadAdminHistory, type GroupSearchEntry } from "@/lib/borme";
import { classifyControlRole } from "@/lib/borme-roles";
import { isEntityName } from "@/lib/borme-format";
import { buildCompanyHref, isAmbiguousCompanyId } from "@/lib/company-identity";
import { displayCompanyName, formatBormeCompanyName } from "@/lib/company-names";
import { getContractingGroups } from "@/lib/group-search";
import { tokenizeSearch } from "@/lib/search-query";
import { formatCompactEuros, toYearlyRows } from "@/lib/indicators";
import { formatPersonDisplayName } from "@/lib/person-utils";
import { formatNumber } from "@/lib/utils";

/** Fallback example, also used by the /connexions link on the home page. */
export const HOME_EXAMPLE_NIF = "A08146367";

const EXAMPLES = 3;
const MIN_TOTAL = 1_000_000;
const SAMPLE_NIFS = 40;
const DETAIL_ATTEMPTS = 6;
const YEARS_SHOWN = 8;
const PEOPLE_SHOWN = 2;

/** Everything the example card shows, pre-formatted on the server. */
export interface ExampleProfile {
  nif: string;
  name: string;
  href: string;
  totalLabel: string;
  contractsLabel: string;
  firstYear: number;
  lastYear: number;
  years: { year: number; total: number; label: string }[];
  people: { key: string; label: string; href: string | null; role: string }[];
  group: { href: string; name: string; detail: string } | null;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function buildProfile(nif: string, group: GroupSearchEntry | null): Promise<ExampleProfile | null> {
  const [detail, admin] = await Promise.all([
    fetchCompanyDetail(nif).catch(() => null),
    loadAdminHistory(nif).catch(() => null),
  ]);
  const company = detail?.company;
  if (!company) return null;
  const total = parseFloat(company.total) || 0;
  const contracts = parseInt(company.num_contracts, 10) || 0;

  // Current owners and administrators, earliest start per person; people before companies.
  const officers = new Map<string, { name: string; role: string; since: string }>();
  for (const span of admin?.spans ?? []) {
    if (span.date_end) continue;
    const control = classifyControlRole(span.relation_type, span.role_title_code);
    if (!control) continue;
    const since = (span.date_start || "").slice(0, 4);
    // BORME writes the same person as "Nom Cognoms" and "Cognoms Nom": same words, same person.
    const key = tokenizeSearch(span.person_name).sort().join(" ") || span.person_name;
    const existing = officers.get(key);
    if (!existing || (since && since < existing.since)) {
      officers.set(key, { name: span.person_name, role: control === "OWNER" ? "soci únic" : "administració", since });
    }
  }
  const people = [...officers.values()]
    .sort((a, b) => Number(isEntityName(a.name)) - Number(isEntityName(b.name)) || a.since.localeCompare(b.since))
    .slice(0, PEOPLE_SHOWN)
    .map((p) => ({
      key: p.name,
      label: isEntityName(p.name) ? formatBormeCompanyName(p.name) : formatPersonDisplayName(p.name),
      href: isEntityName(p.name) ? null : `/persones/${encodeURIComponent(p.name)}`,
      role: p.since ? `${p.role} · ${p.since}` : p.role,
    }));

  const currentYear = new Date().getFullYear();
  const firstYear = currentYear - YEARS_SHOWN + 1;
  const rows = toYearlyRows(detail.yearly);
  const years = Array.from({ length: YEARS_SHOWN }, (_, i) => firstYear + i).map((year) => {
    const amount = rows.find((r) => r.year === year)?.total ?? 0;
    return { year, total: amount, label: `${year}: ${formatCompactEuros(amount)}` };
  });

  return {
    nif,
    name: company.denominacio_adjudicatari,
    href: buildCompanyHref(nif, company.denominacio_adjudicatari),
    totalLabel: formatCompactEuros(total),
    contractsLabel: `${contracts === 1 ? "1 contracte" : `${formatNumber(contracts)} contractes`}, IVA inclòs`,
    firstYear,
    lastYear: currentYear,
    years,
    people,
    group:
      group && group.size > 1
        ? {
            href: `/grups/${group.groupId}`,
            name: displayCompanyName(group.rootName, false),
            detail: `${formatNumber(group.size)} empreses · ${formatCompactEuros(group.totalAmount)} plegades`,
          }
        : null,
  };
}

/**
 * A few companies to show as examples of a profile: members of a business
 * group, with more than 1 M€ in contracts and named owners or administrators.
 * Picked at random on each revalidation. React `cache` keeps both placements
 * on the page (desktop hero, phone body) on the same picks.
 */
export const getExampleProfiles = cache(async (): Promise<ExampleProfile[]> => {
  const groups = await getContractingGroups().catch(() => [] as GroupSearchEntry[]);
  const groupByNif = new Map<string, GroupSearchEntry>();
  for (const group of groups) {
    for (const member of group.members) {
      if (member.nif && !isAmbiguousCompanyId(member.nif)) groupByNif.set(member.nif.toUpperCase(), group);
    }
  }

  const sample = shuffle([...groupByNif.keys()]).slice(0, SAMPLE_NIFS);
  const totals = sample.length > 0 ? await fetchAwardeeTotalsByNifs(sample).catch(() => new Map()) : new Map();
  const candidates = sample.filter((nif) => (totals.get(nif)?.total ?? 0) > MIN_TOTAL).slice(0, DETAIL_ATTEMPTS);

  const built = await Promise.all(candidates.map((nif) => buildProfile(nif, groupByNif.get(nif) ?? null)));
  const profiles = built.filter((p): p is ExampleProfile => Boolean(p && p.people.length > 0)).slice(0, EXAMPLES);
  if (profiles.length > 0) return profiles;

  const fallback = await buildProfile(HOME_EXAMPLE_NIF, groupByNif.get(HOME_EXAMPLE_NIF) ?? null);
  return fallback ? [fallback] : [];
});
