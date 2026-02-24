"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { formatCompactNumber, formatNumber } from "@/lib/utils";
import SearchInput from "@/components/ui/SearchInput";
import {
  fetchUnifiedSearch,
  isAbortError,
  minCharsForMode,
  type PersonSearchResult,
} from "@/lib/search";
import type { CompanyAggregation, OrganAggregation } from "@/lib/types";

const RESULTS_PER_SECTION = 5;
const MIN_CHARS = minCharsForMode("tots");

interface Props {
  initialSearch: string;
}

export default function UnifiedSearch({ initialSearch }: Props) {
  const [search, setSearch] = useState(initialSearch);
  const [empreses, setEmpreses] = useState<CompanyAggregation[]>([]);
  const [organismes, setOrganismes] = useState<OrganAggregation[]>([]);
  const [persones, setPersones] = useState<PersonSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchResults = useCallback(async (q: string) => {
    if (q.trim().length < MIN_CHARS) {
      setEmpreses([]);
      setOrganismes([]);
      setPersones([]);
      setLoading(false);
      setError(null);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const sections = await fetchUnifiedSearch(q, "tots", abortRef.current.signal, {
        mixedSectionLimit: RESULTS_PER_SECTION,
      });

      setEmpreses(sections.empreses);
      setOrganismes(sections.organismes);
      setPersones(sections.persones);
      setHasSearched(true);
    } catch (errorValue) {
      if (isAbortError(errorValue)) {
        return;
      }
      setEmpreses([]);
      setOrganismes([]);
      setPersones([]);
      setError("No hem pogut carregar resultats. Torna-ho a provar.");
      setHasSearched(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      const url = new URL(window.location.href);
      if (value) {
        url.searchParams.set("search", value);
      } else {
        url.searchParams.delete("search");
      }
      window.history.replaceState(null, "", url.toString());
      fetchResults(value);
    },
    [fetchResults]
  );

  // Fetch on mount if there's an initial search
  useEffect(() => {
    if (initialSearch.trim().length >= MIN_CHARS) {
      fetchResults(initialSearch);
    }
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalResults = empreses.length + organismes.length + persones.length;
  const encodedSearch = encodeURIComponent(search);

  return (
    <div>
      <SearchInput
        placeholder="Cerca empreses, organismes o persones..."
        value={search}
        onChange={handleSearch}
        loading={loading}
        loadingText="Cercant..."
      />

      <p className="mt-2 text-xs text-gray-500">
        Cerca automàtica amb mínim 3 caràcters.
      </p>

      {!loading && error && (
        <p className="mt-8 text-center text-sm text-red-600">
          {error}
        </p>
      )}

      {loading && search.trim().length >= MIN_CHARS && (
        <p className="mt-8 text-center text-sm text-gray-500">
          Cercant resultats...
        </p>
      )}

      {!loading && !error && hasSearched && totalResults === 0 && (
        <p className="mt-8 text-center text-sm text-gray-500">
          No s&apos;han trobat resultats per &quot;{search}&quot;.
        </p>
      )}

      {!loading && totalResults > 0 && (
        <div className="mt-6 space-y-8">
          {/* Empreses */}
          {empreses.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    Empreses
                  </span>
                  <span className="text-sm font-normal text-gray-500">
                    {empreses.length} resultats
                  </span>
                </h2>
                <Link
                  href={`/empreses?search=${encodedSearch}`}
                  className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
                >
                  Veure tots &rarr;
                </Link>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {empreses.map((row) => (
                  <Link
                    key={row.identificacio_adjudicatari}
                    href={`/empreses/${encodeURIComponent(row.identificacio_adjudicatari)}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {row.denominacio_adjudicatari}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">
                        {row.identificacio_adjudicatari}
                      </p>
                    </div>
                    <div className="ml-4 text-right shrink-0">
                      <p className="text-sm font-medium text-gray-900">
                        {formatCompactNumber(row.total)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatNumber(row.num_contracts)} contractes
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Organismes */}
          {organismes.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Organismes
                  </span>
                  <span className="text-sm font-normal text-gray-500">
                    {organismes.length} resultats
                  </span>
                </h2>
                <Link
                  href={`/organismes?search=${encodedSearch}`}
                  className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
                >
                  Veure tots &rarr;
                </Link>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {organismes.map((row) => (
                  <Link
                    key={row.nom_organ}
                    href={`/organismes/${encodeURIComponent(row.nom_organ)}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {row.nom_organ}
                      </p>
                    </div>
                    <div className="ml-4 text-right shrink-0">
                      <p className="text-sm font-medium text-gray-900">
                        {formatCompactNumber(row.total)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatNumber(row.num_contracts)} contractes
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Persones */}
          {persones.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Persones
                  </span>
                  <span className="text-sm font-normal text-gray-500">
                    {persones.length} resultats
                  </span>
                </h2>
                <Link
                  href={`/persones?search=${encodedSearch}`}
                  className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
                >
                  Veure tots &rarr;
                </Link>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {persones.map((row) => (
                  <Link
                    key={row.person_name}
                    href={`/persones/${encodeURIComponent(row.person_name)}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {row.person_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatNumber(row.num_companies)} empreses vinculades
                      </p>
                    </div>
                    <div className="ml-4 text-right shrink-0">
                      <p className="text-xs text-gray-500">
                        {formatNumber(row.active_spans)} càrrecs actius
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
