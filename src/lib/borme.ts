import { createClient } from "@libsql/client";
import { prodFetch } from "./prod-proxy";

export interface BormeAdminSpan {
  person_name:   string;
  relation_type: string;
  role_title_raw: string | null;
  role_title_code: string | null;
  date_start:    string;
  date_end:      string | null;
  source_pdf:    string | null;
}

interface BormeAdminData {
  nif:          string;
  matched_name: string;
  spans:        BormeAdminSpan[];
}

export interface BormePersonSearchResult {
  person_name: string;
  num_companies: number;
  num_companies_with_nif: number;
  active_spans: number;
  total_spans: number;
}

export interface BormePersonSearchPage {
  data: BormePersonSearchResult[];
  total: number;
}

export interface BormePersonRoleSpan {
  relation_type: string;
  role_title_raw: string | null;
  role_title_code: string | null;
  date_start: string;
  date_end: string | null;
  source_pdf: string | null;
}

export interface BormePersonCompany {
  company_name_borme: string;
  company_name_matched: string | null;
  nif: string | null;
  num_spans: number;
  active_spans: number;
  first_date_start: string;
  last_date_end: string | null;
  roles: BormePersonRoleSpan[];
}

export interface BormePersonProfile {
  person_name: string;
  num_companies: number;
  num_companies_with_nif: number;
  total_spans: number;
  companies: BormePersonCompany[];
}

export interface BormePersonAwardeeTargets {
  nifs: string[];
  companyNames: string[];
}

const TURSO_URL = process.env.TURSO_URL;
const TURSO_TOKEN = process.env.TURSO_TOKEN ?? process.env.TURSO_AUTH_TOKEN;
const TURSO_BLOCKED_BACKOFF_MS = 120_000;
const SEARCH_CACHE_TTL_MS = 180_000;
const PROFILE_CACHE_TTL_MS = 300_000;
const MAX_CACHE_ITEMS = 500;
let warnedMissingConfig = false;
let warnedReadsBlocked = false;
let readsBlockedUntil = 0;
let db: ReturnType<typeof createClient> | null = null;
const personSearchCache = new Map<string, { expiresAt: number; value: BormePersonSearchPage }>();
const personProfileCache = new Map<string, { expiresAt: number; value: BormePersonProfile }>();

function getDb() {
  if (db) return db;
  if (!TURSO_URL || !TURSO_TOKEN) {
    if (!warnedMissingConfig) {
      console.warn("BORME Turso config missing: set TURSO_URL and TURSO_TOKEN (or TURSO_AUTH_TOKEN).");
      warnedMissingConfig = true;
    }
    return null;
  }
  db = createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN,
  });
  return db;
}

function isBlockedReadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("SQL read operations are forbidden") || message.includes("BLOCKED");
}

function canReadTurso(): boolean {
  return Date.now() >= readsBlockedUntil;
}

function markBlockedRead(error: unknown) {
  if (!isBlockedReadError(error)) return;
  readsBlockedUntil = Date.now() + TURSO_BLOCKED_BACKOFF_MS;
  if (!warnedReadsBlocked) {
    warnedReadsBlocked = true;
    console.warn(
      `BORME Turso reads blocked; backing off reads for ${Math.floor(TURSO_BLOCKED_BACKOFF_MS / 1000)} seconds.`
    );
  }
}

function getCachedValue<T>(cache: Map<string, { expiresAt: number; value: T }>, key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCachedValue<T>(cache: Map<string, { expiresAt: number; value: T }>, key: string, value: T, ttlMs: number) {
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
  if (cache.size <= MAX_CACHE_ITEMS) return;
  const oldestKey = cache.keys().next().value as string | undefined;
  if (oldestKey) cache.delete(oldestKey);
}

/** Load admin history for a NIF from Turso. */
export async function loadAdminHistory(nif: string): Promise<BormeAdminData | null> {
  try {
    const client = getDb();
    if (!client) return prodFetch(`/api/borme/${encodeURIComponent(nif)}`, null);
    if (!canReadTurso()) return null;
    const normalizedNif = nif.trim().toUpperCase();
    let result;
    try {
      result = await client.execute({
        sql: `SELECT c.nif, c.matched_name,
                     s.person_name, s.relation_type,
                     s.role_title_raw, s.role_title_code,
                     s.date_start, s.date_end,
                     s.source_pdf_start AS source_pdf
              FROM companies c
              JOIN admin_spans s ON s.company_id = c.id
              WHERE c.nif = ?
                AND s.relation_type IN (
                  'ADMINISTRADOR',
                  'APODERADO',
                  'ORGANO_GOBIERNO',
                  'LIQUIDADOR',
                  'SOCIO_UNICO',
                  'SOCIO',
                  'ACCIONISTA_UNICO'
                )
              ORDER BY s.date_start DESC`,
        args: [normalizedNif],
      });
    } catch {
      // Backward compatibility for pre-migration Turso schema without role_title columns.
      result = await client.execute({
        sql: `SELECT c.nif, c.matched_name,
                     s.person_name, s.relation_type,
                     NULL AS role_title_raw, NULL AS role_title_code,
                     s.date_start, s.date_end,
                     s.source_pdf_start AS source_pdf
              FROM companies c
              JOIN admin_spans s ON s.company_id = c.id
              WHERE c.nif = ?
                AND s.relation_type IN (
                  'ADMINISTRADOR',
                  'APODERADO',
                  'ORGANO_GOBIERNO',
                  'LIQUIDADOR',
                  'SOCIO_UNICO',
                  'SOCIO',
                  'ACCIONISTA_UNICO'
                )
              ORDER BY s.date_start DESC`,
        args: [normalizedNif],
      });
    }

    if (result.rows.length === 0) return null;

    const first = result.rows[0];
    return {
      nif:          String(first.nif ?? normalizedNif),
      matched_name: String(first.matched_name ?? ""),
      spans: result.rows.map((r) => ({
        person_name:   String(r.person_name),
        relation_type: String(r.relation_type),
        role_title_raw: r.role_title_raw != null ? String(r.role_title_raw) : null,
        role_title_code: r.role_title_code != null ? String(r.role_title_code) : null,
        date_start:    String(r.date_start),
        date_end:      r.date_end != null ? String(r.date_end) : null,
        source_pdf:    r.source_pdf != null ? String(r.source_pdf) : null,
      })),
    };
  } catch (error) {
    markBlockedRead(error);
    if (isBlockedReadError(error)) return null;
    console.error("Failed to load BORME admin history from Turso:", error);
    return null;
  }
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tokenizePersonQuery(query: string): string[] {
  return Array.from(
    new Set(
      stripDiacritics(query)
        .toUpperCase()
        .split(/[^A-Z0-9]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
    )
  ).slice(0, 6);
}

function normalizePersonText(value: string): string {
  return stripDiacritics(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPersonSearchWhere(query: string): { sql: string; args: string[]; orderedPattern: string } | null {
  const raw = query.trim();
  if (raw.length < 2) return null;

  const normalized = normalizePersonText(raw);
  const tokens = tokenizePersonQuery(raw);

  const orClauses: string[] = [];
  const args: string[] = [];

  // Preserve surname-first exact substring matches.
  orClauses.push("upper(person_name) LIKE upper(?)");
  args.push(`%${raw}%`);

  if (normalized && normalized !== raw.toUpperCase()) {
    orClauses.push("person_name_norm LIKE ?");
    args.push(`%${normalized}%`);
  }

  // Order-agnostic matching: all tokens must appear, no matter the order.
  if (tokens.length > 0) {
    const andTokens = tokens.map(() => "person_name_norm LIKE ?").join(" AND ");
    orClauses.push(`(${andTokens})`);
    for (const token of tokens) args.push(`%${token}%`);
  }

  return {
    sql: `(${orClauses.join(" OR ")})`,
    args,
    orderedPattern: `%${raw}%`,
  };
}

function buildPersonSearchFts(query: string): { match: string; orderedPattern: string } | null {
  const raw = query.trim();
  if (raw.length < 2) return null;
  const tokens = tokenizePersonQuery(raw);
  if (tokens.length === 0) return null;
  const match = tokens.map((token) => `${token}*`).join(" AND ");
  return {
    match,
    orderedPattern: `%${raw}%`,
  };
}

export async function searchPersonsWithTotal(
  query: string,
  offset = 0,
  limit = 8
): Promise<BormePersonSearchPage> {
  try {
    const client = getDb();
    if (!client) {
      const page = Math.floor(offset / limit) + 1;
      return prodFetch(
        `/api/persones?search=${encodeURIComponent(query)}&page=${page}`,
        { data: [], total: 0 },
      );
    }
    if (!canReadTurso()) return { data: [], total: 0 };
    const fts = buildPersonSearchFts(query);
    if (!fts) return { data: [], total: 0 };

    const cacheKey = `${normalizePersonText(query)}|${offset}|${limit}`;
    const cached = getCachedValue(personSearchCache, cacheKey);
    if (cached) return cached;

    let result;
    try {
      result = await client.execute({
        sql: `WITH matched AS (
                SELECT p.person_name,
                       p.num_companies,
                       p.num_companies_with_nif,
                       p.active_spans,
                       p.total_spans,
                       CASE WHEN upper(p.person_name) LIKE upper(?) THEN 1 ELSE 0 END AS ordered_match
                FROM person_summary p
                JOIN person_summary_fts f ON f.rowid = p.rowid
                WHERE person_summary_fts MATCH ?
              )
              SELECT person_name,
                     num_companies,
                     num_companies_with_nif,
                     active_spans,
                     total_spans,
                     count(*) OVER() AS total_matches,
                     ordered_match
              FROM matched
              ORDER BY ordered_match DESC, num_companies_with_nif DESC, num_companies DESC, active_spans DESC, total_spans DESC
              LIMIT ? OFFSET ?`,
        args: [fts.orderedPattern, fts.match, limit, offset],
      });
    } catch (error) {
      const searchWhere = buildPersonSearchWhere(query);
      if (!searchWhere) return { data: [], total: 0 };
      result = await client.execute({
        sql: `SELECT person_name,
                     num_companies,
                     num_companies_with_nif,
                     active_spans,
                     total_spans,
                     count(*) OVER() AS total_matches,
                     CASE WHEN upper(person_name) LIKE upper(?) THEN 1 ELSE 0 END AS ordered_match
              FROM person_summary
              WHERE ${searchWhere.sql}
              ORDER BY ordered_match DESC, num_companies_with_nif DESC, num_companies DESC, active_spans DESC, total_spans DESC
              LIMIT ? OFFSET ?`,
        args: [searchWhere.orderedPattern, ...searchWhere.args, limit, offset],
      });
      console.warn("Falling back to LIKE person search:", error);
    }

    const data = result.rows.map((r) => ({
      person_name: String(r.person_name),
      num_companies: Number(r.num_companies || 0),
      num_companies_with_nif: Number(r.num_companies_with_nif || 0),
      active_spans: Number(r.active_spans || 0),
      total_spans: Number(r.total_spans || 0),
    }));
    const total = Number(result.rows[0]?.total_matches || 0);
    const page = { data, total };
    setCachedValue(personSearchCache, cacheKey, page, SEARCH_CACHE_TTL_MS);
    return page;
  } catch (error) {
    markBlockedRead(error);
    if (isBlockedReadError(error)) return { data: [], total: 0 };
    console.error("Failed to search persons from Turso:", error);
    return { data: [], total: 0 };
  }
}

export async function searchPersons(
  query: string,
  offset = 0,
  limit = 8
): Promise<BormePersonSearchResult[]> {
  const page = await searchPersonsWithTotal(query, offset, limit);
  return page.data;
}

export async function countPersons(query: string): Promise<number> {
  const page = await searchPersonsWithTotal(query, 0, 1);
  return page.total;
}

async function resolveCanonicalPersonName(personName: string): Promise<string | null> {
  const client = getDb();
  if (!client) return null;
  if (!canReadTurso()) return null;
  const trimmed = personName.trim();
  if (!trimmed) return null;

  // Fast exact lookup first (hits person_summary PK).
  const exact = await client.execute({
    sql: `SELECT person_name
          FROM person_summary
          WHERE person_name = ?
          LIMIT 1`,
    args: [trimmed],
  });
  if (exact.rows.length > 0) return String(exact.rows[0].person_name);

  // Fallback for manual URL edits with case/accents differences.
  const normalized = normalizePersonText(trimmed);
  const result = await client.execute({
    sql: `SELECT person_name
          FROM person_summary
          WHERE person_name_norm = ? OR upper(person_name) = upper(?)
          ORDER BY num_companies_with_nif DESC, total_spans DESC
          LIMIT 1`,
    args: [normalized, trimmed],
  });

  if (result.rows.length === 0) return null;
  return String(result.rows[0].person_name);
}

export async function loadPersonProfile(personName: string): Promise<BormePersonProfile | null> {
  try {
    const client = getDb();
    if (!client) return prodFetch(`/api/persones/${encodeURIComponent(personName)}/profile`, null);
    if (!canReadTurso()) return null;
    const normalizedLookup = normalizePersonText(personName);
    const cachedProfile = getCachedValue(personProfileCache, normalizedLookup);
    if (cachedProfile) return cachedProfile;
    const canonicalName = await resolveCanonicalPersonName(personName);
    if (!canonicalName) return null;

    const result = await client.execute({
      sql: `SELECT s.person_name,
                   c.company_name,
                   c.matched_name,
                   c.nif,
                   s.relation_type,
                   s.role_title_raw,
                   s.role_title_code,
                   s.date_start,
                   s.date_end,
                   s.source_pdf_start AS source_pdf
            FROM admin_spans s
            JOIN companies c ON c.id = s.company_id
            WHERE s.person_name = ?
              AND s.relation_type IN ('ADMINISTRADOR','APODERADO','ORGANO_GOBIERNO','LIQUIDADOR','SOCIO_UNICO','SOCIO','ACCIONISTA_UNICO')
            ORDER BY (s.date_end IS NULL) DESC, s.date_start DESC, c.company_name ASC`,
      args: [canonicalName],
    });

    if (result.rows.length === 0) return null;

    const byCompany = new Map<string, BormePersonCompany>();
    for (const row of result.rows) {
      const companyNameBorme = String(row.company_name || "");
      const companyNameMatched = row.matched_name != null ? String(row.matched_name) : null;
      const nif = row.nif != null && String(row.nif).trim() !== "" ? String(row.nif) : null;
      const key = `${companyNameBorme}||${companyNameMatched || ""}||${nif || ""}`;

      const span: BormePersonRoleSpan = {
        relation_type: String(row.relation_type),
        role_title_raw: row.role_title_raw != null ? String(row.role_title_raw) : null,
        role_title_code: row.role_title_code != null ? String(row.role_title_code) : null,
        date_start: String(row.date_start),
        date_end: row.date_end != null ? String(row.date_end) : null,
        source_pdf: row.source_pdf != null ? String(row.source_pdf) : null,
      };

      const existing = byCompany.get(key);
      if (existing) {
        existing.roles.push(span);
        existing.num_spans += 1;
        if (span.date_end === null) existing.active_spans += 1;
        if (span.date_start < existing.first_date_start) existing.first_date_start = span.date_start;
        if (existing.last_date_end !== null && (span.date_end === null || span.date_end > existing.last_date_end)) {
          existing.last_date_end = span.date_end;
        }
      } else {
        byCompany.set(key, {
          company_name_borme: companyNameBorme,
          company_name_matched: companyNameMatched,
          nif,
          num_spans: 1,
          active_spans: span.date_end === null ? 1 : 0,
          first_date_start: span.date_start,
          last_date_end: span.date_end,
          roles: [span],
        });
      }
    }

    const companies = Array.from(byCompany.values()).sort((a, b) => {
      if (b.active_spans !== a.active_spans) return b.active_spans - a.active_spans;
      return b.num_spans - a.num_spans;
    });

    const uniqueNifCompanies = new Set(
      companies
        .map((c) => c.nif)
        .filter((v): v is string => Boolean(v))
    );

    const profile = {
      person_name: canonicalName,
      num_companies: companies.length,
      num_companies_with_nif: uniqueNifCompanies.size,
      total_spans: result.rows.length,
      companies,
    };
    setCachedValue(personProfileCache, normalizedLookup, profile, PROFILE_CACHE_TTL_MS);
    return profile;
  } catch (error) {
    markBlockedRead(error);
    if (isBlockedReadError(error)) return null;
    console.error("Failed to load person profile from Turso:", error);
    return null;
  }
}

export function getPersonAwardeeTargets(profile: BormePersonProfile): BormePersonAwardeeTargets {
  const nifs = new Set<string>();
  const names = new Set<string>();

  for (const company of profile.companies) {
    if (company.nif) {
      nifs.add(company.nif);
    }
    if (company.company_name_matched && company.company_name_matched.trim()) {
      names.add(company.company_name_matched.trim());
    }
    if (company.company_name_borme && company.company_name_borme.trim()) {
      names.add(company.company_name_borme.trim());
    }
  }

  return {
    nifs: Array.from(nifs),
    companyNames: Array.from(names),
  };
}
