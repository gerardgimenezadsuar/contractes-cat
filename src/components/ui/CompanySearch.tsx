"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CompanyAggregation, OrganAggregation } from "@/lib/types";
import SearchLoadingIndicator from "@/components/ui/SearchLoadingIndicator";
import {
  CompanyResultRow,
  OrganResultRow,
  PersonResultRow,
} from "@/components/search/company-search";
import {
  fetchUnifiedSearch,
  isAbortError,
  minCharsForMode,
  type PersonSearchResult,
  type SearchMode,
} from "@/lib/search";

type SearchResult =
  | ({ kind: "empresa" } & CompanyAggregation)
  | ({ kind: "organisme" } & OrganAggregation)
  | ({ kind: "persona" } & PersonSearchResult);

const modeOptions: Array<{ mode: SearchMode; label: string }> = [
  { mode: "tots", label: "Tots" },
  { mode: "empresa", label: "Empreses" },
  { mode: "organisme", label: "Organismes" },
  { mode: "persona", label: "Persones" },
];

const modeButtonClass = (isActive: boolean): string =>
  `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
    isActive
      ? "border-gray-900 bg-gray-900 text-white"
      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
  }`;

const renderNoResultsMessage = (mode: SearchMode): string => {
  if (mode === "tots") return "No s'han trobat resultats.";
  if (mode === "empresa") return "No s'han trobat empreses.";
  if (mode === "organisme") return "No s'han trobat organismes.";
  return "No s'han trobat persones.";
};

export default function CompanySearch() {
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>("tots");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string, nextMode: SearchMode) => {
    const minChars = minCharsForMode(nextMode);
    if (q.trim().length < minChars) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setOpen(true);
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const sections = await fetchUnifiedSearch(q, nextMode, abortRef.current.signal);
      const merged: SearchResult[] = [
        ...sections.empreses.map((row) => ({ kind: "empresa" as const, ...row })),
        ...sections.organismes.map((row) => ({ kind: "organisme" as const, ...row })),
        ...sections.persones.map((row) => ({ kind: "persona" as const, ...row })),
      ];
      setResults(merged);
      setOpen(true);
    } catch (errorValue) {
      if (isAbortError(errorValue)) {
        return;
      }
      setResults([]);
      setError("No hem pogut carregar resultats. Torna-ho a provar.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const minChars = minCharsForMode(mode);
      if (val.trim().length < minChars) {
        setResults([]);
        setOpen(false);
        setLoading(false);
        setError(null);
        return;
      }
      debounceRef.current = setTimeout(() => search(val, mode), 300);
    },
    [mode, search]
  );

  const switchMode = useCallback((nextMode: SearchMode) => {
    // Clicking the active filter toggles back to "tots"
    const resolved = nextMode === mode && nextMode !== "tots" ? "tots" : nextMode;
    setMode(resolved);
    setResults([]);
    setError(null);
    setOpen(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length >= minCharsForMode(resolved)) {
      debounceRef.current = setTimeout(() => search(query, resolved), 100);
    }
  }, [query, search, mode]);

  const allResultsHref = useCallback((m: SearchMode): string => {
    const q = encodeURIComponent(query);
    switch (m) {
      case "empresa":   return `/empreses?search=${q}`;
      case "organisme": return `/organismes?search=${q}`;
      case "persona":   return `/persones?search=${q}`;
      default:          return `/tots?search=${q}`;
    }
  }, [query]);

  const goToAllResults = useCallback(() => {
    if (query.trim().length < minCharsForMode(mode)) return;
    setOpen(false);
    router.push(allResultsHref(mode));
  }, [query, mode, router, allResultsHref]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-3xl">
      <div className="mb-2 flex items-center gap-2">
        {modeOptions.map((option) => (
          <button
            key={option.mode}
            type="button"
            onClick={() => switchMode(option.mode)}
            className={modeButtonClass(mode === option.mode)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-gray-500">
        {mode === "persona" || mode === "tots"
          ? "Cerca automàtica amb mínim 3 caràcters."
          : "Cerca automàtica amb mínim 2 caràcters."}
      </p>
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={(e) => { if (e.key === "Enter") goToAllResults(); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={
            mode === "tots"
              ? "Cerca empreses, organismes o persones..."
              : mode === "empresa"
                ? "Cerca empresa per nom o NIF..."
                : mode === "organisme"
                  ? "Cerca organisme per nom..."
                  : "Cerca persona per nom..."
          }
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

      {open && loading && query.trim().length >= minCharsForMode(mode) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-sm text-gray-500 text-center">
          Cercant resultats...
        </div>
      )}

      {open && !loading && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {results.map((result) => {
            const showTypeBadge = mode === "tots";
            const handleSelect = () => setOpen(false);
            if (result.kind === "empresa") {
              return (
                <CompanyResultRow
                  key={`empresa-${result.identificacio_adjudicatari}`}
                  result={result}
                  showTypeBadge={showTypeBadge}
                  onSelect={handleSelect}
                />
              );
            }

            if (result.kind === "organisme") {
              return (
                <OrganResultRow
                  key={`organ-${result.nom_organ}`}
                  result={result}
                  showTypeBadge={showTypeBadge}
                  onSelect={handleSelect}
                />
              );
            }

            return (
              <PersonResultRow
                key={`persona-${result.person_name}`}
                result={result}
                showTypeBadge={showTypeBadge}
                onSelect={handleSelect}
              />
            );
          })}
          <Link
            href={
              allResultsHref(mode)
            }
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-center text-sm text-gray-600 hover:bg-gray-50 bg-gray-50"
          >
            Veure tots els resultats
          </Link>
        </div>
      )}

      {open && !loading && error && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-red-200 rounded-xl shadow-lg p-4 text-sm text-red-600 text-center">
          {error}
        </div>
      )}

      {open && query.trim().length >= minCharsForMode(mode) && results.length === 0 && !loading && !error && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-sm text-gray-500 text-center">
          {renderNoResultsMessage(mode)}
        </div>
      )}
    </div>
  );
}
