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

export function buildCompanySeoTitle(input: Pick<CompanySeoInput, "name" | "nif" | "hasBorme">): string {
  const name = cleanEntityName(input.name);
  const id = input.nif ? ` (${input.nif})` : "";
  return `${name}${id}: contractes públics${input.hasBorme ? " i administradors" : " a Catalunya"}`;
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

/** People currently owning or administering the company, owners first, deduplicated. */
export function currentControllers(spans: ControllerSpan[]): { owners: Controller[]; admins: Controller[] } {
  const owners = new Map<string, Controller>();
  const admins = new Map<string, Controller>();
  for (const span of spans) {
    if (span.date_end || !span.control || isJunkPersonName(span.person_name)) continue;
    const target = span.control === "OWNER" ? owners : admins;
    if (!target.has(span.person_name)) target.set(span.person_name, { personName: span.person_name, role: span.control });
  }
  return { owners: [...owners.values()], admins: [...admins.values()] };
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
