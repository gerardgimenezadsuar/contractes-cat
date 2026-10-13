import {
  SOCRATA_BASE_URL,
  CLEAN_AMOUNT_FILTER,
  CLEAN_AMOUNT_SENSE_FILTER,
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
import { socrataFetch } from "@/lib/socrata";
import {
  buildCompanyIdentityKey,
  isAmbiguousCompanyId,
  MIN_COMPANY_ID_LENGTH,
} from "@/lib/company-identity";
import { parseSearchQuery, rankByMatch, type ParsedSearchQuery } from "@/lib/search-query";

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

// SoQL equivalent of isAmbiguousCompanyId (masked or placeholder ids).
const AMBIGUOUS_ID_SOQL = `(identificacio_adjudicatari like '%**%' OR length(trim(identificacio_adjudicatari)) < ${MIN_COMPANY_ID_LENGTH})`;

function getContractsFutureCutoffIso(): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 7);
  // Socrata accepts datetime literals like YYYY-MM-DDTHH:MM:SS in comparisons.
  return `${cutoff.toISOString().slice(0, 10)}T23:59:59`;
}

function buildAwardeeIdentityCondition(id: string, name?: string): string {
  const safeId = id.replace(/'/g, "''");
  if (!isAmbiguousCompanyId(id)) {
    return `identificacio_adjudicatari='${safeId}'`;
  }

  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    return `identificacio_adjudicatari='${safeId}'`;
  }

  const safeName = trimmedName.replace(/'/g, "''");
  return `identificacio_adjudicatari='${safeId}' AND upper(denominacio_adjudicatari)=upper('${safeName}')`;
}

function normalizeSearchTerm(search: string): string {
  return search
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function normalizeSoqlTextExpr(field: string): string {
  // Strips the same punctuation as normalizeSearchTerm (apostrophes included,
  // straight and curly, and the Catalan middle dot) and folds Ç/Ñ. Accented
  // vowels are handled on the search-term side by toAccentInsensitivePattern,
  // which is far cheaper than replacing every accented letter here.
  let expr = `upper(${field})`;
  for (const char of [".", ",", "-", " ", "/", "''", "’", "·"]) {
    expr = `replace(${expr},'${char}','')`;
  }
  return `replace(replace(${expr},'Ç','C'),'Ñ','N')`;
}

/**
 * Turns a normalized (accent-free, uppercase) term into a LIKE pattern where
 * each vowel matches any single character, so "PUBLIC" also finds "PÚBLIC"
 * and "OCUPACIO" finds "OCUPACIÓ". Short terms stay exact to limit false
 * positives.
 */
function toAccentInsensitivePattern(normalized: string): string {
  if (normalized.length < 5) return normalized;
  return normalized.replace(/[AEIOU]/g, "_");
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

function escapeSoql(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * One SoQL condition per query token, AND-joined, each token matched against
 * the accent/punctuation-folded form of any of `fields` (so word order does
 * not matter and "acsa obras" finds "Acsa, Obras e Infraestructuras").
 * Returns null when the query has no usable tokens.
 */
function buildTokenSearchCondition(parsed: ParsedSearchQuery, fields: string[]): string | null {
  if (parsed.tokens.length === 0) return null;
  const normalizedFields = fields.map((field) => normalizeSoqlTextExpr(field));
  const perToken = parsed.tokens.map((token) => {
    const pattern = escapeSoql(toAccentInsensitivePattern(token));
    const parts = normalizedFields.map((expr) => `${expr} like '%${pattern}%'`);
    return parts.length === 1 ? parts[0] : `(${parts.join(" OR ")})`;
  });
  return perToken.length === 1 ? perToken[0] : `(${perToken.join(" AND ")})`;
}

/**
 * Search condition for awardee lookups. A query that is a NIF matches the id
 * exactly (cheap, and immune to dashes/dots in the input); anything else is a
 * token search over the name (and the id, so partial ids still work).
 */
function buildAwardeeSearchCondition(search: string): string | null {
  const parsed = parseSearchQuery(search);
  if (parsed.nif) {
    return `identificacio_adjudicatari='${escapeSoql(parsed.nif)}'`;
  }
  return buildTokenSearchCondition(parsed, ["denominacio_adjudicatari", "identificacio_adjudicatari"]);
}

/**
 * Explorer search: a NIF matches the awardee id (including UTE member lists
 * such as "A1||B2"); otherwise every token must appear in the contract title,
 * the awardee name or the awardee id.
 */
function buildContractSearchCondition(search: string): string | null {
  const parsed = parseSearchQuery(search);
  if (parsed.nif) {
    const nif = escapeSoql(parsed.nif);
    return `(identificacio_adjudicatari='${nif}' OR identificacio_adjudicatari like '%${nif}%')`;
  }
  return buildTokenSearchCondition(parsed, [
    "denominacio",
    "denominacio_adjudicatari",
    "identificacio_adjudicatari",
  ]);
}

function soqlFetch<T>(params: Record<string, string>): Promise<T[]> {
  return socrataFetch<T>(SOCRATA_BASE_URL, params);
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

// Merge rows by company identity. For masked IDs ("**"), identity is ID + name.
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
    const identityKey = buildCompanyIdentityKey(nif, row.denominacio_adjudicatari);
    const total = parseFloat(row.total) || 0;
    const contracts = parseInt(row.num_contracts, 10) || 0;
    const totalCurrentYear = parseFloat(row.total_current_year || "0") || 0;
    const existing = map.get(identityKey);

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
      map.set(identityKey, {
        name: row.denominacio_adjudicatari,
        total,
        contracts,
        totalCurrentYear,
        bestTotal: total,
      });
    }
  }

  return Array.from(map.entries())
    .map(([identityKey, data]) => ({
      identificacio_adjudicatari: identityKey.split("||", 1)[0] || "",
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
  cpvFilters?: string[],
  options?: { includeCurrentYear?: boolean }
): Promise<CompanyAggregation[]> {
  const currentYear = new Date().getFullYear();
  const includeCurrentYear = options?.includeCurrentYear !== false;
  const baseConditions = [
    CLEAN_AMOUNT_FILTER,
    "import_adjudicacio_amb_iva IS NOT NULL",
    "denominacio_adjudicatari IS NOT NULL",
    "identificacio_adjudicatari IS NOT NULL",
  ];
  const cpvWhere = buildCpvDivisionWhere(cpvFilters);
  if (cpvWhere) baseConditions.push(cpvWhere);

  const parsed = search ? parseSearchQuery(search) : null;
  const searchCondition = search ? buildAwardeeSearchCondition(search) : null;
  const conditions = searchCondition ? [...baseConditions, searchCondition] : baseConditions;

  // Over-fetch then merge by NIF to handle name variations. When searching,
  // fetch a bit more so relevance ranking has candidates beyond the top totals.
  const fetchLimit = (offset + limit) * (searchCondition ? 8 : 6);
  const raw = await soqlFetch<CompanyAggregation>({
    $select:
      "identificacio_adjudicatari, denominacio_adjudicatari, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
    $where: conditions.join(" AND "),
    $group: "identificacio_adjudicatari, denominacio_adjudicatari",
    $order: "total DESC",
    $limit: String(fetchLimit),
  });

  const merged = mergeByNif(raw);
  const ordered = parsed
    ? rankByMatch(
        merged,
        parsed,
        (row) => row.denominacio_adjudicatari,
        (row) => parseFloat(row.total) || 0
      )
    : merged;
  const pageRows = ordered.slice(offset, offset + limit);
  if (pageRows.length === 0) return pageRows;

  // A search only matched some spellings of each company's name. Re-aggregate
  // the page's real NIFs across every spelling so totals do not depend on the
  // query. Masked/placeholder ids are identified by (id, name) and keep the
  // matched aggregate.
  const realNifs = pageRows
    .map((row) => row.identificacio_adjudicatari)
    .filter((id) => !isAmbiguousCompanyId(id));
  const escapedNifs = realNifs.map((id) => `'${escapeSoql(id)}'`).join(", ");
  const nifScope = escapedNifs ? `identificacio_adjudicatari IN (${escapedNifs})` : null;

  const [consistentTotals, currentYearRows] = await Promise.all([
    searchCondition && nifScope
      ? soqlFetch<{ identificacio_adjudicatari: string; total: string; num_contracts: string }>({
          $select:
            "identificacio_adjudicatari, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
          $where: `${baseConditions.join(" AND ")} AND ${nifScope}`,
          $group: "identificacio_adjudicatari",
          $limit: String(limit * 2),
        })
      : Promise.resolve([]),
    includeCurrentYear && nifScope
      ? soqlFetch<{ identificacio_adjudicatari: string; total_current_year: string }>({
          $select:
            "identificacio_adjudicatari, sum(import_adjudicacio_amb_iva::number) as total_current_year",
          $where: `${baseConditions.join(" AND ")} AND data_adjudicacio_contracte IS NOT NULL AND date_extract_y(data_adjudicacio_contracte)=${currentYear} AND ${nifScope}`,
          $group: "identificacio_adjudicatari",
          $limit: String(limit * 2),
        })
      : Promise.resolve([]),
  ]);

  const totalsByNif = new Map(
    consistentTotals.map((row) => [row.identificacio_adjudicatari, row] as const)
  );
  const currentYearByNif = new Map(
    currentYearRows.map((row) => [row.identificacio_adjudicatari, row.total_current_year || "0"] as const)
  );

  return pageRows.map((row) => {
    const consistent = totalsByNif.get(row.identificacio_adjudicatari);
    return {
      ...row,
      total: consistent?.total ?? row.total,
      num_contracts: consistent?.num_contracts ?? row.num_contracts,
      total_current_year: includeCurrentYear
        ? currentYearByNif.get(row.identificacio_adjudicatari) || "0"
        : row.total_current_year || "0",
    };
  });
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
    const searchCondition = buildAwardeeSearchCondition(search);
    if (searchCondition) conditions.push(searchCondition);
  }
  const cpvWhere = buildCpvDivisionWhere(cpvFilters);
  if (cpvWhere) conditions.push(cpvWhere);

  // Real NIFs identify a company on their own; masked/placeholder ids are
  // shared by many awardees, so those count as distinct (id, name) pairs.
  const [nonMaskedData, maskedData] = await Promise.all([
    soqlFetch<{ total: string }>({
      $select: "count(distinct identificacio_adjudicatari) as total",
      $where: `${conditions.join(" AND ")} AND NOT ${AMBIGUOUS_ID_SOQL}`,
    }),
    soqlFetch<{ total: string }>({
      $select:
        "count(distinct identificacio_adjudicatari || '|' || denominacio_adjudicatari) as total",
      $where: `${conditions.join(" AND ")} AND ${AMBIGUOUS_ID_SOQL}`,
    }),
  ]);

  return (
    parseInt(nonMaskedData[0]?.total || "0", 10) +
    parseInt(maskedData[0]?.total || "0", 10)
  );
}

/** Number of distinct unambiguous company ids, matching fetchCompanyIdsPage. */
export async function fetchCompanyIdsCount(): Promise<number> {
  const data = await soqlFetch<{ total: string }>({
    $select: "count(distinct identificacio_adjudicatari) as total",
    $where: [
      CLEAN_AMOUNT_FILTER,
      "import_adjudicacio_amb_iva IS NOT NULL",
      "identificacio_adjudicatari IS NOT NULL",
      `NOT ${AMBIGUOUS_ID_SOQL}`,
    ].join(" AND "),
  });
  return parseInt(data[0]?.total || "0", 10);
}

/** Lightweight paginated list of company ids for sitemap generation. */
export async function fetchCompanyIdsPage(offset = 0, limit = DEFAULT_PAGE_SIZE): Promise<string[]> {
  const conditions = [
    CLEAN_AMOUNT_FILTER,
    "import_adjudicacio_amb_iva IS NOT NULL",
    "identificacio_adjudicatari IS NOT NULL",
    // Masked/placeholder ids have no single company page.
    `NOT ${AMBIGUOUS_ID_SOQL}`,
  ];
  const rows = await soqlFetch<{ identificacio_adjudicatari: string }>({
    $select: "identificacio_adjudicatari",
    $where: conditions.join(" AND "),
    $group: "identificacio_adjudicatari",
    $order: "identificacio_adjudicatari ASC",
    $limit: String(limit),
    $offset: String(offset),
  });
  return rows
    .map((row) => String(row.identificacio_adjudicatari || "").trim())
    .filter((id) => id.length > 0);
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

  const parsed = search ? parseSearchQuery(search) : null;
  const searchCondition = parsed ? buildTokenSearchCondition(parsed, ["nom_organ"]) : null;
  if (searchCondition) conditions.push(searchCondition);

  let rows: OrganAggregation[];
  if (parsed && searchCondition) {
    // Rank matches by how well the name fits the query, not only by amount:
    // "ics" should list the ICS before every organ merely containing "ics".
    const candidateLimit = Math.min(500, Math.max(200, (offset + limit) * 4));
    const candidates = await soqlFetch<OrganAggregation>({
      $select:
        "nom_organ, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
      $where: conditions.join(" AND "),
      $group: "nom_organ",
      $order: "total DESC",
      $limit: String(candidateLimit),
    });
    rows = rankByMatch(
      candidates,
      parsed,
      (row) => row.nom_organ,
      (row) => parseFloat(row.total) || 0
    ).slice(offset, offset + limit);
  } else {
    rows = await soqlFetch<OrganAggregation>({
      $select:
        "nom_organ, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
      $where: conditions.join(" AND "),
      $group: "nom_organ",
      $order: "total DESC",
      $limit: String(limit),
      $offset: String(offset),
    });
  }

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
    const searchCondition = buildTokenSearchCondition(parseSearchQuery(search), ["nom_organ"]);
    if (searchCondition) conditions.push(searchCondition);
  }

  const data = await soqlFetch<{ total: string }>({
    $select: "count(distinct nom_organ) as total",
    $where: conditions.join(" AND "),
  });

  return parseInt(data[0]?.total || "0", 10);
}

/** Lightweight paginated list of organ names for sitemap generation. */
export async function fetchOrganNamesPage(offset = 0, limit = DEFAULT_PAGE_SIZE): Promise<string[]> {
  const conditions = [
    CLEAN_AMOUNT_FILTER,
    "import_adjudicacio_amb_iva IS NOT NULL",
    "nom_organ IS NOT NULL",
  ];
  const rows = await soqlFetch<{ nom_organ: string }>({
    $select: "nom_organ",
    $where: conditions.join(" AND "),
    $group: "nom_organ",
    $order: "nom_organ ASC",
    $limit: String(limit),
    $offset: String(offset),
  });
  return rows
    .map((row) => String(row.nom_organ || "").trim())
    .filter((name) => name.length > 0);
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
  id: string,
  companyName?: string
): Promise<{ company: CompanyAggregation; yearly: CompanyYearAggregation[] }> {
  const identityWhere = buildAwardeeIdentityCondition(id, companyName);

  const [companyRows, yearlyRows] = await Promise.all([
    soqlFetch<CompanyAggregation>({
      $select:
        "identificacio_adjudicatari, denominacio_adjudicatari, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
      $where: `${identityWhere} AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL`,
      $group: "identificacio_adjudicatari, denominacio_adjudicatari",
      $order: "total DESC",
      $limit: "100",
    }),
    soqlFetch<CompanyYearAggregation>({
      $select:
        "identificacio_adjudicatari, denominacio_adjudicatari, date_extract_y(data_adjudicacio_contracte) as year, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
      $where: `${identityWhere} AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND data_adjudicacio_contracte IS NOT NULL`,
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
  companyName?: string,
  offset = 0,
  limit = DEFAULT_PAGE_SIZE
): Promise<Contract[]> {
  const identityWhere = buildAwardeeIdentityCondition(id, companyName);
  return soqlFetch<Contract>({
    $where: `${identityWhere} AND ${AWARDED_CONTRACT_WHERE} AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL`,
    $order: `${BEST_AVAILABLE_CONTRACT_DATE_EXPR} DESC`,
    $limit: String(limit),
    $offset: String(offset),
  });
}

export async function fetchCompanyContractsCount(id: string, companyName?: string): Promise<number> {
  const identityWhere = buildAwardeeIdentityCondition(id, companyName);
  const data = await soqlFetch<{ total: string }>({
    $select: "count(*) as total",
    $where: `${identityWhere} AND ${AWARDED_CONTRACT_WHERE} AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL`,
  });
  return parseInt(data[0]?.total || "0", 10);
}

export async function fetchCompanyLastAwardDate(id: string, companyName?: string): Promise<string | undefined> {
  const identityWhere = buildAwardeeIdentityCondition(id, companyName);
  const futureCutoffIso = getContractsFutureCutoffIso();
  const data = await soqlFetch<{ last_date?: string }>({
    $select: `max(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) as last_date`,
    $where: `${identityWhere} AND ${AWARDED_CONTRACT_WHERE} AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) IS NOT NULL AND (${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${futureCutoffIso}'`,
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
  nifDateWindows?: AwardeeNifDateWindow[];
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  nom_organ?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AwardeeContractsSummary {
  total: number;
  totalAmount: number;
}

export interface AwardeeNifDateWindow {
  nif: string;
  dateFrom?: string;
  dateTo?: string;
}

function parseIsoDateFilter(value?: string): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Inclusive date range on the best available contract date; null when neither bound is valid. */
function buildDateRangeCondition(dateFrom?: string, dateTo?: string): string | null {
  const from = parseIsoDateFilter(dateFrom);
  const to = parseIsoDateFilter(dateTo);
  const parts: string[] = [];
  if (from) parts.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) >= '${from}T00:00:00'`);
  if (to) parts.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${to}T23:59:59'`);
  return parts.length > 0 ? parts.join(" AND ") : null;
}

function buildAwardeeNifDateScopeCondition(
  windows?: AwardeeNifDateWindow[]
): string | null {
  if (!windows || windows.length === 0) return null;
  const clauses: string[] = [];
  for (const window of windows) {
    const nif = (window.nif || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{8,12}$/.test(nif)) continue;
    const from = parseIsoDateFilter(window.dateFrom);
    const to = parseIsoDateFilter(window.dateTo);
    const parts = [`identificacio_adjudicatari='${nif.replace(/'/g, "''")}'`];
    if (from) parts.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) >= '${from}T00:00:00'`);
    if (to) parts.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${to}T23:59:59'`);
    clauses.push(`(${parts.join(" AND ")})`);
  }
  if (clauses.length === 0) return null;
  return `(${clauses.join(" OR ")})`;
}

export async function fetchContractsByAwardees(
  filters: AwardeeContractFilters
): Promise<Contract[]> {
  const conditions: string[] = [];
  const futureCutoffIso = getContractsFutureCutoffIso();
  const {
    nifs,
    names,
    nifDateWindows,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    orderBy = BEST_AVAILABLE_CONTRACT_DATE_EXPR,
    orderDir = "DESC",
    nom_organ,
    dateFrom,
    dateTo,
  } = filters;

  const awardeeScopeCondition = buildAwardeeScopeCondition(nifs, names);
  if (!awardeeScopeCondition) return [];
  conditions.push(awardeeScopeCondition);

  const nifWindowCondition = buildAwardeeNifDateScopeCondition(nifDateWindows);
  if (nifWindowCondition) {
    conditions.push(nifWindowCondition);
  }

  if (nom_organ) {
    conditions.push(`upper(nom_organ) like upper('%${nom_organ.replace(/'/g, "''")}%')`);
  }

  const from = parseIsoDateFilter(dateFrom);
  const to = parseIsoDateFilter(dateTo);
  if (from) {
    conditions.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) >= '${from}T00:00:00'`);
  }
  if (to) {
    conditions.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${to}T23:59:59'`);
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
  filters: Pick<
    AwardeeContractFilters,
    "nifs" | "names" | "nifDateWindows" | "nom_organ" | "dateFrom" | "dateTo"
  >
): Promise<number> {
  const summary = await fetchContractsByAwardeesSummary(filters);
  return summary.total;
}

export async function fetchContractsByAwardeesSummary(
  filters: Pick<
    AwardeeContractFilters,
    "nifs" | "names" | "nifDateWindows" | "nom_organ" | "dateFrom" | "dateTo"
  >
): Promise<AwardeeContractsSummary> {
  const conditions: string[] = [];
  const futureCutoffIso = getContractsFutureCutoffIso();
  const { nifs, names, nifDateWindows, nom_organ, dateFrom, dateTo } = filters;

  const awardeeScopeCondition = buildAwardeeScopeCondition(nifs, names);
  if (!awardeeScopeCondition) {
    return { total: 0, totalAmount: 0 };
  }
  conditions.push(awardeeScopeCondition);

  const nifWindowCondition = buildAwardeeNifDateScopeCondition(nifDateWindows);
  if (nifWindowCondition) {
    conditions.push(nifWindowCondition);
  }

  if (nom_organ) {
    conditions.push(`upper(nom_organ) like upper('%${nom_organ.replace(/'/g, "''")}%')`);
  }

  const from = parseIsoDateFilter(dateFrom);
  const to = parseIsoDateFilter(dateTo);
  if (from) {
    conditions.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) >= '${from}T00:00:00'`);
  }
  if (to) {
    conditions.push(`(${BEST_AVAILABLE_CONTRACT_DATE_EXPR}) <= '${to}T23:59:59'`);
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
    dateFrom,
    dateTo,
    nif,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    orderBy = BEST_AVAILABLE_CONTRACT_DATE_EXPR,
    orderDir = "DESC",
  } = filters;

  if (nif) {
    conditions.push(buildAwardeeIdentityCondition(nif, filters.awardee_name));
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
    const searchCondition = buildContractSearchCondition(search);
    if (searchCondition) conditions.push(searchCondition);
  }
  const dateRangeCondition = buildDateRangeCondition(dateFrom, dateTo);
  if (dateRangeCondition) conditions.push(dateRangeCondition);
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
  const {
    year,
    tipus_contracte,
    procediment,
    amountMin,
    amountMax,
    nom_organ,
    search,
    dateFrom,
    dateTo,
    nif,
    awardee_name,
  } = filters;

  if (nif) {
    conditions.push(buildAwardeeIdentityCondition(nif, awardee_name));
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
    const searchCondition = buildContractSearchCondition(search);
    if (searchCondition) conditions.push(searchCondition);
  }
  const dateRangeCondition = buildDateRangeCondition(dateFrom, dateTo);
  if (dateRangeCondition) conditions.push(dateRangeCondition);
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
  // Counts in 500 EUR buckets from 500 to 15000 for minor contracts, in a
  // single grouped query. signed_magnitude_linear(x, 500) returns
  // floor(x / 500) + 1 for positive x, so bucket n starts at (n - 1) * 500.
  const bucketSize = 500;
  const rows = await soqlFetch<{ bucket: string; total: string }>({
    $select: `signed_magnitude_linear(import_adjudicacio_sense::number, ${bucketSize}) as bucket, count(*) as total`,
    $where: MINOR_15K_BASE_WHERE,
    $group: "bucket",
    $limit: "100",
  });
  const countsByStart = new Map(
    rows.map((row) => [(parseInt(row.bucket, 10) - 1) * bucketSize, parseInt(row.total, 10) || 0])
  );

  const buckets: ThresholdBucket[] = [];
  for (let start = ANALYSIS_MIN_AMOUNT; start < 15000; start += bucketSize) {
    const end = start + bucketSize;
    buckets.push({
      range_start: start,
      range_end: end,
      label: `${(start / 1000).toFixed(1)}k-${(end / 1000).toFixed(1)}k`,
      count: countsByStart.get(start) || 0,
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
  companyName?: string,
  limit = 10
): Promise<{ nom_organ: string; total: string; num_contracts: string }[]> {
  const identityWhere = buildAwardeeIdentityCondition(companyId, companyName);
  return soqlFetch({
    $select:
      "nom_organ, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
    $where: `${identityWhere} AND ${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND nom_organ IS NOT NULL`,
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
