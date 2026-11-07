import { unstable_cache } from "next/cache";
import { loadPersonRanking } from "@/lib/borme";

export type TopVinculacioPosition = "Propietat" | "Administració";

export interface TopVinculacioRow {
  rank: number;
  personName: string;
  /** Contracts (amount without VAT) won while the person owned or administered the company. */
  totalAmountActivePeriod: number;
  totalContractsActivePeriod: number;
  activeCompaniesWithOps: number;
  mainPosition: TopVinculacioPosition;
  mainPositionAmount: number;
  companiesSample: string[];
}

/**
 * Person ranking built daily by scripts/borme_build_company_graph.py
 * (person_ranking table): ownership and administration only, contracts
 * attributed by month to the periods each person held the role, professional
 * administrators (>20 companies) and legal entities excluded.
 */
const loadCachedRanking = unstable_cache(
  async () => {
    const rows = await loadPersonRanking();
    // Do not cache an empty result (Turso unavailable): throw and retry next time.
    if (rows.length === 0) throw new Error("person ranking unavailable");
    return rows;
  },
  ["person-ranking-v1"],
  { revalidate: 21600 }
);

export async function loadTopVinculacions(): Promise<TopVinculacioRow[]> {
  const rows = await loadCachedRanking().catch(() => []);
  return rows.map((row) => ({
    rank: row.rank,
    personName: row.personName,
    totalAmountActivePeriod: row.totalAmount,
    totalContractsActivePeriod: row.numContracts,
    activeCompaniesWithOps: row.numCompanies,
    mainPosition: row.mainRole === "OWNER" ? "Propietat" : "Administració",
    mainPositionAmount: row.mainRoleAmount,
    companiesSample: row.companies,
  }));
}
