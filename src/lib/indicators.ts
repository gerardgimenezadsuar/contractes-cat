/**
 * Pure helpers that turn raw aggregates into the indicators shown on entity
 * pages. No imports from the data layer so they can be unit-tested with the
 * Node test runner (tests/unit/indicators.test.ts).
 */

export interface CompetitionAggregate {
  /** Open-procedure contracts with offers and budget recorded. */
  contracts: number;
  avgOffers: number | null;
  singleOfferContracts: number;
  /** Awarded and budget sums over contracts awarded at or below budget. */
  awardedCapped: number;
  budgetCapped: number;
  contractsCapped: number;
}

export interface YearlyRow {
  year: number;
  total: number;
  contracts: number;
  minorsTotal?: number;
  minorsContracts?: number;
}

export type Tone = "good" | "warn" | "neutral";

export interface Comparison {
  label: string;
  tone: Tone;
}

export interface Indicator {
  key: string;
  label: string;
  /** Formatted headline value. */
  value: string;
  /** Short unit or qualifier shown after the value. */
  qualifier?: string;
  /** One plain-language sentence explaining the number. */
  sentence: string;
  comparison?: Comparison;
  source?: string;
}

export function singleOfferShare(c: CompetitionAggregate): number | null {
  return c.contracts > 0 ? c.singleOfferContracts / c.contracts : null;
}

/** Share of the budget saved at award, over contracts awarded at or below budget. */
export function discountShare(c: CompetitionAggregate): number | null {
  if (c.budgetCapped <= 0 || c.contractsCapped === 0) return null;
  return 1 - c.awardedCapped / c.budgetCapped;
}

/** Awarded amount for a year divided by population, or null when either side is missing. */
export function perInhabitant(yearTotal: number | null | undefined, population: number | null | undefined): number | null {
  if (!yearTotal || !population || population <= 0) return null;
  return yearTotal / population;
}

/**
 * Picks the year to headline: the last complete year with data, so partial
 * current-year figures never read as a drop.
 */
export function lastCompleteYear(rows: YearlyRow[], now = new Date()): YearlyRow | null {
  const current = now.getFullYear();
  const candidates = rows.filter((r) => r.year < current && r.year >= 2015 && r.total > 0);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, r) => (r.year > best.year ? r : best));
}

export function minorShare(row: YearlyRow | null): { byAmount: number | null; byCount: number | null } {
  if (!row || row.minorsTotal === undefined || row.minorsContracts === undefined) {
    return { byAmount: null, byCount: null };
  }
  return {
    byAmount: row.total > 0 ? Math.min(1, row.minorsTotal / row.total) : null,
    byCount: row.contracts > 0 ? Math.min(1, row.minorsContracts / row.contracts) : null,
  };
}

/** Share of the amount awarded since `sinceYear` that went to the top N awardees. */
export function concentrationShare(topAmounts: number[], totalSince: number, topN = 5): number | null {
  if (totalSince <= 0 || topAmounts.length === 0) return null;
  const top = topAmounts
    .slice()
    .sort((a, b) => b - a)
    .slice(0, topN)
    .reduce((sum, v) => sum + v, 0);
  return Math.min(1, top / totalSince);
}

export function sumSince(rows: YearlyRow[], sinceYear: number): number {
  return rows.filter((r) => r.year >= sinceYear).reduce((sum, r) => sum + r.total, 0);
}

/**
 * Compares an entity value with the Catalonia baseline. `higherIsBetter`
 * decides the tone; differences under `tolerance` (relative) read as neutral.
 */
export function compareToBaseline(
  value: number | null,
  baseline: number | null,
  higherIsBetter: boolean,
  tolerance = 0.1
): Tone {
  if (value === null || baseline === null || baseline === 0) return "neutral";
  const diff = (value - baseline) / Math.abs(baseline);
  if (Math.abs(diff) < tolerance) return "neutral";
  return diff > 0 === higherIsBetter ? "good" : "warn";
}

// Catalan number formatting kept here so the tests do not depend on Intl
// availability of the "ca" locale in every Node build.
export function formatDecimal(value: number, digits = 1): string {
  const fixed = value.toFixed(digits);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac ? `${grouped},${frac}` : grouped;
}

export function formatPercent(share: number, digits = 0): string {
  return `${formatDecimal(share * 100, digits)} %`;
}

export function formatEuros(value: number): string {
  return `${formatDecimal(value, 0)} €`;
}

/** Catalan compact amount: 6.414,9 M€, 176,3 M€, 86,6 k€, 950 €. */
export function formatCompactEuros(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${formatDecimal(value / 1e9, 2)} mil M€`;
  if (abs >= 1e6) return `${formatDecimal(value / 1e6, 1)} M€`;
  if (abs >= 1e3) return `${formatDecimal(value / 1e3, 1)} k€`;
  return `${formatDecimal(value, 0)} €`;
}

// ---------------------------------------------------------------------------
// Builders used by the entity pages

export interface OrganIndicatorInput {
  yearly: YearlyRow[];
  population: number | null;
  populationYear: string | null;
  competition: CompetitionAggregate | null;
  baseline: CompetitionAggregate | null;
  /** Amounts of the top awardees since `sinceYear`, largest first, with the leader's name. */
  topAmountsSince: number[];
  topNameSince?: string;
  sinceYear: number;
  competitionSinceYear: number;
  now?: Date;
}

function baselineLabel(value: string): string {
  return `Catalunya: ${value}`;
}

function competitionIndicators(
  competition: CompetitionAggregate | null,
  baseline: CompetitionAggregate | null,
  sinceYear: number,
  subject: "organ" | "company"
): Indicator[] {
  if (!competition || competition.contracts === 0) return [];
  const out: Indicator[] = [];
  const n = formatDecimal(competition.contracts, 0);
  const scope =
    subject === "organ"
      ? `procediments oberts amb ofertes informades des de ${sinceYear} (${n} licitacions)`
      : `licitacions obertes guanyades amb ofertes informades des de ${sinceYear} (${n})`;

  if (competition.avgOffers !== null) {
    out.push({
      key: "offers",
      label: "Ofertes per licitació",
      value: formatDecimal(competition.avgOffers, 1),
      qualifier: "de mitjana",
      sentence: `Mitjana d'ofertes rebudes en ${scope}. Més ofertes vol dir més competència.`,
      comparison:
        baseline?.avgOffers != null
          ? { label: baselineLabel(formatDecimal(baseline.avgOffers, 1)), tone: compareToBaseline(competition.avgOffers, baseline.avgOffers, true) }
          : undefined,
    });
  }

  const single = singleOfferShare(competition);
  if (single !== null) {
    const baseSingle = baseline ? singleOfferShare(baseline) : null;
    out.push({
      key: "single-offer",
      label: "Licitacions amb una sola oferta",
      value: formatPercent(single),
      sentence: `${formatDecimal(competition.singleOfferContracts, 0)} de ${n} licitacions van rebre una única oferta. És un senyal d'alerta habitual en contractació.`,
      comparison:
        baseSingle !== null
          ? { label: baselineLabel(formatPercent(baseSingle)), tone: compareToBaseline(single, baseSingle, false) }
          : undefined,
    });
  }

  const discount = discountShare(competition);
  if (discount !== null) {
    const baseDiscount = baseline ? discountShare(baseline) : null;
    out.push({
      key: "discount",
      label: "Rebaixa sobre el pressupost",
      value: formatPercent(discount, 1),
      sentence:
        "Diferència entre el pressupost de licitació i l'import adjudicat, sense IVA, en els mateixos procediments. Una rebaixa baixa sol anar amb poca competència.",
      comparison:
        baseDiscount !== null
          ? { label: baselineLabel(formatPercent(baseDiscount, 1)), tone: compareToBaseline(discount, baseDiscount, true) }
          : undefined,
    });
  }
  return out;
}

export function buildOrganIndicators(input: OrganIndicatorInput): Indicator[] {
  const out: Indicator[] = [];
  const last = lastCompleteYear(input.yearly, input.now);
  const previous = last ? input.yearly.find((r) => r.year === last.year - 1) ?? null : null;

  const perHab = last ? perInhabitant(last.total, input.population) : null;
  if (last && perHab !== null) {
    const prevPerHab = previous ? perInhabitant(previous.total, input.population) : null;
    out.push({
      key: "per-inhabitant",
      label: "Despesa per habitant",
      value: formatEuros(perHab),
      qualifier: `el ${last.year}`,
      sentence: `Import adjudicat l'any (IVA inclòs) dividit per la població del municipi${
        input.populationYear ? ` (${input.populationYear})` : ""
      }. Permet comparar municipis de mida diferent.`,
      comparison:
        prevPerHab !== null
          ? { label: `${formatEuros(prevPerHab)} el ${previous!.year}`, tone: "neutral" }
          : undefined,
      source: "Població: Idescat",
    });
  }

  out.push(...competitionIndicators(input.competition, input.baseline, input.competitionSinceYear, "organ"));

  const minors = minorShare(last);
  if (last && minors.byAmount !== null && minors.byCount !== null) {
    out.push({
      key: "minors",
      label: "Pes dels contractes menors",
      value: formatPercent(minors.byAmount),
      qualifier: "de l'import",
      sentence: `El ${last.year}, ${formatDecimal(last.minorsContracts ?? 0, 0)} contractes menors (${formatPercent(
        minors.byCount
      )} del nombre) van sumar ${formatDecimal((last.minorsTotal ?? 0) / 1e6, 1)} M€ sobre ${formatDecimal(
        last.total / 1e6,
        1
      )} M€ adjudicats.`,
    });
  }

  const sinceTotal = sumSince(input.yearly, input.sinceYear);
  const concentration = concentrationShare(input.topAmountsSince, sinceTotal);
  if (concentration !== null && input.topAmountsSince.length > 0) {
    const leaderShare = Math.min(1, input.topAmountsSince[0] / sinceTotal);
    out.push({
      key: "concentration",
      label: "Concentració de proveïdors",
      value: formatPercent(concentration),
      sentence: `Els cinc primers adjudicataris acumulen el ${formatPercent(concentration)} de l'import adjudicat des de ${
        input.sinceYear
      } (${formatDecimal(sinceTotal / 1e6, 0)} M€).`,
      comparison: input.topNameSince
        ? { label: `Primer: ${input.topNameSince}, ${formatPercent(leaderShare)}`, tone: leaderShare > 0.5 ? "warn" : "neutral" }
        : undefined,
    });
  }
  return out;
}

export function buildCompanyIndicators(
  competition: CompetitionAggregate | null,
  baseline: CompetitionAggregate | null,
  competitionSinceYear: number
): Indicator[] {
  return competitionIndicators(competition, baseline, competitionSinceYear, "company");
}

export function toYearlyRows(
  rows: { year: string; total: string; num_contracts: string; minors_total?: string; minors_count?: string }[]
): YearlyRow[] {
  return rows
    .map((r) => ({
      year: parseInt(r.year, 10),
      total: parseFloat(r.total) || 0,
      contracts: parseInt(r.num_contracts, 10) || 0,
      minorsTotal: r.minors_total !== undefined ? parseFloat(r.minors_total) || 0 : undefined,
      minorsContracts: r.minors_count !== undefined ? parseInt(r.minors_count, 10) || 0 : undefined,
    }))
    .filter((r) => Number.isFinite(r.year));
}
