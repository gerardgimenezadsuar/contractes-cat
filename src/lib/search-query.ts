/**
 * Query parsing and ranking shared by company, organ and contract search.
 *
 * Pure functions with no imports so they can be unit-tested with the Node
 * test runner directly (see tests/unit/search-query.test.ts).
 */

export interface ParsedSearchQuery {
  /** Trimmed input, whitespace collapsed. */
  raw: string;
  /** Canonical NIF/CIF/NIE when the whole query looks like one, else null. */
  nif: string | null;
  /** Normalized tokens (uppercase, accent-free, alphanumeric), stop words removed. */
  tokens: string[];
  /** Whole query normalized the same way, with separators removed. */
  normalized: string;
}

// Spanish company ids (CIF: letter + 7 digits + control), personal ids
// (DNI: 8 digits + letter) and foreigner ids (NIE: X/Y/Z + 7 digits + letter).
const NIF_PATTERN = /^(?:[A-HJ-NP-SUVW]\d{7}[0-9A-J]|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])$/;

// Tokens that carry no meaning for matching entity names. Kept short on
// purpose: dropping too much makes "Ajuntament de Vic" and "Vic" equivalent.
const STOP_TOKENS = new Set(["DE", "DEL", "DELS", "LA", "EL", "ELS", "LES", "I", "Y", "D", "L", "S", "E"]);

export function foldText(value: string): string {
  return value
    .normalize("NFD")
    // Strip combining marks (accents) left by NFD decomposition.
    .replace(/[\u0300-\u036f]/g, "")
    // Catalan geminated l ("col·legi") is one word, not two.
    .replace(/[\u00b7\u2022]/g, "")
    .replace(/[\u00e7]/g, "c")
    .replace(/[\u00c7]/g, "C")
    .replace(/[\u00f1]/g, "n")
    .replace(/[\u00d1]/g, "N")
    .toUpperCase();
}

/** Uppercase, accent-free, alphanumeric-only form used for exact/prefix comparisons. */
export function normalizeForMatch(value: string): string {
  return foldText(value).replace(/[^A-Z0-9]/g, "");
}

export function canonicalizeNif(value: string): string | null {
  const compact = foldText(value).replace(/[^A-Z0-9]/g, "");
  return NIF_PATTERN.test(compact) ? compact : null;
}

export function tokenizeSearch(value: string): string[] {
  return foldText(value)
    .split(/[^A-Z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_TOKENS.has(token));
}

export function parseSearchQuery(input: string): ParsedSearchQuery {
  const raw = (input || "").trim().replace(/\s+/g, " ");
  const nif = raw ? canonicalizeNif(raw) : null;
  let tokens = raw ? tokenizeSearch(raw) : [];
  if (tokens.length === 0 && raw) {
    // Everything was a stop word or too short ("SA", "de"): fall back to the
    // raw tokens so the query still does something.
    tokens = foldText(raw)
      .split(/[^A-Z0-9]+/)
      .filter((token) => token.length > 0);
  }
  return { raw, nif, tokens, normalized: normalizeForMatch(raw) };
}

/**
 * Match quality of a candidate name against the parsed query, higher is better.
 * 4 exact, 3 prefix, 2 every token starts a word, 1 every token appears, 0 none.
 */
export function scoreNameMatch(name: string, query: ParsedSearchQuery): number {
  if (!name) return 0;
  const normalized = normalizeForMatch(name);
  if (query.normalized && normalized === query.normalized) return 4;
  if (query.normalized && normalized.startsWith(query.normalized)) return 3;
  if (query.tokens.length === 0) return 0;
  const words = foldText(name)
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const allWordPrefixes = query.tokens.every((token) => words.some((w) => w.startsWith(token)));
  if (allWordPrefixes) return 2;
  const allContained = query.tokens.every((token) => normalized.includes(token));
  return allContained ? 1 : 0;
}

/**
 * Stable sort by match quality, then by the numeric tiebreaker (e.g. total
 * amount) descending. Rows that match nothing keep their relative order at
 * the end, so the caller never loses results the backend returned.
 */
export function rankByMatch<T>(
  rows: T[],
  query: ParsedSearchQuery,
  getName: (row: T) => string,
  getTiebreaker: (row: T) => number
): T[] {
  return rows
    .map((row, index) => ({ row, index, score: scoreNameMatch(getName(row), query) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const diff = getTiebreaker(b.row) - getTiebreaker(a.row);
      if (diff !== 0) return diff;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}
