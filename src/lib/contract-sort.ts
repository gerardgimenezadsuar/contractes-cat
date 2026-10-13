// Shared between the contracts API route and the explorer so URLs, the CLI
// and the UI agree on the sort keys.

export const CONTRACT_SORT_OPTIONS = {
  "date-desc": {
    label: "Data (més recents)",
    orderBy: "coalesce(data_adjudicacio_contracte, data_formalitzacio_contracte, data_publicacio_anunci)",
    orderDir: "DESC",
  },
  "date-asc": {
    label: "Data (més antigues)",
    orderBy: "coalesce(data_adjudicacio_contracte, data_formalitzacio_contracte, data_publicacio_anunci)",
    orderDir: "ASC",
  },
  "amount-desc": {
    label: "Import (més alt)",
    orderBy: "import_adjudicacio_sense::number",
    orderDir: "DESC",
  },
  "amount-asc": {
    label: "Import (més baix)",
    orderBy: "import_adjudicacio_sense::number",
    orderDir: "ASC",
  },
} as const satisfies Record<string, { label: string; orderBy: string; orderDir: "ASC" | "DESC" }>;

export type ContractSortKey = keyof typeof CONTRACT_SORT_OPTIONS;

export const DEFAULT_CONTRACT_SORT: ContractSortKey = "date-desc";

export function isContractSortKey(value: unknown): value is ContractSortKey {
  return typeof value === "string" && value in CONTRACT_SORT_OPTIONS;
}
