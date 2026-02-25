"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import SearchLoadingIndicator from "@/components/ui/SearchLoadingIndicator";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import { formatNumber } from "@/lib/utils";
import { formatPersonDisplayName } from "@/lib/person-utils";

interface PersonSearchResult {
  person_name: string;
  num_companies: number;
  num_companies_with_nif: number;
  active_spans: number;
  total_spans: number;
}

interface Props {
  initialQuery?: string;
  initialPage?: number;
}

const MIN_SEARCH_CHARS = 3;
const SEARCH_DEBOUNCE_MS = 700;

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase() || "?";
}

export default function PersonSearchExplorer({
  initialQuery = "",
  initialPage = 1,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastCompletedQuery, setLastCompletedQuery] = useState("");
  const [hasCompletedSearch, setHasCompletedSearch] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const requestSeqRef = useRef(0);

  const updateUrl = useCallback((nextQuery: string, nextPage: number) => {
    const q = nextQuery.trim();
    const params = new URLSearchParams();
    if (q.length >= MIN_SEARCH_CHARS) {
      params.set("search", q);
      if (nextPage > 1) params.set("page", String(nextPage));
    }
    const href = params.size > 0 ? `/persones?${params.toString()}` : "/persones";
    router.replace(href, { scroll: false });
  }, [router]);

  const runSearch = useCallback(
    async (nextQuery: string, nextPage: number) => {
      const q = nextQuery.trim();
      if (q.length < MIN_SEARCH_CHARS) {
        if (abortRef.current) abortRef.current.abort();
        setResults([]);
        setTotal(0);
        setLoading(false);
        setHasCompletedSearch(false);
        setLastCompletedQuery("");
        updateUrl("", 1);
        return;
      }

      updateUrl(q, nextPage);

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestSeqRef.current;
      setLoading(true);
      setTotal(0);

      try {
        const params = new URLSearchParams({
          search: q,
          page: String(nextPage),
        });
        const res = await fetch(`/api/persones?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
        const json = await res.json();
        if (requestId !== requestSeqRef.current) return;
        setResults(json.data || []);
        setTotal(json.total || 0);
        setLastCompletedQuery(q);
        setHasCompletedSearch(true);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Error searching persons:", err);
      } finally {
        if (requestId !== requestSeqRef.current) return;
        setLoading(false);
      }
    },
    [updateUrl]
  );

  useEffect(() => {
    if (initialQuery.trim().length >= MIN_SEARCH_CHARS) {
      runSearch(initialQuery, initialPage);
    }
  }, [initialPage, initialQuery, runSearch]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      setPage(1);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        runSearch(value, 1);
      }, SEARCH_DEBOUNCE_MS);
    },
    [runSearch]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      runSearch(query, nextPage);
    },
    [query, runSearch]
  );

  const trimmed = query.trim();
  const canSearch = trimmed.length >= MIN_SEARCH_CHARS;
  const hasResultForCurrentQuery = hasCompletedSearch && lastCompletedQuery === trimmed;
  const showEmptyState =
    canSearch &&
    hasResultForCurrentQuery &&
    !loading &&
    total === 0;
  const showResults = hasResultForCurrentQuery && results.length > 0;

  return (
    <div>
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/70 p-4 sm:p-5 mb-5">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            id="persones-search"
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Cerca persona (nom i cognoms)..."
            className={`w-full rounded-xl border border-gray-300 bg-white py-3 pl-12 text-base shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900 focus:shadow-md ${loading ? "pr-28" : "pr-4"}`}
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <SearchLoadingIndicator text="Cercant..." />
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Cerca automàtica amb un mínim de 3 caràcters.
          </p>
        </div>
      </div>

      {canSearch && !loading && (
        hasResultForCurrentQuery ? (
          <p className="mb-3 text-sm text-gray-500">
            Resultats per a <span className="font-medium text-gray-700">{trimmed}</span>: {formatNumber(total)}
          </p>
        ) : null
      )}
      {canSearch && loading && (
        <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-700">
          Cercant resultats per a <span className="font-semibold">{trimmed}</span>. La primera cerca pot trigar uns segons.
        </div>
      )}

      {!canSearch ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 shadow-sm">
          Introdueix com a mínim {MIN_SEARCH_CHARS} caràcters per començar la cerca.
        </div>
      ) : showEmptyState ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 shadow-sm">
          No s&apos;han trobat persones.
        </div>
      ) : showResults ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {results.map((row) => (
              <Link
                key={row.person_name}
                href={`/persones/${encodeURIComponent(row.person_name)}`}
                className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                    {getInitials(formatPersonDisplayName(row.person_name))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-gray-900 group-hover:text-indigo-700">
                      {formatPersonDisplayName(row.person_name)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatNumber(row.total_spans)} registres societaris
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
                    {formatNumber(row.num_companies)} empreses
                  </span>
                  <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-indigo-700">
                    {formatNumber(row.num_companies_with_nif)} amb NIF
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                    {formatNumber(row.active_spans)} actius
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalItems={total}
            pageSize={DEFAULT_PAGE_SIZE}
            onPageChange={handlePageChange}
          />
        </>
      ) : null}
    </div>
  );
}
