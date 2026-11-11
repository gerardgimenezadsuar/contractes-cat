/**
 * Text that search engines and AI answer engines read first on entity pages:
 * titles, meta descriptions and the one-paragraph summary under the H1.
 *
 * The angle is what only contractes.cat combines: who controls a company
 * (BORME owners and administrators) and the public contracts it won.
 * Pure functions with no imports, so they are unit-tested directly.
 */

// PDF parsing artefacts: ~3,000 BORME names absorbed the page header
// ("... BOLETÍN OFICIAL DEL REGISTRO MERCANTIL Núm") or the next role label
// ("...Presidente: ..."). They have no useful person page.
export function isJunkPersonName(name: string): boolean {
  return /REGISTRO MERCANTIL|:/i.test(name);
}

/** "A", "A i B", "A, B i C" */
export function joinCa(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} i ${items[items.length - 1]}`;
}

/** Contract-dataset names often end in stray separators ("ACME, S.L.,"). */
export function cleanEntityName(name: string): string {
  return name.replace(/\s+/g, " ").replace(/[\s,;]+$/, "").trim();
}

function contractsLabel(n: number, formatted: string): string {
  return n === 1 ? "1 contracte públic" : `${formatted} contractes públics`;
}

function yearsLabel(firstYear: number | null, lastYear: number | null): string {
  if (!firstYear || !lastYear) return "";
  return firstYear === lastYear ? ` el ${firstYear}` : ` entre ${firstYear} i ${lastYear}`;
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export interface CompanySeoInput {
  name: string;
  /** Null for masked or ambiguous identifiers, which must not be shown as a NIF. */
  nif: string | null;
  numContracts: number;
  numContractsLabel: string;
  amountLabel: string;
  firstYear: number | null;
  lastYear: number | null;
  topClients: string[];
  hasBorme: boolean;
}

/**
 * People search the company name, so the title leads with it and then shows
 * what other company-data sites don't have: who runs it and how much public
 * money it won. The NIF stays in the description, where it still matches.
 */
export function buildCompanySeoTitle(
  input: Pick<CompanySeoInput, "name" | "hasBorme"> & { amountLabel?: string | null }
): string {
  const name = cleanEntityName(input.name);
  const contracts = input.amountLabel ? `${input.amountLabel} en contractes públics` : "contractes públics";
  return input.hasBorme ? `${name}: administradors i ${contracts}` : `${name}: ${contracts} a Catalunya`;
}

export function buildCompanySeoDescription(input: CompanySeoInput): string {
  const name = cleanEntityName(input.name);
  const id = input.nif ? ` (NIF ${input.nif})` : "";
  const parts = [
    `${name}${id} ha guanyat ${contractsLabel(input.numContracts, input.numContractsLabel)} a Catalunya per ${input.amountLabel}${yearsLabel(input.firstYear, input.lastYear)}.`,
  ];
  const clients = input.topClients.slice(0, 2).map(cleanEntityName).filter(Boolean);
  if (clients.length > 0) parts.push(`Principals clients: ${joinCa(clients)}.`);
  if (input.hasBorme) parts.push("Administradors, propietaris i empreses vinculades segons el BORME.");
  // Many searches from Catalonia are in Spanish; one natural phrase covers them.
  parts.push("Contratos públicos adjudicados en Cataluña.");
  return parts.join(" ");
}

export interface ControllerSpan {
  person_name: string;
  date_end: string | null;
  control: "OWNER" | "ADMIN" | null;
}

export interface Controller {
  /** BORME name, used for the /persones/<name> link. */
  personName: string;
  role: "OWNER" | "ADMIN";
}


export interface KeyPersonSpan extends ControllerSpan {
  date_start: string;
  role_title_raw: string | null;
}

export interface KeyPerson extends Controller {
  /** Short Catalan role label, gender-neutral where BORME doesn't say. */
  title: string;
  /** Year the current role started (earliest current control span), if known. */
  sinceYear: number | null;
}

/** Most to least decisive, for ordering and for picking one label per person. */
const ADMIN_TITLES: Array<[RegExp, string]> = [
  [/UNIC|ÚNIC/i, "Administració única"],
  [/CONS(EJERO)?[\s._]*DEL|DELEGAD/i, "Conseller/a delegat/da"],
  [/CONS[\s._]*EJECUT/i, "Conseller/a executiu/va"],
  [/(?<!VICE[\s._]*)PRESID/i, "Presidència"],
  [/VICE[\s._]*PRES/i, "Vicepresidència"],
  [/SOLID/i, "Administració solidària"],
  [/MANCOM|CONJUNT/i, "Administració mancomunada"],
];

function adminTitle(raw: string | null): { title: string; rank: number } {
  const text = raw ?? "";
  const index = ADMIN_TITLES.findIndex(([pattern]) => pattern.test(text));
  return index >= 0 ? { title: ADMIN_TITLES[index][1], rank: index + 1 } : { title: "Administració", rank: ADMIN_TITLES.length + 1 };
}

/** Roles one person holds at a time. BORME often misses the exit, so older holders are stale. */
const SINGLE_HOLDER_TITLES = new Set(["Soci únic", "Administració única", "Presidència"]);

/**
 * The people to show first on a company page: current sole shareholders, then
 * administrators from the most decisive role down, then the longest-serving.
 * One entry per person, with their strongest current role. For roles only one
 * person can hold, only the latest appointment is kept.
 */
export function companyKeyPeople(spans: KeyPersonSpan[]): KeyPerson[] {
  type Entry = KeyPerson & { rank: number; since: string; roleStart: string };
  const people = new Map<string, Entry>();
  const latestByTitle = new Map<string, string>();
  for (const span of spans) {
    if (span.date_end || !span.control || isJunkPersonName(span.person_name)) continue;
    const { title, rank } =
      span.control === "OWNER" ? { title: "Soci únic", rank: 0 } : adminTitle(span.role_title_raw);
    const start = span.date_start || "";
    if (start > (latestByTitle.get(title) ?? "")) latestByTitle.set(title, start);
    const existing = people.get(span.person_name);
    if (!existing) {
      people.set(span.person_name, { personName: span.person_name, role: span.control, title, rank, since: start, roleStart: start, sinceYear: null });
      continue;
    }
    if (rank < existing.rank || (rank === existing.rank && start > existing.roleStart)) {
      Object.assign(existing, { role: span.control, title, rank, roleStart: start });
    }
    if (start && (!existing.since || start < existing.since)) existing.since = start;
  }
  const NO_DATE = "99999999";
  return [...people.values()]
    .filter((p) => !SINGLE_HOLDER_TITLES.has(p.title) || p.roleStart === latestByTitle.get(p.title))
    .sort((a, b) => a.rank - b.rank || (a.since || NO_DATE).localeCompare(b.since || NO_DATE) || a.personName.localeCompare(b.personName))
    .map(({ personName, role, title, since }) => {
      const year = parseInt(since.slice(0, 4), 10);
      return { personName, role, title, sinceYear: Number.isFinite(year) && year > 1900 ? year : null };
    });
}

/**
 * Current owners and administrators, owners first, split by role. Same people
 * and order as companyKeyPeople, so the page, social card and MCP agree.
 */
export function currentControllers(spans: KeyPersonSpan[]): { owners: KeyPerson[]; admins: KeyPerson[] } {
  const people = companyKeyPeople(spans);
  return { owners: people.filter((p) => p.role === "OWNER"), admins: people.filter((p) => p.role === "ADMIN") };
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export interface PersonSeoInput {
  displayName: string;
  numControlCompanies: number;
  numControlCompaniesWithContracts: number;
  numContracts: number;
  numContractsLabel: string;
  amountLabel: string;
}

export function buildPersonSeoTitle(input: Pick<PersonSeoInput, "displayName" | "numControlCompaniesWithContracts">): string {
  return input.numControlCompaniesWithContracts > 0
    ? `${input.displayName}: empreses que controla i contractes públics`
    : `${input.displayName}: càrrecs en empreses (BORME)`;
}

/**
 * Plain-language answer to "has this person's companies won public contracts?",
 * including the negative cases: a reliable "no" is also an answer nobody else gives.
 * Shown under the H1 and reused in the meta description.
 */
export function buildPersonAnswer(input: PersonSeoInput): string {
  const { displayName } = input;
  if (input.numControlCompanies === 0) {
    return `${displayName} no consta al BORME com a propietari ni administrador de cap empresa, i per tant no li atribuïm contractes públics.`;
  }
  const companies = input.numControlCompanies === 1 ? "1 empresa" : `${input.numControlCompanies} empreses`;
  const withContracts = input.numControlCompaniesWithContracts;
  if (withContracts === 0) {
    const none = input.numControlCompanies === 1
      ? "Aquesta empresa no consta com a adjudicatària de contractes públics a Catalunya."
      : "Cap d'aquestes empreses no consta com a adjudicatària de contractes públics a Catalunya.";
    return `${displayName} té o ha tingut la propietat o l'administració de ${companies} segons el BORME. ${none}`;
  }
  const which = input.numControlCompanies === 1
    ? ", que ha guanyat contractes públics a Catalunya"
    : withContracts === 1
      ? ", 1 de les quals ha guanyat contractes públics a Catalunya"
      : `, ${withContracts} de les quals han guanyat contractes públics a Catalunya`;
  const lead = `${displayName} té o ha tingut la propietat o l'administració de ${companies} segons el BORME${which}.`;
  if (input.numContracts > 0) {
    return `${lead} Mentre en tenia el càrrec, ${input.numControlCompanies === 1 ? "l'empresa va" : "aquestes empreses van"} guanyar ${contractsLabel(input.numContracts, input.numContractsLabel)} per ${input.amountLabel} (sense IVA).`;
  }
  return `${lead} Cap d'aquests contractes no es va adjudicar mentre ${displayName} en tenia la propietat o l'administració.`;
}

export function buildPersonSeoDescription(input: PersonSeoInput): string {
  const spanish = input.numControlCompanies === 0
    ? "Empresas y cargos en el Registro Mercantil."
    : "Empresas que controla y contratos públicos.";
  return `${buildPersonAnswer(input)} ${spanish}`;
}
