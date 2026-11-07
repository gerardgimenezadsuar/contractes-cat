"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import type { CompanyAggregation, OrganAggregation } from "@/lib/types";
import { formatCompactNumber, formatNumber } from "@/lib/utils";
import SearchLoadingIndicator from "@/components/ui/SearchLoadingIndicator";
import { formatPersonDisplayName } from "@/lib/person-utils";
import { buildCompanyHref } from "@/lib/company-identity";
import { trackEvent } from "@/lib/analytics";

/**
 * Unified home search: one box that queries companies, public bodies and
 * people in parallel and shows the results grouped by type.
 */

type Kind = "empresa" | "organisme" | "persona";

interface PersonSearchResult {
  person_name: string;
  num_companies: number;
  num_companies_with_nif: number;
  active_spans: number;
}

interface SectionState<T> {
  rows: T[];
  failed: boolean;
}

interface Results {
  empresa: SectionState<CompanyAggregation>;
  organisme: SectionState<OrganAggregation>;
  persona: SectionState<PersonSearchResult>;
}

const MIN_CHARS: Record<Kind, number> = { empresa: 2, organisme: 2, persona: 3 };
const MAX_ROWS: Record<Kind, number> = { empresa: 5, organisme: 3, persona: 3 };
const SECTION_META: Record<Kind, { label: string; seeAll: (q: string) => string; failure: string }> = {
  empresa: {
    label: "Empreses",
    seeAll: (q) => `/empreses?search=${encodeURIComponent(q)}`,
    failure: "empreses",
  },
  organisme: {
    label: "Organismes",
    seeAll: (q) => `/organismes?search=${encodeURIComponent(q)}`,
    failure: "organismes",
  },
  persona: {
    label: "Persones",
    seeAll: (q) => `/persones?search=${encodeURIComponent(q)}`,
    failure: "persones",
  },
};
const MIN_QUERY = Math.min(...Object.values(MIN_CHARS));

function endpoint(kind: Kind, q: string): string {
  const enc = encodeURIComponent(q);
  if (kind === "empresa") return `/api/empreses?search=${enc}&page=1&includeTotal=0&includeCurrentYear=0`;
  if (kind === "organisme") return `/api/organismes?search=${enc}&page=1&limit=8&includeTotal=0&includeCurrentYear=0`;
  return `/api/persones?search=${enc}&page=1&includeTotal=0`;
}

async function fetchSection<T>(kind: Kind, q: string, signal: AbortSignal): Promise<SectionState<T>> {
  if (q.trim().length < MIN_CHARS[kind]) return { rows: [], failed: false };
  const res = await fetch(endpoint(kind, q), { signal });
  if (!res.ok) throw new Error(`Search ${kind} failed with status ${res.status}`);
  const json = await res.json();
  return { rows: ((json.data || []) as T[]).slice(0, MAX_ROWS[kind]), failed: false };
}

const EMPTY_RESULTS: Results = {
  empresa: { rows: [], failed: false },
  organisme: { rows: [], failed: false },
  persona: { rows: [], failed: false },
};

export default function CompanySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < MIN_QUERY) {
      setResults(EMPTY_RESULTS);
      setOpen(false);
      setLoading(false);
      return;
    }
    // Supersede any search still in flight: handlers below check `controller`
    // so a late or aborted answer never touches the state of a newer search.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setOpen(true);

    const settled = await Promise.allSettled([
      fetchSection<CompanyAggregation>("empresa", q, controller.signal),
      fetchSection<OrganAggregation>("organisme", q, controller.signal),
      fetchSection<PersonSearchResult>("persona", q, controller.signal),
    ]);
    if (controller.signal.aborted) return;
    const pick = <T,>(r: PromiseSettledResult<SectionState<T>>): SectionState<T> => {
      if (r.status === "fulfilled") return r.value;
      console.error("Search failed:", r.reason);
      return { rows: [], failed: true };
    };
    setResults({ empresa: pick(settled[0]), organisme: pick(settled[1]), persona: pick(settled[2]) });
    setLoading(false);
    setOpen(true);
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (val.trim().length < MIN_QUERY) {
        abortRef.current?.abort();
        setResults(EMPTY_RESULTS);
        setOpen(false);
        setLoading(false);
        return;
      }
      debounceRef.current = setTimeout(() => search(val), 300);
    },
    [search]
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const kinds: Kind[] = ["empresa", "organisme", "persona"];
  const failedKinds = kinds.filter((k) => results[k].failed);
  const totalRows = kinds.reduce((n, k) => n + results[k].rows.length, 0);
  const hasQuery = query.trim().length >= MIN_QUERY;

  const close = (kind: Kind) => {
    setOpen(false);
    trackEvent("search_result_click", { mode: kind });
  };

  const sectionHeader = (kind: Kind) => (
    <div className="flex items-center justify-between bg-gray-50 px-4 py-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{SECTION_META[kind].label}</p>
      <Link
        href={SECTION_META[kind].seeAll(query)}
        onClick={() => {
          setOpen(false);
          trackEvent("search_see_all", { mode: kind });
        }}
        className="text-xs text-accent hover:underline"
      >
        Veure&apos;n més
      </Link>
    </div>
  );

  const rowClass = "flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0";

  return (
    <div ref={containerRef} className="relative w-full max-w-3xl lg:mx-auto lg:max-w-[40.5rem]">
      <label htmlFor="home-search-input" className="mb-2 block text-sm font-medium text-gray-700">
        Cerca empreses, organismes i persones
      </label>
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          id="home-search-input"
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => (totalRows > 0 || failedKinds.length > 0) && setOpen(true)}
          placeholder="Ex. ACSA, A28037224, Ajuntament de Vic, Marta Colet..."
          autoComplete="off"
          className={`w-full pl-12 py-3 border border-gray-300 rounded-xl text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent focus:shadow-md transition-shadow bg-white ${
            loading ? "pr-28" : "pr-4"
          }`}
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <SearchLoadingIndicator text="Cercant..." />
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">Mínim 2 caràcters (3 per a persones).</p>

      {open && loading && hasQuery && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-sm text-gray-500 text-center">
          Cercant resultats...
        </div>
      )}

      {open && !loading && hasQuery && (totalRows > 0 || failedKinds.length > 0) && (
        <div className="absolute z-50 w-full mt-1 max-h-[70vh] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
          {failedKinds.length > 0 && (
            <div role="alert" className="border-b border-amber-200 bg-amber-50 p-3 text-center text-sm text-gray-700">
              <p>
                {`No s'ha pogut completar la cerca de ${failedKinds.map((k) => SECTION_META[k].failure).join(" i ")}. La font de dades no ha respost.`}
              </p>
              <button
                type="button"
                onClick={() => search(query)}
                className="mt-2 min-h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Torna-ho a provar
              </button>
            </div>
          )}

          {results.empresa.rows.length > 0 && (
            <div>
              {sectionHeader("empresa")}
              {results.empresa.rows.map((r) => (
                <Link
                  key={`empresa-${r.identificacio_adjudicatari}-${r.denominacio_adjudicatari}`}
                  href={buildCompanyHref(r.identificacio_adjudicatari, r.denominacio_adjudicatari)}
                  onClick={() => close("empresa")}
                  className={rowClass}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.denominacio_adjudicatari}</p>
                    <p className="text-xs text-gray-500 font-mono">{r.identificacio_adjudicatari}</p>
                  </div>
                  <div className="ml-4 text-right shrink-0">
                    <p className="text-sm font-medium text-gray-900">{formatCompactNumber(r.total)}</p>
                    <p className="text-xs text-gray-500">{formatNumber(r.num_contracts)} contractes</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {results.organisme.rows.length > 0 && (
            <div>
              {sectionHeader("organisme")}
              {results.organisme.rows.map((r) => (
                <Link
                  key={`organ-${r.nom_organ}`}
                  href={`/organismes/${encodeURIComponent(r.nom_organ)}`}
                  onClick={() => close("organisme")}
                  className={rowClass}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.nom_organ}</p>
                  </div>
                  <div className="ml-4 text-right shrink-0">
                    <p className="text-sm font-medium text-gray-900">{formatCompactNumber(r.total)}</p>
                    <p className="text-xs text-gray-500">{formatNumber(r.num_contracts)} contractes</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {results.persona.rows.length > 0 && (
            <div>
              {sectionHeader("persona")}
              {results.persona.rows.map((r) => (
                <Link
                  key={`persona-${r.person_name}`}
                  href={`/persones/${encodeURIComponent(r.person_name)}`}
                  onClick={() => close("persona")}
                  className={rowClass}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{formatPersonDisplayName(r.person_name)}</p>
                    <p className="text-xs text-gray-500">{formatNumber(r.num_companies)} empreses vinculades</p>
                  </div>
                  <div className="ml-4 text-right shrink-0">
                    <p className="text-xs text-gray-500">{formatNumber(r.active_spans)} càrrecs actius</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {open && !loading && hasQuery && totalRows === 0 && failedKinds.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-sm text-gray-500 text-center">
          No s&apos;han trobat empreses, organismes ni persones.
        </div>
      )}
    </div>
  );
}
