import { promises as fs } from "node:fs";
import path from "node:path";
import { parseCsv } from "@/lib/csv";

export interface TopVinculacioRow {
  rank: number;
  personName: string;
  totalAmountActivePeriod: number;
  totalContractsActivePeriod: number;
  activeCompaniesWithOps: number;
  activeOperationDays: number;
  mainPosition: string;
  mainPositionAmount: number;
  companiesSample: string[];
}

const TOP_CSV_PATH = path.join(
  process.cwd(),
  "data",
  "persones_network",
  "top250_active_operacions.csv"
);

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapMainPosition(raw: string): string {
  if (raw === "ADMINISTRADOR") return "Administrador";
  if (raw === "ORGANO_GOBIERNO") return "Òrgan de govern";
  return raw || "—";
}

export async function loadTopVinculacions(): Promise<TopVinculacioRow[]> {
  let csv: string;
  try {
    csv = await fs.readFile(TOP_CSV_PATH, "utf-8");
  } catch {
    return [];
  }

  const parsed = parseCsv(csv);
  if (parsed.length < 2) return [];

  const [header, ...dataRows] = parsed;
  const idx = new Map<string, number>();
  header.forEach((key, i) => idx.set(key, i));

  const get = (row: string[], key: string) => {
    const i = idx.get(key);
    if (i === undefined) return "";
    return row[i] ?? "";
  };

  return dataRows
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) => {
      const companiesSample = get(row, "companies_sample")
        .split("|")
        .map((v) => v.trim())
        .filter(Boolean);

      return {
        rank: toNumber(get(row, "rank")),
        personName: get(row, "person_name"),
        totalAmountActivePeriod: toNumber(get(row, "total_amount_active_period")),
        totalContractsActivePeriod: toNumber(get(row, "total_contracts_active_period")),
        activeCompaniesWithOps: toNumber(get(row, "active_companies_with_ops")),
        activeOperationDays: toNumber(get(row, "active_operation_days")),
        mainPosition: mapMainPosition(get(row, "main_position")),
        mainPositionAmount: toNumber(get(row, "main_position_amount")),
        companiesSample,
      };
    })
    .filter((row) => row.rank > 0 && row.personName.trim().length > 0)
    .sort((a, b) => a.rank - b.rank);
}
