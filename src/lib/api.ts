import {
  SOCRATA_BASE_URL,
  CLEAN_AMOUNT_FILTER,
  CLEAN_AMOUNT_SENSE_FILTER,
  REVALIDATE_SECONDS,
  DEFAULT_PAGE_SIZE,
} from "@/config/constants";
import type {
  Contract,
  CompanyAggregation,
  OrganAggregation,
  YearlyAggregation,
  CompanyYearAggregation,
  OrganYearAggregation,
  ProcedureAggregation,
  ContractTypeAggregation,
  CpvAggregation,
  ThresholdBucket,
  ContractFilters,
  MinorRiskEntityAggregation,
  MinorBandSummary,
  MinorShareYear,
} from "./types";
import { CPV_DIVISIONS } from "@/config/constants";

const BEST_AVAILABLE_CONTRACT_DATE_EXPR =
  "coalesce(data_adjudicacio_contracte, data_formalitzacio_contracte, data_publicacio_anunci)";
const MISSING_TEXT_VALUES_SQL =
  "('', '-', '--', '*', '/', 'NULL', 'N/A', 'NA', 'S/D', 'N.D.', 'ND', 'SENSE ADJUDICAR', 'PENDENT D''ADJUDICACIO', 'PENDENT D''ADJUDICACIÓ', 'PENDENT')";
const AWARDED_CONTRACT_WHERE =
  `upper(coalesce(denominacio_adjudicatari,'')) not in ${MISSING_TEXT_VALUES_SQL} AND upper(coalesce(identificacio_adjudicatari,'')) not in ${MISSING_TEXT_VALUES_SQL} AND ${CLEAN_AMOUNT_SENSE_FILTER} AND import_adjudicacio_sense IS NOT NULL AND import_adjudicacio_sense::number > 0`;
const ANALYSIS_MIN_AMOUNT = 500;
const ANALYSIS_BASE_SENSE_WHERE = `${CLEAN_AMOUNT_SENSE_FILTER} AND import_adjudicacio_sense IS NOT NULL AND import_adjudicacio_sense::number >= ${ANALYSIS_MIN_AMOUNT}`;
const MINOR_15K_BASE_WHERE = `procediment='Contracte menor' AND ${ANALYSIS_BASE_SENSE_WHERE} AND import_adjudicacio_sense::number < 15000`;

function parseNonNegativeNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseYearFilter(value: string): number | null {
  if (!/^\d{4}$/.test(value)) return null;
  const parsed = Number(value);
  const currentYear = new Date().getFullYear();
  return parsed >= 2000 && parsed <= currentYear + 1 ? parsed : null;
}

function getContractsFutureCutoffIso(): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 7);
  // Socrata accepts datetime literals like YYYY-MM-DDTHH:MM:SS in comparisons.
  return `${cutoff.toISOString().slice(0, 10)}T23:59:59`;
}

function normalizeSearchTerm(search: string): string {
  return search
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function normalizeSoqlTextExpr(field: string): string {
  return `upper(replace(replace(replace(replace(replace(${field},'.',''),',',''),'-',''),' ',''),'/',''))`;
}

function resolveCpvDivisionCodes(cpvSearch: string): string[] {
  const normalized = normalizeSearchTerm(cpvSearch);
  if (!normalized) return [];

  const isNumericSearch = /^\d+$/.test(normalized);
  const matches: string[] = [];

  for (const [code, label] of Object.entries(CPV_DIVISIONS)) {
    const normalizedLabel = normalizeSearchTerm(label);
    const matchesCode = isNumericSearch
      ? normalized.startsWith(code) || code.startsWith(normalized)
      : code.includes(normalized);

    if (matchesCode || normalizedLabel.includes(normalized)) {
      matches.push(code);
    }
  }

  return matches;
}

function normalizeCpvDivisionCodes(filters?: string[]): string[] {
  if (!filters || filters.length === 0) return [];

  const resolved = new Set<string>();

  for (const token of filters) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    const digits = trimmed.replace(/\D/g, "");
    if (digits.length >= 2) {
      const code = digits.slice(0, 2);
      if (CPV_DIVISIONS[code]) {
        resolved.add(code);
        continue;
      }
    }

    for (const code of resolveCpvDivisionCodes(trimmed)) {
      resolved.add(code);
    }
  }

  return Array.from(resolved);
}

function buildCpvDivisionWhere(cpvFilters?: string[]): string | null {
  if (!cpvFilters || cpvFilters.length === 0) return null;

  const codes = normalizeCpvDivisionCodes(cpvFilters);
  if (codes.length === 0) return "1=0";

  const cpvCodeConditions = codes.map(
    (code) => `(codi_cpv like '${code}%' OR codi_cpv like '%||${code}%')`
  );
  return `codi_cpv IS NOT NULL AND (${cpvCodeConditions.join(" OR ")})`;
}

function buildLooseSearchCondition(search: string, fields: string[]): string {
  const safeSearch = search.replace(/'/g, "''");
  const exactParts = fields.map(
    (field) => `upper(${field}) like upper('%${safeSearch}%')`
  );

  const normalized = normalizeSearchTerm(search);
  if (!normalized) return `(${exactParts.join(" OR ")})`;

  const normalizedParts = fields.map(
    (field) =>
      `${normalizeSoqlTextExpr(field)} like upper('%${normalized}%')`
  );

  return `(${exactParts.join(" OR ")} OR ${normalizedParts.join(" OR ")})`;
}

async function soqlFetch<T>(params: Record<string, string>): Promise<T[]> {
  const url = new URL(SOCRATA_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Socrata API error:", text);
    throw new Error(`Socrata API error: ${res.status}`);
  }

  return res.json();
}

// Dashboard stats
export async function fetchTotalContracts(): Promise<number> {
  const data = await soqlFetch<{ total: string }>({
    $select: "count(*) as total",
  });
  return parseInt(data[0]?.total || "0", 10);
}

export async function fetchTotalAmount(): Promise<number> {
  const data = await soqlFetch<{ total: string }>({
    $select: "sum(import_adjudicacio_amb_iva::number) as total",
    $where: `${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL`,
  });
  return parseFloat(data[0]?.total || "0");
}

export async function fetchUniqueCompanies(): Promise<number> {
  const data = await soqlFetch<{ total: string }>({
    $select: "count(distinct identificacio_adjudicatari) as total",
    $where: "identificacio_adjudicatari IS NOT NULL",
  });
  return parseInt(data[0]?.total || "0", 10);
}

// Merge rows with the same NIF into a single entry
function mergeByNif(rows: CompanyAggregation[]): CompanyAggregation[] {
  const map = new Map<
    string,
    {
      name: string;
      total: number;
      contracts: number;
      totalCurrentYear: number;
      bestTotal: number;
    }
  >();

  for (const row of rows) {
    const nif = row.identificacio_adjudicatari;
    const total = parseFloat(row.total) || 0;
    const contracts = parseInt(row.num_contracts, 10) || 0;
    const totalCurrentYear = parseFloat(row.total_current_year || "0") || 0;
    const existing = map.get(nif);

    if (existing) {
      existing.total += total;
      existing.contracts += contracts;
      existing.totalCurrentYear += totalCurrentYear;
      // Keep the name from the sub-group with the highest total (most-used name)
      if (total > existing.bestTotal) {
        existing.name = row.denominacio_adjudicatari;
        existing.bestTotal = total;
      }
    } else {
      map.set(nif, {
        name: row.denominacio_adjudicatari,
        total,
        contracts,
        totalCurrentYear,
        bestTotal: total,
      });
    }
  }

  return Array.from(map.entries())
    .map(([nif, data]) => ({
      identificacio_adjudicatari: nif,
      denominacio_adjudicatari: data.name,
      total: String(data.total),
      num_contracts: String(data.contracts),
      total_current_year: String(data.totalCurrentYear),
    }))
    .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));
}

// Top companies (merged by NIF)
export async function fetchTopCompanies(
  limit = 10,
  options?: { minYear?: number; maxYear?: number }
): Promise<CompanyAggregation[]> {
  const conditions = [
    CLEAN_AMOUNT_FILTER,
    "import_adjudicacio_amb_iva IS NOT NULL",
    "denominacio_adjudicatari IS NOT NULL",
    "identificacio_adjudicatari IS NOT NULL",
  ];
  if (options?.minYear !== undefined || options?.maxYear !== undefined) {
    conditions.push("data_adjudicacio_contracte IS NOT NULL");
  }
  if (options?.minYear !== undefined) {
    conditions.push(`date_extract_y(data_adjudicacio_contracte) >= ${options.minYear}`);
  }
  if (options?.maxYear !== undefined) {
    conditions.push(`date_extract_y(data_adjudicacio_contracte) <= ${options.maxYear}`);
  }

  // Over-fetch to account for name variations, then merge
  const raw = await soqlFetch<CompanyAggregation>({
    $select:
      "identificacio_adjudicatari, denominacio_adjudicatari, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
    $where: conditions.join(" AND "),
    $group: "identificacio_adjudicatari, denominacio_adjudicatari",
    $order: "total DESC",
    $limit: String(limit * 8),
  });
  return mergeByNif(raw).slice(0, limit);
}

// Yearly trend
export async function fetchYearlyTrend(): Promise<YearlyAggregation[]> {
  const data = await soqlFetch<YearlyAggregation>({
    $select:
      "date_extract_y(data_adjudicacio_contracte) as year, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
    $where: `${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND data_adjudicacio_contracte IS NOT NULL`,
    $group: "year",
    $order: "year ASC",
    $limit: "50",
  });
  // Filter reasonable years
  return data.filter((d) => {
    const y = parseInt(d.year);
    return y >= 2015 && y <= new Date().getFullYear() + 1;
  });
}

// Companies list (paginated, merged by NIF)
export async function fetchCompanies(
  offset = 0,
  limit = DEFAULT_PAGE_SIZE,
  search?: string,
  cpvFilters?: string[]
): Promise<CompanyAggregation[]> {
  const currentYear = new Date().getFullYear();
  const conditions = [
    CLEAN_AMOUNT_FILTER,
    "import_adjudicacio_amb_iva IS NOT NULL",
    "denominacio_adjudicatari IS NOT NULL",
    "identificacio_adjudicatari IS NOT NULL",
  ];
  if (search) {
    const safe = search.replace(/'/g, "''");
    conditions.push(
      `(upper(denominacio_adjudicatari) like upper('%${safe}%') OR upper(identificacio_adjudicatari) like upper('%${safe}%'))`
    );
  }
  const cpvWhere = buildCpvDivisionWhere(cpvFilters);
  if (cpvWhere) conditions.push(cpvWhere);

  // Over-fetch then merge by NIF to handle name variations
  const fetchLimit = (offset + limit) * 6;
  const raw = await soqlFetch<CompanyAggregation>({
    $select:
      "identificacio_adjudicatari, denominacio_adjudicatari, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
    $where: conditions.join(" AND "),
    $group: "identificacio_adjudicatari, denominacio_adjudicatari",
    $order: "total DESC",
    $limit: String(fetchLimit),
  });

  const merged = mergeByNif(raw);
  const pageRows = merged.slice(offset, offset + limit);
  if (pageRows.length === 0) return pageRows;

  const escapedNifs = pageRows
    .map((row) => `'${row.identificacio_adjudicatari.replace(/'/g, "''")}'`)
    .join(", ");
  const currentYearRows = await soqlFetch<{ identificacio_adjudicatari: string; total_current_year: string }>({
    $select:
      "identificacio_adjudicatari, sum(import_adjudicacio_amb_iva::number) as total_current_year",
    $where: `${conditions.join(" AND ")} AND data_adjudicacio_contracte IS NOT NULL AND date_extract_y(data_adjudicacio_contracte)=${currentYear} AND identificacio_adjudicatari IN (${escapedNifs})`,
    $group: "identificacio_adjudicatari",
    $limit: String(limit),
  });

  const currentYearMap = new Map(
    currentYearRows.map((row) => [row.identificacio_adjudicatari, row.total_current_year || "0"])
  );

  return pageRows.map((row) => ({
    ...row,
    total_current_year: currentYearMap.get(row.identificacio_adjudicatari) || "0",
  }));
}

export async function fetchCompaniesCount(
  search?: string,
  cpvFilters?: string[]
): Promise<number> {
  const conditions = [
    CLEAN_AMOUNT_FILTER,
    "import_adjudicacio_amb_iva IS NOT NULL",
    "denominacio_adjudicatari IS NOT NULL",
    "identificacio_adjudicatari IS NOT NULL",
  ];
  if (search) {
    const safe = search.replace(/'/g, "''");
    conditions.push(
      `(upper(denominacio_adjudicatari) like upper('%${safe}%') OR upper(identificacio_adjudicatari) like upper('%${safe}%'))`
    );
  }
  const cpvWhere = buildCpvDivisionWhere(cpvFilters);
  if (cpvWhere) conditions.push(cpvWhere);

  const data = await soqlFetch<{ total: string }>({
    $select: "count(distinct identificacio_adjudicatari) as total",
    $where: conditions.join(" AND "),
  });
  return parseInt(data[0]?.total || "0", 10);
}

// Organismes list (paginated)
export async function fetchOrgans(
  offset = 0,
  limit = DEFAULT_PAGE_SIZE,
  search?: string,
  options?: { includeCurrentYear?: boolean }
): Promise<OrganAggregation[]> {
  const currentYear = new Date().getFullYear();
  const includeCurrentYear = options?.includeCurrentYear !== false;
  const conditions = [
    CLEAN_AMOUNT_FILTER,
    "import_adjudicacio_amb_iva IS NOT NULL",
    "nom_organ IS NOT NULL",
  ];

  if (search) {
    const safe = search.replace(/'/g, "''");
    conditions.push(`upper(nom_organ) like upper('%${safe}%')`);
  }

  const rows = await soqlFetch<OrganAggregation>({
    $select:
      "nom_organ, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
    $where: conditions.join(" AND "),
    $group: "nom_organ",
    $order: "total DESC",
    $limit: String(limit),
    $offset: String(offset),
  });

  if (rows.length === 0 || !includeCurrentYear) return rows;

  const escapedNames = rows
    .map((row) => `'${row.nom_organ.replace(/'/g, "''")}'`)
    .join(", ");
  const currentYearRows = await soqlFetch<{ nom_organ: string; total_current_year: string }>({
    $select: "nom_organ, sum(import_adjudicacio_amb_iva::number) as total_current_year",
    $where: `${conditions.join(" AND ")} AND data_adjudicacio_contracte IS NOT NULL AND date_extract_y(data_adjudicacio_contracte)=${currentYear} AND nom_organ IN (${escapedNames})`,
    $group: "nom_organ",
    $limit: String(limit),
  });

  const currentYearMap = new Map(
    currentYearRows.map((row) => [row.nom_organ, row.total_current_year || "0"])
  );

  return rows.map((row) => ({
    ...row,
    total_current_year: currentYearMap.get(row.nom_organ) || "0",
  }));
}

export async function fetchOrgansCount(search?: string): Promise<number> {
  const conditions = [
    CLEAN_AMOUNT_FILTER,
    "import_adjudicacio_amb_iva IS NOT NULL",
    "nom_organ IS NOT NULL",
  ];

  if (search) {
    const safe = search.replace(/'/g, "''");
    conditions.push(`upper(nom_organ) like upper('%${safe}%')`);
  }

  const data = await soqlFetch<{ total: string }>({
    $select: "count(distinct nom_organ) as total",
    $where: conditions.join(" AND "),
  });

  return parseInt(data[0]?.total || "0", 10);
}

export async function fetchOrganDetail(
  organName: string
): Promise<{ organ?: OrganAggregation; yearly: OrganYearAggregation[] }> {
  const safeName = organName.replace(/'/g, "''");

  const [organRows, yearlyRows] = await Promise.all([
    soqlFetch<OrganAggregation>({
      $select:
        "nom_organ, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
      $where: `nom_organ='${safeName}' AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL`,
      $group: "nom_organ",
      $limit: "1",
    }),
    soqlFetch<OrganYearAggregation>({
      $select:
        "nom_organ, date_extract_y(data_adjudicacio_contracte) as year, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
      $where: `nom_organ='${safeName}' AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND data_adjudicacio_contracte IS NOT NULL`,
      $group: "nom_organ, year",
      $order: "year ASC",
      $limit: "500",
    }),
  ]);

  const organ = organRows[0];
  const yearly = yearlyRows.filter((d) => {
    const y = parseInt(d.year, 10);
    return y >= 2015 && y <= new Date().getFullYear() + 1;
  });

  return { organ, yearly };
}

export async function fetchOrganContracts(
  organName: string,
  offset = 0,
  limit = DEFAULT_PAGE_SIZE
): Promise<Contract[]> {
  const safeName = organName.replace(/'/g, "''");
  return soqlFetch<Contract>({
    $where: `nom_organ='${safeName}' AND ${AWARDED_CONTRACT_WHERE} AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL`,
    $order: `${BEST_AVAILABLE_CONTRACT_DATE_EXPR} DESC`,
    $limit: String(limit),
    $offset: String(offset),
  });
}

export async function fetchOrganRecentContracts(
  organName: string,
  limit = 10
): Promise<Contract[]> {
  const safeName = organName.replace(/'/g, "''");
  const futureCutoffIso = getContractsFutureCutoffIso();
  return soqlFetch<Contract>({
    $select:
      "codi_expedient, denominacio_adjudicatari, import_adjudicacio_sense, data_adjudicacio_contracte, data_formalitzacio_contracte, data_publicacio_anunci, enllac_publicacio",
    $where: `nom_organ='${safeName}' AND ${AWARDED_CONTRACT_WHERE} AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${futureCutoffIso}'`,
    $order: `${BEST_AVAILABLE_CONTRACT_DATE_EXPR} DESC`,
    $limit: String(limit),
  });
}

export async function fetchOrganContractsCount(organName: string): Promise<number> {
  const safeName = organName.replace(/'/g, "''");
  const data = await soqlFetch<{ total: string }>({
    $select: "count(*) as total",
    $where: `nom_organ='${safeName}' AND ${AWARDED_CONTRACT_WHERE} AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL`,
  });
  return parseInt(data[0]?.total || "0", 10);
}

export async function fetchOrganLastAwardDate(
  organName: string
): Promise<string | undefined> {
  const safeName = organName.replace(/'/g, "''");
  const futureCutoffIso = getContractsFutureCutoffIso();
  const data = await soqlFetch<{ last_date?: string }>({
    $select: `max(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) as last_date`,
    $where: `nom_organ='${safeName}' AND ${AWARDED_CONTRACT_WHERE} AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${futureCutoffIso}'`,
  });
  return data[0]?.last_date;
}

export async function fetchOrganTopCompanies(
  organName: string,
  limit = 10
): Promise<CompanyAggregation[]> {
  const safeName = organName.replace(/'/g, "''");
  const raw = await soqlFetch<CompanyAggregation>({
    $select:
      "identificacio_adjudicatari, denominacio_adjudicatari, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
    $where: `nom_organ='${safeName}' AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND denominacio_adjudicatari IS NOT NULL AND identificacio_adjudicatari IS NOT NULL`,
    $group: "identificacio_adjudicatari, denominacio_adjudicatari",
    $order: "total DESC",
    $limit: String(limit * 8),
  });
  return mergeByNif(raw).slice(0, limit);
}

// Company detail (merged by NIF across name variations)
export async function fetchCompanyDetail(
  id: string
): Promise<{ company: CompanyAggregation; yearly: CompanyYearAggregation[] }> {
  const safeId = id.replace(/'/g, "''");

  const [companyRows, yearlyRows] = await Promise.all([
    soqlFetch<CompanyAggregation>({
      $select:
        "identificacio_adjudicatari, denominacio_adjudicatari, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
      $where: `identificacio_adjudicatari='${safeId}' AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL`,
      $group: "identificacio_adjudicatari, denominacio_adjudicatari",
      $order: "total DESC",
      $limit: "100",
    }),
    soqlFetch<CompanyYearAggregation>({
      $select:
        "identificacio_adjudicatari, denominacio_adjudicatari, date_extract_y(data_adjudicacio_contracte) as year, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
      $where: `identificacio_adjudicatari='${safeId}' AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND data_adjudicacio_contracte IS NOT NULL`,
      $group: "identificacio_adjudicatari, denominacio_adjudicatari, year",
      $order: "year ASC",
      $limit: "500",
    }),
  ]);

  // Merge company rows (name variations) into one
  const merged = mergeByNif(companyRows);
  const company = merged[0];

  // Merge yearly rows by year
  const yearMap = new Map<string, { total: number; contracts: number }>();
  for (const row of yearlyRows) {
    const y = row.year;
    const existing = yearMap.get(y);
    if (existing) {
      existing.total += parseFloat(row.total) || 0;
      existing.contracts += parseInt(row.num_contracts, 10) || 0;
    } else {
      yearMap.set(y, {
        total: parseFloat(row.total) || 0,
        contracts: parseInt(row.num_contracts, 10) || 0,
      });
    }
  }

  const yearly = Array.from(yearMap.entries())
    .map(([year, data]) => ({
      identificacio_adjudicatari: id,
      denominacio_adjudicatari: company?.denominacio_adjudicatari || "",
      year,
      total: String(data.total),
      num_contracts: String(data.contracts),
    }))
    .filter((d) => {
      const y = parseInt(d.year);
      return y >= 2015 && y <= new Date().getFullYear() + 1;
    })
    .sort((a, b) => parseInt(a.year) - parseInt(b.year));

  return { company, yearly };
}

export async function fetchCompanyContracts(
  id: string,
  offset = 0,
  limit = DEFAULT_PAGE_SIZE
): Promise<Contract[]> {
  const safeId = id.replace(/'/g, "''");
  return soqlFetch<Contract>({
    $where: `identificacio_adjudicatari='${safeId}' AND ${AWARDED_CONTRACT_WHERE} AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL`,
    $order: `${BEST_AVAILABLE_CONTRACT_DATE_EXPR} DESC`,
    $limit: String(limit),
    $offset: String(offset),
  });
}

export async function fetchCompanyContractsCount(id: string): Promise<number> {
  const safeId = id.replace(/'/g, "''");
  const data = await soqlFetch<{ total: string }>({
    $select: "count(*) as total",
    $where: `identificacio_adjudicatari='${safeId}' AND ${AWARDED_CONTRACT_WHERE} AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL`,
  });
  return parseInt(data[0]?.total || "0", 10);
}

export async function fetchCompanyLastAwardDate(id: string): Promise<string | undefined> {
  const safeId = id.replace(/'/g, "''");
  const futureCutoffIso = getContractsFutureCutoffIso();
  const data = await soqlFetch<{ last_date?: string }>({
    $select: `max(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) as last_date`,
    $where: `identificacio_adjudicatari='${safeId}' AND ${AWARDED_CONTRACT_WHERE} AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${futureCutoffIso}'`,
  });
  return data[0]?.last_date;
}

function buildAwardeeScopeCondition(nifs?: string[], names?: string[]): string | null {
  const normalizedNifs = Array.from(
    new Set(
      (nifs || [])
        .map((nif) => nif.trim())
        .filter((nif) => nif.length > 0)
    )
  ).slice(0, 400);

  const normalizedNames = Array.from(
    new Set(
      (names || [])
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
    )
  ).slice(0, 400);

  const conditions: string[] = [];

  if (normalizedNifs.length > 0) {
    const escapedNifs = normalizedNifs
      .map((nif) => `'${nif.replace(/'/g, "''")}'`)
      .join(",");
    conditions.push(`identificacio_adjudicatari IN (${escapedNifs})`);
  }

  if (normalizedNames.length > 0) {
    const escapedNames = normalizedNames
      .map((name) => `'${name.replace(/'/g, "''").toUpperCase()}'`)
      .join(",");
    conditions.push(`upper(denominacio_adjudicatari) IN (${escapedNames})`);
  }

  if (conditions.length === 0) return null;
  if (conditions.length === 1) return conditions[0];
  return `(${conditions.join(" OR ")})`;
}

interface AwardeeContractFilters {
  nifs?: string[];
  names?: string[];
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  nom_organ?: string;
}

export interface AwardeeContractsSummary {
  total: number;
  totalAmount: number;
}

export async function fetchContractsByAwardees(
  filters: AwardeeContractFilters
): Promise<Contract[]> {
  const conditions: string[] = [];
  const futureCutoffIso = getContractsFutureCutoffIso();
  const {
    nifs,
    names,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    orderBy = BEST_AVAILABLE_CONTRACT_DATE_EXPR,
    orderDir = "DESC",
    nom_organ,
  } = filters;

  const awardeeScopeCondition = buildAwardeeScopeCondition(nifs, names);
  if (!awardeeScopeCondition) return [];
  conditions.push(awardeeScopeCondition);

  if (nom_organ) {
    conditions.push(`upper(nom_organ) like upper('%${nom_organ.replace(/'/g, "''")}%')`);
  }

  conditions.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL`);
  conditions.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${futureCutoffIso}'`);
  conditions.push(AWARDED_CONTRACT_WHERE);

  return soqlFetch<Contract>({
    $where: conditions.join(" AND "),
    $order: `${orderBy} ${orderDir}`,
    $limit: String(pageSize),
    $offset: String((page - 1) * pageSize),
  });
}

export async function fetchContractsByAwardeesCount(
  filters: Pick<AwardeeContractFilters, "nifs" | "names" | "nom_organ">
): Promise<number> {
  const summary = await fetchContractsByAwardeesSummary(filters);
  return summary.total;
}

export async function fetchContractsByAwardeesSummary(
  filters: Pick<AwardeeContractFilters, "nifs" | "names" | "nom_organ">
): Promise<AwardeeContractsSummary> {
  const conditions: string[] = [];
  const futureCutoffIso = getContractsFutureCutoffIso();
  const { nifs, names, nom_organ } = filters;

  const awardeeScopeCondition = buildAwardeeScopeCondition(nifs, names);
  if (!awardeeScopeCondition) {
    return { total: 0, totalAmount: 0 };
  }
  conditions.push(awardeeScopeCondition);

  if (nom_organ) {
    conditions.push(`upper(nom_organ) like upper('%${nom_organ.replace(/'/g, "''")}%')`);
  }

  conditions.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL`);
  conditions.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${futureCutoffIso}'`);
  conditions.push(AWARDED_CONTRACT_WHERE);

  const rows = await soqlFetch<{ total: string }>({
    $select: "count(*) as total, sum(import_adjudicacio_sense::number) as total_amount",
    $where: conditions.join(" AND "),
  });
  return {
    total: parseInt(rows[0]?.total || "0", 10),
    totalAmount: parseFloat((rows[0] as { total_amount?: string })?.total_amount || "0"),
  };
}

// Contracts list with filters
export async function fetchContracts(
  filters: ContractFilters
): Promise<Contract[]> {
  const conditions: string[] = [];
  const futureCutoffIso = getContractsFutureCutoffIso();
  const {
    year,
    tipus_contracte,
    procediment,
    amountMin,
    amountMax,
    nom_organ,
    search,
    nif,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    orderBy = BEST_AVAILABLE_CONTRACT_DATE_EXPR,
    orderDir = "DESC",
  } = filters;

  if (nif) {
    conditions.push(`identificacio_adjudicatari='${nif.replace(/'/g, "''")}'`);
  }
  if (year) {
    const parsedYear = parseYearFilter(year);
    if (parsedYear !== null) {
      conditions.push(`date_extract_y(data_adjudicacio_contracte)=${parsedYear}`);
    }
  }
  if (tipus_contracte) {
    conditions.push(`tipus_contracte='${tipus_contracte.replace(/'/g, "''")}'`);
  }
  if (procediment) {
    conditions.push(`procediment='${procediment.replace(/'/g, "''")}'`);
  }
  if (amountMin) {
    const parsedAmountMin = parseNonNegativeNumber(amountMin);
    if (parsedAmountMin !== null) {
      conditions.push(
        `${CLEAN_AMOUNT_SENSE_FILTER} AND import_adjudicacio_sense::number >= ${parsedAmountMin}`
      );
    }
  }
  if (amountMax) {
    const parsedAmountMax = parseNonNegativeNumber(amountMax);
    if (parsedAmountMax !== null) {
      conditions.push(
        `${CLEAN_AMOUNT_SENSE_FILTER} AND import_adjudicacio_sense::number <= ${parsedAmountMax}`
      );
    }
  }
  if (nom_organ) {
    conditions.push(
      `upper(nom_organ) like upper('%${nom_organ.replace(/'/g, "''")}%')`
    );
  }
  if (search) {
    conditions.push(
      buildLooseSearchCondition(search, [
        "denominacio",
        "denominacio_adjudicatari",
        "identificacio_adjudicatari",
      ])
    );
  }
  conditions.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL`);
  conditions.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${futureCutoffIso}'`);
  conditions.push(AWARDED_CONTRACT_WHERE);

  const params: Record<string, string> = {
    $order: `${orderBy} ${orderDir}`,
    $limit: String(pageSize),
    $offset: String((page - 1) * pageSize),
  };

  if (conditions.length > 0) {
    params.$where = conditions.join(" AND ");
  }

  return soqlFetch<Contract>(params);
}

export async function fetchContractsCount(
  filters: ContractFilters
): Promise<number> {
  const conditions: string[] = [];
  const futureCutoffIso = getContractsFutureCutoffIso();
  const { year, tipus_contracte, procediment, amountMin, amountMax, nom_organ, search, nif } = filters;

  if (nif) {
    conditions.push(`identificacio_adjudicatari='${nif.replace(/'/g, "''")}'`);
  }
  if (year) {
    const parsedYear = parseYearFilter(year);
    if (parsedYear !== null) {
      conditions.push(`date_extract_y(data_adjudicacio_contracte)=${parsedYear}`);
    }
  }
  if (tipus_contracte) {
    conditions.push(`tipus_contracte='${tipus_contracte.replace(/'/g, "''")}'`);
  }
  if (procediment) {
    conditions.push(`procediment='${procediment.replace(/'/g, "''")}'`);
  }
  if (amountMin) {
    const parsedAmountMin = parseNonNegativeNumber(amountMin);
    if (parsedAmountMin !== null) {
      conditions.push(
        `${CLEAN_AMOUNT_SENSE_FILTER} AND import_adjudicacio_sense::number >= ${parsedAmountMin}`
      );
    }
  }
  if (amountMax) {
    const parsedAmountMax = parseNonNegativeNumber(amountMax);
    if (parsedAmountMax !== null) {
      conditions.push(
        `${CLEAN_AMOUNT_SENSE_FILTER} AND import_adjudicacio_sense::number <= ${parsedAmountMax}`
      );
    }
  }
  if (nom_organ) {
    conditions.push(`upper(nom_organ) like upper('%${nom_organ.replace(/'/g, "''")}%')`);
  }
  if (search) {
    conditions.push(
      buildLooseSearchCondition(search, [
        "denominacio",
        "denominacio_adjudicatari",
        "identificacio_adjudicatari",
      ])
    );
  }
  conditions.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL`);
  conditions.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${futureCutoffIso}'`);
  conditions.push(AWARDED_CONTRACT_WHERE);

  const params: Record<string, string> = {
    $select: "count(*) as total",
  };
  if (conditions.length > 0) {
    params.$where = conditions.join(" AND ");
  }

  const data = await soqlFetch<{ total: string }>(params);
  return parseInt(data[0]?.total || "0", 10);
}

// Analysis: threshold distribution
export async function fetchThresholdDistribution(): Promise<ThresholdBucket[]> {
  // Fetch counts in 500 EUR buckets from 500 to 15000 for minor contracts
  const buckets: ThresholdBucket[] = [];
  const bucketSize = 500;
  const promises: Promise<{ total: string }[]>[] = [];

  for (let start = ANALYSIS_MIN_AMOUNT; start < 15000; start += bucketSize) {
    const end = start + bucketSize;
    promises.push(
      soqlFetch<{ total: string }>({
        $select: "count(*) as total",
        $where: `${MINOR_15K_BASE_WHERE} AND import_adjudicacio_sense::number >= ${start} AND import_adjudicacio_sense::number < ${end}`,
      })
    );
  }

  const results = await Promise.all(promises);

  for (let i = 0; i < results.length; i++) {
    const start = ANALYSIS_MIN_AMOUNT + i * bucketSize;
    const end = start + bucketSize;
    buckets.push({
      range_start: start,
      range_end: end,
      label: `${(start / 1000).toFixed(1)}k-${(end / 1000).toFixed(1)}k`,
      count: parseInt(results[i][0]?.total || "0", 10),
    });
  }

  return buckets;
}

export async function fetchMinorBandSummary(): Promise<MinorBandSummary> {
  const [totalRows, riskRows, riskAmountRows] = await Promise.all([
    soqlFetch<{ total: string }>({
      $select: "count(*) as total",
      $where: MINOR_15K_BASE_WHERE,
    }),
    soqlFetch<{ total: string }>({
      $select: "count(*) as total",
      $where: `${MINOR_15K_BASE_WHERE} AND import_adjudicacio_sense::number >= 14900 AND import_adjudicacio_sense::number < 15000`,
    }),
    soqlFetch<{ total_amount: string }>({
      $select: "sum(import_adjudicacio_amb_iva::number) as total_amount",
      $where: `${MINOR_15K_BASE_WHERE} AND import_adjudicacio_sense::number >= 14900 AND import_adjudicacio_sense::number < 15000 AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL`,
    }),
  ]);

  return {
    total_minor_under_15k: parseInt(totalRows[0]?.total || "0", 10),
    risk_band_14900_15000: parseInt(riskRows[0]?.total || "0", 10),
    risk_band_14900_15000_amount: parseFloat(riskAmountRows[0]?.total_amount || "0"),
  };
}

export async function fetchTopOrgansInMinorRiskBand(
  limit = 20
): Promise<MinorRiskEntityAggregation[]> {
  const rows = await soqlFetch<{ nom_organ: string; amount: string; num_contracts: string }>({
    $select:
      "nom_organ, count(*) as num_contracts, sum(import_adjudicacio_amb_iva::number) as amount",
    $where: `${MINOR_15K_BASE_WHERE} AND import_adjudicacio_sense::number >= 14900 AND import_adjudicacio_sense::number < 15000 AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND nom_organ IS NOT NULL`,
    $group: "nom_organ",
    $order: "num_contracts DESC, amount DESC",
    $limit: String(limit),
  });

  return rows.map((r) => ({
    name: r.nom_organ,
    amount: r.amount,
    num_contracts: r.num_contracts,
  }));
}

export async function fetchTopCompaniesInMinorRiskBand(
  limit = 20
): Promise<CompanyAggregation[]> {
  const raw = await soqlFetch<CompanyAggregation>({
    $select:
      "identificacio_adjudicatari, denominacio_adjudicatari, count(*) as num_contracts, sum(import_adjudicacio_amb_iva::number) as total",
    $where: `${MINOR_15K_BASE_WHERE} AND import_adjudicacio_sense::number >= 14900 AND import_adjudicacio_sense::number < 15000 AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND denominacio_adjudicatari IS NOT NULL AND identificacio_adjudicatari IS NOT NULL`,
    $group: "identificacio_adjudicatari, denominacio_adjudicatari",
    $order: "num_contracts DESC, total DESC",
    $limit: String(limit * 8),
  });
  return mergeByNif(raw).slice(0, limit);
}

export async function fetchMinorShareYearly(): Promise<MinorShareYear[]> {
  const [yearlyTotalCount, yearlyMinorCount, yearlyTotalAmount, yearlyMinorAmount] =
    await Promise.all([
      soqlFetch<{ year: string; total_contracts: string }>({
        $select: "date_extract_y(data_adjudicacio_contracte) as year, count(*) as total_contracts",
        $where: `${ANALYSIS_BASE_SENSE_WHERE} AND data_adjudicacio_contracte IS NOT NULL`,
        $group: "year",
        $order: "year ASC",
        $limit: "50",
      }),
      soqlFetch<{ year: string; minor_contracts: string }>({
        $select: "date_extract_y(data_adjudicacio_contracte) as year, count(*) as minor_contracts",
        $where: `${ANALYSIS_BASE_SENSE_WHERE} AND procediment='Contracte menor' AND data_adjudicacio_contracte IS NOT NULL`,
        $group: "year",
        $order: "year ASC",
        $limit: "50",
      }),
      soqlFetch<{ year: string; total_amount: string }>({
        $select:
          "date_extract_y(data_adjudicacio_contracte) as year, sum(import_adjudicacio_amb_iva::number) as total_amount",
        $where: `${ANALYSIS_BASE_SENSE_WHERE} AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND data_adjudicacio_contracte IS NOT NULL`,
        $group: "year",
        $order: "year ASC",
        $limit: "50",
      }),
      soqlFetch<{ year: string; minor_amount: string }>({
        $select:
          "date_extract_y(data_adjudicacio_contracte) as year, sum(import_adjudicacio_amb_iva::number) as minor_amount",
        $where: `${ANALYSIS_BASE_SENSE_WHERE} AND procediment='Contracte menor' AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND data_adjudicacio_contracte IS NOT NULL`,
        $group: "year",
        $order: "year ASC",
        $limit: "50",
      }),
    ]);

  const countMap = new Map<string, { total: number; minor: number }>();
  const amountMap = new Map<string, { total: number; minor: number }>();

  for (const row of yearlyTotalCount) {
    countMap.set(row.year, {
      total: parseInt(row.total_contracts || "0", 10),
      minor: 0,
    });
  }

  for (const row of yearlyMinorCount) {
    const existing = countMap.get(row.year);
    if (existing) {
      existing.minor = parseInt(row.minor_contracts || "0", 10);
    } else {
      countMap.set(row.year, {
        total: 0,
        minor: parseInt(row.minor_contracts || "0", 10),
      });
    }
  }

  for (const row of yearlyTotalAmount) {
    amountMap.set(row.year, {
      total: parseFloat(row.total_amount || "0"),
      minor: 0,
    });
  }

  for (const row of yearlyMinorAmount) {
    const existing = amountMap.get(row.year);
    if (existing) {
      existing.minor = parseFloat(row.minor_amount || "0");
    } else {
      amountMap.set(row.year, {
        total: 0,
        minor: parseFloat(row.minor_amount || "0"),
      });
    }
  }

  const years = Array.from(
    new Set([...Array.from(countMap.keys()), ...Array.from(amountMap.keys())])
  )
    .map((y) => parseInt(y, 10))
    .filter((y) => y >= 2015 && y <= new Date().getFullYear() + 1)
    .sort((a, b) => a - b)
    .map(String);

  return years.map((year) => {
    const count = countMap.get(year) || { total: 0, minor: 0 };
    const amount = amountMap.get(year) || { total: 0, minor: 0 };
    const contractsShare =
      count.total > 0 ? (count.minor / count.total) * 100 : 0;
    const amountShare =
      amount.total > 0 ? (amount.minor / amount.total) * 100 : 0;

    return {
      year,
      total_contracts: count.total,
      minor_contracts: count.minor,
      total_amount: amount.total,
      minor_amount: amount.minor,
      minor_contracts_share: contractsShare,
      minor_amount_share: amountShare,
    };
  });
}

// Analysis: procedure distribution
export async function fetchProcedureDistribution(): Promise<
  ProcedureAggregation[]
> {
  return soqlFetch<ProcedureAggregation>({
    $select:
      "procediment, count(*) as total, sum(import_adjudicacio_amb_iva::number) as amount",
    $where: `${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND procediment IS NOT NULL`,
    $group: "procediment",
    $order: "total DESC",
    $limit: "20",
  });
}

// Analysis: contract type distribution
export async function fetchContractTypeDistribution(): Promise<
  ContractTypeAggregation[]
> {
  return soqlFetch<ContractTypeAggregation>({
    $select:
      "tipus_contracte, count(*) as total, sum(import_adjudicacio_amb_iva::number) as amount",
    $where: `${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND tipus_contracte IS NOT NULL`,
    $group: "tipus_contracte",
    $order: "total DESC",
    $limit: "20",
  });
}

// Analysis: minor contracts yearly trend
export async function fetchMinorContractsYearly(): Promise<
  YearlyAggregation[]
> {
  const data = await soqlFetch<YearlyAggregation>({
    $select:
      "date_extract_y(data_adjudicacio_contracte) as year, count(*) as num_contracts, sum(import_adjudicacio_amb_iva::number) as total",
    $where: `procediment='Contracte menor' AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND data_adjudicacio_contracte IS NOT NULL`,
    $group: "year",
    $order: "year ASC",
    $limit: "50",
  });
  return data.filter((d) => {
    const y = parseInt(d.year);
    return y >= 2015 && y <= new Date().getFullYear() + 1;
  });
}

// CPV sector distribution (aggregated by 2-digit division in JS)
export async function fetchCpvDistribution(
  limit = 15
): Promise<{ sector: string; code: string; total: number; num_contracts: number }[]> {
  // Fetch top CPV codes grouped by full code, then aggregate by 2-digit division
  const raw = await soqlFetch<CpvAggregation>({
    $select:
      "codi_cpv, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
    $where: `${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND codi_cpv IS NOT NULL AND codi_cpv not like '%||%'`,
    $group: "codi_cpv",
    $order: "total DESC",
    $limit: "1000",
  });

  // Aggregate by 2-digit CPV division
  const sectorMap = new Map<
    string,
    { total: number; contracts: number }
  >();

  for (const row of raw) {
    const code = row.codi_cpv.trim();
    const division = code.slice(0, 2);
    if (!/^\d{2}$/.test(division)) continue;

    const total = parseFloat(row.total) || 0;
    const contracts = parseInt(row.num_contracts, 10) || 0;
    const existing = sectorMap.get(division);

    if (existing) {
      existing.total += total;
      existing.contracts += contracts;
    } else {
      sectorMap.set(division, { total, contracts });
    }
  }

  return Array.from(sectorMap.entries())
    .map(([code, data]) => ({
      sector: CPV_DIVISIONS[code] || `Sector ${code}`,
      code,
      total: data.total,
      num_contracts: data.contracts,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// Top contracting bodies
export async function fetchTopOrgans(
  limit = 10,
  options?: { minYear?: number; maxYear?: number }
): Promise<{ nom_organ: string; total: string; num_contracts: string }[]> {
  const conditions = [
    CLEAN_AMOUNT_FILTER,
    "import_adjudicacio_amb_iva IS NOT NULL",
    "nom_organ IS NOT NULL",
  ];
  if (options?.minYear !== undefined || options?.maxYear !== undefined) {
    conditions.push("data_adjudicacio_contracte IS NOT NULL");
  }
  if (options?.minYear !== undefined) {
    conditions.push(`date_extract_y(data_adjudicacio_contracte) >= ${options.minYear}`);
  }
  if (options?.maxYear !== undefined) {
    conditions.push(`date_extract_y(data_adjudicacio_contracte) <= ${options.maxYear}`);
  }

  return soqlFetch({
    $select:
      "nom_organ, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
    $where: conditions.join(" AND "),
    $group: "nom_organ",
    $order: "total DESC",
    $limit: String(limit),
  });
}

// Top contracting bodies for a specific company (counterparties)
export async function fetchCompanyTopOrgans(
  companyId: string,
  limit = 10
): Promise<{ nom_organ: string; total: string; num_contracts: string }[]> {
  const safeId = companyId.replace(/'/g, "''");
  return soqlFetch({
    $select:
      "nom_organ, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
    $where: `identificacio_adjudicatari='${safeId}' AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND nom_organ IS NOT NULL`,
    $group: "nom_organ",
    $order: "total DESC",
    $limit: String(limit),
  });
}

export async function fetchRecentActivityWindow(
  days = 7
): Promise<{
  num_contracts: number;
  total_amount: number;
  unique_organs: number;
  unique_companies: number;
  last_award_date?: string;
}> {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 7;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - safeDays);
  const cutoffIso = `${cutoff.toISOString().slice(0, 10)}T00:00:00`;
  const futureCutoffIso = getContractsFutureCutoffIso();

  const rows = await soqlFetch<{
    num_contracts?: string;
    total_amount?: string;
    unique_organs?: string;
    unique_companies?: string;
    last_award_date?: string;
  }>({
    $select: `
      count(*) as num_contracts,
      sum(import_adjudicacio_amb_iva::number) as total_amount,
      count(distinct nom_organ) as unique_organs,
      count(distinct identificacio_adjudicatari) as unique_companies,
      max(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) as last_award_date
    `,
    $where: `
      ${AWARDED_CONTRACT_WHERE}
      AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL
      AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) >= '${cutoffIso}'
      AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${futureCutoffIso}'
      AND ${CLEAN_AMOUNT_FILTER}
      AND import_adjudicacio_amb_iva IS NOT NULL
    `,
  });

  const row = rows[0] || {};
  return {
    num_contracts: parseInt(row.num_contracts || "0", 10),
    total_amount: parseFloat(row.total_amount || "0"),
    unique_organs: parseInt(row.unique_organs || "0", 10),
    unique_companies: parseInt(row.unique_companies || "0", 10),
    last_award_date: row.last_award_date,
  };
}

async function fetchRecentActivityBetween(
  startIso: string,
  endIso: string
): Promise<{
  num_contracts: number;
  total_amount: number;
  unique_organs: number;
  unique_companies: number;
}> {
  const futureCutoffIso = getContractsFutureCutoffIso();
  const rows = await soqlFetch<{
    num_contracts?: string;
    total_amount?: string;
    unique_organs?: string;
    unique_companies?: string;
  }>({
    $select: `
      count(*) as num_contracts,
      sum(import_adjudicacio_amb_iva::number) as total_amount,
      count(distinct nom_organ) as unique_organs,
      count(distinct identificacio_adjudicatari) as unique_companies
    `,
    $where: `
      ${AWARDED_CONTRACT_WHERE}
      AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL
      AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) >= '${startIso}'
      AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${endIso}'
      AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${futureCutoffIso}'
      AND ${CLEAN_AMOUNT_FILTER}
      AND import_adjudicacio_amb_iva IS NOT NULL
    `,
  });

  const row = rows[0] || {};
  return {
    num_contracts: parseInt(row.num_contracts || "0", 10),
    total_amount: parseFloat(row.total_amount || "0"),
    unique_organs: parseInt(row.unique_organs || "0", 10),
    unique_companies: parseInt(row.unique_companies || "0", 10),
  };
}

export async function fetchRecentActivityComparison(
  days = 90,
  offsetDays = 365,
  lagDays = 90
): Promise<{
  current: {
    num_contracts: number;
    total_amount: number;
    unique_organs: number;
    unique_companies: number;
  };
  previous: {
    num_contracts: number;
    total_amount: number;
    unique_organs: number;
    unique_companies: number;
  };
  meta: {
    current_start: string;
    current_end: string;
    previous_start: string;
    previous_end: string;
    lag_days: number;
  };
}> {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 90;
  const safeOffset = Number.isFinite(offsetDays)
    ? Math.max(safeDays, Math.floor(offsetDays))
    : 365;
  const safeLag = Number.isFinite(lagDays) ? Math.max(0, Math.floor(lagDays)) : 21;

  const currentEnd = new Date();
  currentEnd.setDate(currentEnd.getDate() - safeLag);
  const currentStart = new Date(currentEnd);
  currentStart.setDate(currentStart.getDate() - safeDays + 1);

  const previousEnd = new Date(currentEnd);
  previousEnd.setDate(previousEnd.getDate() - safeOffset);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - safeDays + 1);

  const currentStartIso = `${currentStart.toISOString().slice(0, 10)}T00:00:00`;
  const currentEndIso = `${currentEnd.toISOString().slice(0, 10)}T23:59:59`;
  const previousStartIso = `${previousStart.toISOString().slice(0, 10)}T00:00:00`;
  const previousEndIso = `${previousEnd.toISOString().slice(0, 10)}T23:59:59`;

  const [current, previous] = await Promise.all([
    fetchRecentActivityBetween(currentStartIso, currentEndIso),
    fetchRecentActivityBetween(previousStartIso, previousEndIso),
  ]);

  return {
    current,
    previous,
    meta: {
      current_start: currentStartIso.slice(0, 10),
      current_end: currentEndIso.slice(0, 10),
      previous_start: previousStartIso.slice(0, 10),
      previous_end: previousEndIso.slice(0, 10),
      lag_days: safeLag,
    },
  };
}
