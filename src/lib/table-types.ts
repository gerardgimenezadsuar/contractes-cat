export type SortColumn =
  | "denominacio"
  | "procediment"
  | "adjudicatari"
  | "amount"
  | "date"
  | "organ";

export type SortDir = "asc" | "desc";

export interface SortState {
  column: SortColumn;
  dir: SortDir;
}

/** Default direction when a column is first clicked */
export const COLUMN_DEFAULT_DIR: Record<SortColumn, SortDir> = {
  denominacio: "asc",
  procediment: "asc",
  adjudicatari: "asc",
  amount: "desc",
  date: "desc",
  organ: "asc",
};

/** Socrata SoQL order expression for each column */
export const COLUMN_ORDER_EXPR: Record<SortColumn, string> = {
  denominacio: "upper(denominacio)",
  procediment: "upper(procediment)",
  adjudicatari: "upper(denominacio_adjudicatari)",
  amount: "import_adjudicacio_sense::number",
  date: "coalesce(data_adjudicacio_contracte, data_formalitzacio_contracte, data_publicacio_anunci)",
  organ: "upper(nom_organ)",
};

const VALID_COLUMNS = new Set<string>(Object.keys(COLUMN_ORDER_EXPR));

/** Serialize SortState to a URL query param value like "date-desc" */
export function sortStateToParam(s: SortState): string {
  return `${s.column}-${s.dir}`;
}

/** Parse a query param like "date-desc" back into SortState */
export function parseSortParam(
  param: string | null | undefined
): SortState {
  if (!param) return { column: "date", dir: "desc" };
  const lastDash = param.lastIndexOf("-");
  if (lastDash <= 0) return { column: "date", dir: "desc" };
  const col = param.slice(0, lastDash);
  const dir = param.slice(lastDash + 1);
  if (VALID_COLUMNS.has(col) && (dir === "asc" || dir === "desc")) {
    return { column: col as SortColumn, dir };
  }
  return { column: "date", dir: "desc" };
}

/**
 * Given the current sort state and the column that was clicked,
 * compute the next sort state. Same column toggles direction,
 * different column uses that column's default direction.
 */
export function getNextSortState(
  current: SortState,
  clickedColumn: SortColumn
): SortState {
  if (current.column === clickedColumn) {
    return {
      column: clickedColumn,
      dir: current.dir === "asc" ? "desc" : "asc",
    };
  }
  return { column: clickedColumn, dir: COLUMN_DEFAULT_DIR[clickedColumn] };
}
