/**
 * Entity search backed by the Supabase search index (companies and organs
 * synced nightly from Socrata, see supabase/). Every function returns null
 * when the index is not configured, empty or unreachable, so callers can fall
 * back to querying Socrata directly.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CompanyAggregation, OrganAggregation } from "@/lib/types";
import {
  parseSearchQuery,
  rankByMatch,
  scoreNameMatch,
  type ParsedSearchQuery,
} from "@/lib/search-query";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/config/constants";

// How many alias rows to pull per search before ranking in the app; counts
// are exact as long as a query matches fewer aliases than this.
const CANDIDATE_LIMIT = 2000;
// A sync that finished more than this long ago is treated as stale and the
// app falls back to Socrata (the nightly job normally refreshes daily).
const MAX_INDEX_AGE_HOURS = 72;
const STATUS_CACHE_MS = 60_000;

// Ranked result sets are memoized briefly so the list and count requests the
// search pages fire together hit the index once.
const RESULT_CACHE_MS = 60_000;
const RESULT_CACHE_MAX = 200;

let client: SupabaseClient | null = null;
let statusCache: { checkedAt: number; ready: boolean } | null = null;
const resultCache = new Map<string, { at: number; value: Promise<unknown[] | null> }>();

function memoized<T>(key: string, compute: () => Promise<T[] | null>): Promise<T[] | null> {
  const hit = resultCache.get(key);
  if (hit && Date.now() - hit.at < RESULT_CACHE_MS) return hit.value as Promise<T[] | null>;
  const value = compute().then((result) => {
    // Never cache a failure: the next request should retry the index.
    if (result === null) resultCache.delete(key);
    return result;
  });
  if (resultCache.size >= RESULT_CACHE_MAX) {
    const oldest = resultCache.keys().next().value;
    if (oldest !== undefined) resultCache.delete(oldest);
  }
  resultCache.set(key, { at: Date.now(), value });
  return value;
}

export function searchIndexConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) && process.env.SEARCH_INDEX_DISABLED !== "1";
}

function getClient(): SupabaseClient | null {
  if (!searchIndexConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** True when a sync completed recently enough for the index to be trusted. */
export async function searchIndexReady(): Promise<boolean> {
  const db = getClient();
  if (!db) return false;
  if (statusCache && Date.now() - statusCache.checkedAt < STATUS_CACHE_MS) return statusCache.ready;
  try {
    const { data, error } = await db
      .from("search_sync_runs")
      .select("finished_at")
      .eq("status", "completed")
      .order("id", { ascending: false })
      .limit(1);
    const finishedAt = !error && data?.[0]?.finished_at ? new Date(data[0].finished_at).getTime() : 0;
    const ready = finishedAt > 0 && Date.now() - finishedAt < MAX_INDEX_AGE_HOURS * 3_600_000;
    statusCache = { checkedAt: Date.now(), ready };
    return ready;
  } catch (error) {
    console.warn("search index status check failed:", error);
    statusCache = { checkedAt: Date.now(), ready: false };
    return false;
  }
}

interface AliasRow {
  identity_key: string;
  nif: string;
  display_name: string;
  matched_alias: string;
  total_amount: number | string;
  num_contracts: number | string;
  total_current_year: number | string;
}

interface OrganRow {
  name: string;
  total_amount: number | string;
  num_contracts: number | string;
  total_current_year: number | string;
}

export interface IndexedCompanyPage {
  rows: CompanyAggregation[];
  /** Exact number of matching companies (capped only for enormous result sets). */
  total: number;
}

export interface IndexedOrganPage {
  rows: OrganAggregation[];
  total: number;
}

function toCompanyAggregation(row: AliasRow, parsed: ParsedSearchQuery): CompanyAggregation {
  // Show the most-used spelling unless it would not explain the match.
  const displayName =
    scoreNameMatch(row.display_name, parsed) > 0 ? row.display_name : row.matched_alias;
  return {
    identificacio_adjudicatari: row.nif,
    denominacio_adjudicatari: displayName,
    total: String(row.total_amount),
    num_contracts: String(row.num_contracts),
    total_current_year: String(row.total_current_year),
  };
}

/**
 * Company search on the index: every token must appear in some spelling of
 * the name (any order, accents and punctuation ignored); results are ranked
 * with the same scorer as the Socrata path. A NIF matches exactly. With no
 * token matches, trigram similarity catches typos ("ferovial").
 */
export async function searchCompaniesIndexed(
  search: string,
  offset: number,
  limit: number
): Promise<IndexedCompanyPage | null> {
  const db = getClient();
  if (!db || !(await searchIndexReady())) return null;
  const parsed = parseSearchQuery(search);
  if (!parsed.nif && parsed.tokens.length === 0) return { rows: [], total: 0 };
  const key = `c:${parsed.nif ?? parsed.tokens.join(" ")}`;
  const ranked = await memoized(key, () => rankedCompanies(db, parsed));
  if (!ranked) return null;
  return {
    rows: ranked.slice(offset, offset + limit).map((row) => toCompanyAggregation(row, parsed)),
    total: ranked.length,
  };
}

async function rankedCompanies(db: SupabaseClient, parsed: ParsedSearchQuery): Promise<AliasRow[] | null> {
  try {
    let rows: AliasRow[] = [];
    if (parsed.nif) {
      const { data, error } = await db
        .from("company_alias_search")
        .select("identity_key, nif, display_name, matched_alias, total_amount, num_contracts, total_current_year")
        .eq("nif", parsed.nif)
        .order("alias_total", { ascending: false })
        .limit(50);
      if (error) throw error;
      rows = (data ?? []) as AliasRow[];
    } else {
      let query = db
        .from("company_alias_search")
        .select("identity_key, nif, display_name, matched_alias, total_amount, num_contracts, total_current_year");
      for (const token of parsed.tokens) {
        query = query.like("alias_norm", `%${token}%`);
      }
      const { data, error } = await query.order("total_amount", { ascending: false }).limit(CANDIDATE_LIMIT);
      if (error) throw error;
      rows = (data ?? []) as AliasRow[];
      if (rows.length === 0 && parsed.normalized.length >= 4) {
        const { data: fuzzy, error: fuzzyError } = await db.rpc("search_companies_fuzzy", {
          p_query: parsed.normalized,
          p_limit: 100,
        });
        if (fuzzyError) throw fuzzyError;
        rows = (fuzzy ?? []) as AliasRow[];
      }
    }

    // One entry per company, keeping the best-matching spelling.
    const byIdentity = new Map<string, AliasRow>();
    for (const row of rows) {
      const existing = byIdentity.get(row.identity_key);
      if (!existing || scoreNameMatch(row.matched_alias, parsed) > scoreNameMatch(existing.matched_alias, parsed)) {
        byIdentity.set(row.identity_key, row);
      }
    }
    return rankByMatch(
      Array.from(byIdentity.values()),
      parsed,
      (row) => row.matched_alias,
      (row) => Number(row.total_amount) || 0
    );
  } catch (error) {
    console.warn("search index company query failed, falling back to Socrata:", error);
    return null;
  }
}

export async function searchOrgansIndexed(
  search: string,
  offset: number,
  limit: number
): Promise<IndexedOrganPage | null> {
  const db = getClient();
  if (!db || !(await searchIndexReady())) return null;
  const parsed = parseSearchQuery(search);
  if (parsed.tokens.length === 0) return { rows: [], total: 0 };
  const ranked = await memoized(`o:${parsed.tokens.join(" ")}`, () => rankedOrgans(db, parsed));
  if (!ranked) return null;
  return {
    rows: ranked.slice(offset, offset + limit).map((row) => ({
      nom_organ: row.name,
      total: String(row.total_amount),
      num_contracts: String(row.num_contracts),
      total_current_year: String(row.total_current_year),
    })),
    total: ranked.length,
  };
}

async function rankedOrgans(db: SupabaseClient, parsed: ParsedSearchQuery): Promise<OrganRow[] | null> {
  try {
    let query = db.from("organs").select("name, total_amount, num_contracts, total_current_year");
    for (const token of parsed.tokens) {
      query = query.like("name_norm", `%${token}%`);
    }
    const { data, error } = await query.order("total_amount", { ascending: false }).limit(CANDIDATE_LIMIT);
    if (error) throw error;
    let rows = (data ?? []) as OrganRow[];
    if (rows.length === 0 && parsed.normalized.length >= 4) {
      const { data: fuzzy, error: fuzzyError } = await db.rpc("search_organs_fuzzy", {
        p_query: parsed.normalized,
        p_limit: 100,
      });
      if (fuzzyError) throw fuzzyError;
      rows = (fuzzy ?? []) as OrganRow[];
    }
    return rankByMatch(rows, parsed, (row) => row.name, (row) => Number(row.total_amount) || 0);
  } catch (error) {
    console.warn("search index organ query failed, falling back to Socrata:", error);
    return null;
  }
}
