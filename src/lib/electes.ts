import { REVALIDATE_SECONDS } from "@/config/constants";

const ELECTES_BASE_URL =
  "https://analisi.transparenciacatalunya.cat/resource/m5nd-xjza.json";
const SOCRATA_APP_TOKEN = process.env.SOCRATA_APP_TOKEN;
const MAX_MATCHED_ROWS = 200;
const MAX_POSITION_KEYS = 40;
const MAX_ENS_MATCHED_ROWS = 5000;
const MIN_ENS_MATCH_SCORE = 0.45;
const NAME_CONNECTOR_TOKENS = new Set([
  "DE",
  "DEL",
  "DELS",
  "DELA",
  "LA",
  "LES",
  "LOS",
  "LAS",
  "DA",
  "DO",
  "DOS",
  "DAS",
  "DI",
  "VON",
  "VAN",
  "DEN",
  "DER",
  "AL",
  "EL",
]);

interface ElecteRawRow {
  codi_ens?: string;
  nom_complert?: string;
  ordre?: string;
  nom_regidor?: string;
  carrec?: string;
  area?: string;
  partit?: string;
  municipi_representa?: string;
  data_nomenament?: string;
  e_mail?: string;
  sexe?: string;
}

interface ElectePositionEvent {
  personName: string;
  startDate: string | null;
}

export interface PublicOfficePeriod {
  key: string;
  codiEns: string;
  ensName: string;
  carrec: string;
  area: string | null;
  partit: string | null;
  municipiRepresenta: string | null;
  sourcePersonName: string;
  matchScore: number;
  startDate: string | null;
  endDate: string | null;
  endDateInference: "successor" | "open" | "unknown";
}

export interface PublicOfficeProfile {
  periods: PublicOfficePeriod[];
  matchedNames: string[];
}

export interface CurrentEnsOfficeHolder {
  key: string;
  codiEns: string;
  ensName: string;
  personName: string;
  carrec: string;
  ordre: string | null;
  area: string | null;
  partit: string | null;
  municipiRepresenta: string | null;
  startDate: string | null;
}

export interface CurrentEnsOfficePage {
  codiEns: string | null;
  ensName: string | null;
  matchedEnsNames: string[];
  totalCurrentRoles: number;
  page: number;
  pageSize: number;
  rows: CurrentEnsOfficeHolder[];
}

function tokenizeName(value: string): string[] {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];
  return normalized.split(" ").filter((token) => token.length >= 2);
}

function tokenizePersonName(value: string): string[] {
  return tokenizeName(value).filter((token) => !NAME_CONNECTOR_TOKENS.has(token));
}

function toPairKey(a: string, b: string): string {
  return a <= b ? `${a}||${b}` : `${b}||${a}`;
}

function likelySurnamePairKeys(value: string): Set<string> {
  const tokens = tokenizePersonName(value);
  const pairs = new Set<string>();
  if (tokens.length < 3) return pairs;
  pairs.add(toPairKey(tokens[0], tokens[1]));
  pairs.add(toPairKey(tokens[tokens.length - 2], tokens[tokens.length - 1]));
  return pairs;
}

function hasCompatibleSurnamePair(target: string, candidate: string): boolean {
  const targetPairs = likelySurnamePairKeys(target);
  if (targetPairs.size === 0) return true;
  const candidatePairs = likelySurnamePairKeys(candidate);
  if (candidatePairs.size === 0) return false;
  for (const pair of targetPairs) {
    if (candidatePairs.has(pair)) return true;
  }
  return false;
}

function scoreNameMatch(target: string, candidate: string): number {
  const a = tokenizeName(target);
  const b = tokenizeName(candidate);
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let overlap = 0;
  for (const token of setA) {
    if (setB.has(token)) overlap += 1;
  }
  if (overlap === 0) return 0;
  return overlap / Math.max(setA.size, setB.size);
}

function safeDate(value?: string): string | null {
  if (!value) return null;
  const isoDate = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : null;
}

function dayBefore(dateIso: string): string | null {
  const d = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function escapeSoql(value: string): string {
  return value.replace(/'/g, "''");
}

function buildPersonNameTokenClause(token: string): string {
  const clauses: string[] = [`upper(nom_regidor) like upper('%${escapeSoql(token)}%')`];

  const prefix = token.slice(0, Math.min(4, token.length));
  if (prefix.length >= 3 && prefix !== token) {
    clauses.push(`upper(nom_regidor) like upper('%${escapeSoql(prefix)}%')`);
  }

  const consonants = token.replace(/[AEIOU]/g, "");
  if (consonants.length >= 3) {
    const consonantPattern = consonants.split("").join("%");
    clauses.push(`upper(nom_regidor) like upper('%${escapeSoql(consonantPattern)}%')`);
  }

  return `(${clauses.join(" OR ")})`;
}

async function soqlFetch<T>(params: Record<string, string>): Promise<T[]> {
  const url = new URL(ELECTES_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const headers: Record<string, string> = {};
  if (SOCRATA_APP_TOKEN) headers["X-App-Token"] = SOCRATA_APP_TOKEN;

  const res = await fetch(url.toString(), {
    headers,
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Electes Socrata API error:", res.status, text);
    throw new Error(`Electes Socrata API error: ${res.status}`);
  }
  return res.json();
}

function buildNameSearchWhere(personName: string): string {
  const tokens = tokenizeName(personName).slice(0, 5);
  if (tokens.length === 0) {
    return `upper(nom_regidor) like upper('%${escapeSoql(personName)}%')`;
  }
  return tokens
    .filter((token) => token.length >= 3)
    .map((token) => buildPersonNameTokenClause(token))
    .join(" AND ");
}

function buildFallbackNameSearchWhere(personName: string): string | null {
  const tokens = tokenizeName(personName)
    .filter((token) => token.length >= 3)
    .slice(0, 2);

  if (tokens.length === 0) return null;

  const tokenClauses = tokens.map((token) => buildPersonNameTokenClause(token));

  return tokenClauses.join(" AND ");
}

function buildEnsExactWhere(ensName: string): string | null {
  const trimmed = ensName.trim();
  if (!trimmed) return null;
  return `upper(nom_complert)=upper('${escapeSoql(trimmed)}')`;
}

function buildEnsFallbackWhere(ensName: string): string | null {
  const tokens = tokenizeName(ensName)
    .filter((token) => token.length >= 3)
    .slice(0, 6);
  if (tokens.length === 0) {
    const trimmed = ensName.trim();
    if (!trimmed) return null;
    return `upper(nom_complert) like upper('%${escapeSoql(trimmed)}%')`;
  }
  return tokens
    .map((token) => `upper(nom_complert) like upper('%${escapeSoql(token)}%')`)
    .join(" AND ");
}

type PositionGroup = {
  key: string;
  codiEns: string;
  ensName: string;
  carrec: string;
  area: string | null;
  partit: string | null;
  municipiRepresenta: string | null;
  personName: string;
  score: number;
  starts: Set<string>;
};

function buildPositionKey(row: ElecteRawRow): string {
  return `${row.codi_ens || ""}||${row.nom_complert || ""}||${row.carrec || ""}`;
}

function buildEnsSeatKey(row: ElecteRawRow): string {
  const codiEns = String(row.codi_ens || "").trim();
  const carrec = String(row.carrec || "").trim().toUpperCase();
  const ordre = String(row.ordre || "").trim().toUpperCase();
  const area = String(row.area || "").trim().toUpperCase();
  const person = tokenizeName(String(row.nom_regidor || "")).join(" ");
  const disambiguator = ordre || area || person || "SENSE-DETALL";
  return `${codiEns}||${carrec}||${disambiguator}`;
}

function shouldReplaceSeatHolder(currentDate: string | null, nextDate: string | null): boolean {
  if (nextDate && !currentDate) return true;
  if (!nextDate) return false;
  if (!currentDate) return true;
  return nextDate > currentDate;
}

export async function fetchCurrentEnsOfficeHolders(
  ensName: string,
  options?: { page?: number; pageSize?: number }
): Promise<CurrentEnsOfficePage> {
  const page = Number.isFinite(options?.page) && (options?.page || 0) > 0 ? Math.floor(options?.page || 1) : 1;
  const rawPageSize = Number.isFinite(options?.pageSize) && (options?.pageSize || 0) > 0 ? Math.floor(options?.pageSize || 20) : 20;
  const pageSize = Math.max(5, Math.min(rawPageSize, 100));

  const selectFields =
    "codi_ens, nom_complert, ordre, nom_regidor, carrec, area, partit, municipi_representa, data_nomenament";

  const exactWhere = buildEnsExactWhere(ensName);
  let rows: ElecteRawRow[] = [];

  if (exactWhere) {
    rows = await soqlFetch<ElecteRawRow>({
      $select: selectFields,
      $where: exactWhere,
      $order: "data_nomenament DESC",
      $limit: String(MAX_ENS_MATCHED_ROWS),
    });
  }

  if (rows.length === 0) {
    const fallbackWhere = buildEnsFallbackWhere(ensName);
    if (fallbackWhere) {
      rows = await soqlFetch<ElecteRawRow>({
        $select: selectFields,
        $where: fallbackWhere,
        $order: "data_nomenament DESC",
        $limit: String(MAX_ENS_MATCHED_ROWS),
      });
    }
  }

  if (rows.length === 0) {
    return {
      codiEns: null,
      ensName: null,
      matchedEnsNames: [],
      totalCurrentRoles: 0,
      page,
      pageSize,
      rows: [],
    };
  }

  const groups = new Map<
    string,
    { codiEns: string; ensName: string; score: number; rows: ElecteRawRow[]; latestDate: string | null }
  >();

  for (const row of rows) {
    const rowEnsName = String(row.nom_complert || "").trim();
    if (!rowEnsName) continue;
    const rowCodiEns = String(row.codi_ens || "").trim();
    const key = `${rowCodiEns}||${rowEnsName}`;
    const score = scoreNameMatch(ensName, rowEnsName);
    const startDate = safeDate(row.data_nomenament);
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
      if (score > existing.score) existing.score = score;
      if (startDate && (!existing.latestDate || startDate > existing.latestDate)) {
        existing.latestDate = startDate;
      }
    } else {
      groups.set(key, {
        codiEns: rowCodiEns,
        ensName: rowEnsName,
        score,
        rows: [row],
        latestDate: startDate,
      });
    }
  }

  const rankedGroups = Array.from(groups.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.rows.length !== a.rows.length) return b.rows.length - a.rows.length;
    return (b.latestDate || "").localeCompare(a.latestDate || "");
  });

  const bestGroup = rankedGroups[0];
  if (!bestGroup) {
    return {
      codiEns: null,
      ensName: null,
      matchedEnsNames: [],
      totalCurrentRoles: 0,
      page,
      pageSize,
      rows: [],
    };
  }

  if (rows.length > 0 && bestGroup.score < MIN_ENS_MATCH_SCORE) {
    return {
      codiEns: null,
      ensName: null,
      matchedEnsNames: rankedGroups.slice(0, 3).map((group) => group.ensName),
      totalCurrentRoles: 0,
      page,
      pageSize,
      rows: [],
    };
  }

  const currentBySeat = new Map<string, CurrentEnsOfficeHolder>();

  for (const row of bestGroup.rows) {
    const personName = String(row.nom_regidor || "").trim();
    const carrec = String(row.carrec || "").trim();
    if (!personName || !carrec) continue;

    const seatKey = buildEnsSeatKey(row);
    const startDate = safeDate(row.data_nomenament);
    const holder: CurrentEnsOfficeHolder = {
      key: seatKey,
      codiEns: bestGroup.codiEns,
      ensName: bestGroup.ensName,
      personName,
      carrec,
      ordre: row.ordre ? String(row.ordre).trim() : null,
      area: row.area ? String(row.area).trim() : null,
      partit: row.partit ? String(row.partit).trim() : null,
      municipiRepresenta: row.municipi_representa ? String(row.municipi_representa).trim() : null,
      startDate,
    };

    const existing = currentBySeat.get(seatKey);
    if (!existing || shouldReplaceSeatHolder(existing.startDate, holder.startDate)) {
      currentBySeat.set(seatKey, holder);
    }
  }

  const orderedCurrent = Array.from(currentBySeat.values()).sort((a, b) => {
    if (a.startDate && b.startDate && a.startDate !== b.startDate) {
      return b.startDate.localeCompare(a.startDate);
    }
    if (a.startDate && !b.startDate) return -1;
    if (!a.startDate && b.startDate) return 1;
    if (a.carrec !== b.carrec) return a.carrec.localeCompare(b.carrec, "ca");
    const aOrdre = parseInt(a.ordre || "", 10);
    const bOrdre = parseInt(b.ordre || "", 10);
    const hasAOrdre = Number.isFinite(aOrdre);
    const hasBOrdre = Number.isFinite(bOrdre);
    if (hasAOrdre && hasBOrdre && aOrdre !== bOrdre) return aOrdre - bOrdre;
    if (hasAOrdre && !hasBOrdre) return -1;
    if (!hasAOrdre && hasBOrdre) return 1;
    return a.personName.localeCompare(b.personName, "ca");
  });

  const totalCurrentRoles = orderedCurrent.length;
  const totalPages = Math.max(1, Math.ceil(totalCurrentRoles / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pagedRows = start < totalCurrentRoles ? orderedCurrent.slice(start, start + pageSize) : [];

  return {
    codiEns: bestGroup.codiEns || null,
    ensName: bestGroup.ensName || null,
    matchedEnsNames: rankedGroups.slice(0, 3).map((group) => group.ensName),
    totalCurrentRoles,
    page: safePage,
    pageSize,
    rows: pagedRows,
  };
}

export async function fetchPublicOfficeProfile(personName: string): Promise<PublicOfficeProfile> {
  const strictWhere = buildNameSearchWhere(personName);
  if (!strictWhere) return { periods: [], matchedNames: [] };

  let initialRows = await soqlFetch<ElecteRawRow>({
    $select:
      "codi_ens, nom_complert, nom_regidor, carrec, area, partit, municipi_representa, data_nomenament",
    $where: strictWhere,
    $limit: String(MAX_MATCHED_ROWS),
    $order: "data_nomenament DESC",
  });

  if (initialRows.length === 0) {
    const fallbackWhere = buildFallbackNameSearchWhere(personName);
    if (fallbackWhere) {
      initialRows = await soqlFetch<ElecteRawRow>({
        $select:
          "codi_ens, nom_complert, nom_regidor, carrec, area, partit, municipi_representa, data_nomenament",
        $where: fallbackWhere,
        $limit: String(MAX_MATCHED_ROWS),
        $order: "data_nomenament DESC",
      });
    }
  }

  const filteredRows = initialRows
    .map((row) => {
      const sourcePersonName = String(row.nom_regidor || "").trim();
      const score = hasCompatibleSurnamePair(personName, sourcePersonName)
        ? scoreNameMatch(personName, sourcePersonName)
        : 0;
      return { row, sourcePersonName, score };
    })
    .filter((item) => item.score >= 0.6);

  if (filteredRows.length === 0) return { periods: [], matchedNames: [] };

  const positionGroups = new Map<string, PositionGroup>();
  const matchedNames = new Set<string>();

  for (const item of filteredRows) {
    const row = item.row;
    const key = buildPositionKey(row);
    if (!key.trim() || !row.codi_ens || !row.nom_complert || !row.carrec) continue;
    matchedNames.add(item.sourcePersonName);
    const startDate = safeDate(row.data_nomenament);

    const existing = positionGroups.get(key);
    if (existing) {
      if (startDate) existing.starts.add(startDate);
      if (item.score > existing.score) {
        existing.score = item.score;
        existing.personName = item.sourcePersonName;
      }
    } else {
      const starts = new Set<string>();
      if (startDate) starts.add(startDate);
      positionGroups.set(key, {
        key,
        codiEns: String(row.codi_ens),
        ensName: String(row.nom_complert),
        carrec: String(row.carrec),
        area: row.area ? String(row.area) : null,
        partit: row.partit ? String(row.partit) : null,
        municipiRepresenta: row.municipi_representa ? String(row.municipi_representa) : null,
        personName: item.sourcePersonName,
        score: item.score,
        starts,
      });
    }
  }

  const keys = Array.from(positionGroups.values()).slice(0, MAX_POSITION_KEYS);
  if (keys.length === 0) return { periods: [], matchedNames: Array.from(matchedNames) };

  const keyWhere = keys
    .map(
      (k) =>
        `(codi_ens='${escapeSoql(k.codiEns)}' AND nom_complert='${escapeSoql(k.ensName)}' AND carrec='${escapeSoql(k.carrec)}')`
    )
    .join(" OR ");

  const timelineRows = await soqlFetch<ElecteRawRow>({
    $select: "codi_ens, nom_complert, carrec, nom_regidor, data_nomenament",
    $where: `${keyWhere} AND data_nomenament IS NOT NULL`,
    $limit: "5000",
    $order: "data_nomenament ASC",
  });

  const eventsByKey = new Map<string, ElectePositionEvent[]>();
  for (const row of timelineRows) {
    const key = buildPositionKey(row);
    const person = String(row.nom_regidor || "").trim();
    const startDate = safeDate(row.data_nomenament);
    if (!key || !person || !startDate) continue;
    const list = eventsByKey.get(key) || [];
    list.push({ personName: person, startDate });
    eventsByKey.set(key, list);
  }

  const periods: PublicOfficePeriod[] = [];

  for (const group of keys) {
    const events = (eventsByKey.get(group.key) || []).sort((a, b) =>
      (a.startDate || "").localeCompare(b.startDate || "")
    );
    const starts = Array.from(group.starts.values()).sort((a, b) => a.localeCompare(b));

    if (starts.length === 0) {
      periods.push({
        key: group.key,
        codiEns: group.codiEns,
        ensName: group.ensName,
        carrec: group.carrec,
        area: group.area,
        partit: group.partit,
        municipiRepresenta: group.municipiRepresenta,
        sourcePersonName: group.personName,
        matchScore: group.score,
        startDate: null,
        endDate: null,
        endDateInference: "unknown",
      });
      continue;
    }

    for (const startDate of starts) {
      const successor = events.find(
        (event) => event.startDate && event.startDate > startDate && scoreNameMatch(group.personName, event.personName) < 0.5
      );
      const inferredEnd = successor?.startDate ? dayBefore(successor.startDate) : null;

      periods.push({
        key: `${group.key}||${startDate}`,
        codiEns: group.codiEns,
        ensName: group.ensName,
        carrec: group.carrec,
        area: group.area,
        partit: group.partit,
        municipiRepresenta: group.municipiRepresenta,
        sourcePersonName: group.personName,
        matchScore: group.score,
        startDate,
        endDate: inferredEnd,
        endDateInference: inferredEnd ? "successor" : "open",
      });
    }
  }

  periods.sort((a, b) => {
    if (a.startDate && b.startDate) return b.startDate.localeCompare(a.startDate);
    if (a.startDate) return -1;
    if (b.startDate) return 1;
    return b.matchScore - a.matchScore;
  });

  return {
    periods,
    matchedNames: Array.from(matchedNames).sort((a, b) => a.localeCompare(b)),
  };
}
