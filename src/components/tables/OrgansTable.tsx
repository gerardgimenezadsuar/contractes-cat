"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import type { OrganAggregation } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import SearchInput from "@/components/ui/SearchInput";
import Pagination from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";

interface Props {
  initialData: OrganAggregation[];
  initialTotal: number;
  initialSearch: string;
  initialPage: number;
}

type OrganSortField = "name" | "currentYearAmount" | "totalAmount" | "contracts";
type SortDirection = "asc" | "desc";

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) {
    return (
      <span aria-hidden className="inline-flex h-3 w-3 items-center justify-center text-gray-400">
        <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current">
          <path d="M6 1.5L4.2 3.8H7.8L6 1.5Z" />
          <path d="M6 10.5L7.8 8.2H4.2L6 10.5Z" />
        </svg>
      </span>
    );
  }

  return direction === "desc" ? (
    <span aria-hidden className="inline-flex h-3 w-3 items-center justify-center text-gray-700">
      <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current">
        <path d="M6 10.5L8.6 7.2H3.4L6 10.5Z" />
      </svg>
    </span>
  ) : (
    <span aria-hidden className="inline-flex h-3 w-3 items-center justify-center text-gray-700">
      <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current">
        <path d="M6 1.5L3.4 4.8H8.6L6 1.5Z" />
      </svg>
    </span>
  );
}

export default function OrgansTable({
  initialData,
  initialTotal,
  initialSearch,
  initialPage,
}: Props) {
  const [data, setData] = useState(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<OrganSortField | null>("totalAmount");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const abortRef = useRef<AbortController | null>(null);
  const totalDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (s: string, p: number, includeTotal = true) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (s) params.set("search", s);
      params.set("page", String(p));
      if (!includeTotal) params.set("includeTotal", "0");

      const res = await fetch(`/api/organismes?${params.toString()}`, {
        signal: controller.signal,
      });
      const json = await res.json();
      setData(json.data);
      if (typeof json.total === "number") setTotal(json.total);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Error fetching organismes:", err);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const updateUrl = useCallback((s: string, p: number) => {
    const params = new URLSearchParams();
    if (s) params.set("search", s);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    const url = qs ? `/organismes?${qs}` : "/organismes";
    window.history.replaceState(null, "", url);
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      setPage(1);
      updateUrl(value, 1);
      if (totalDebounceRef.current) clearTimeout(totalDebounceRef.current);

      // Fast path while typing: fetch rows only.
      fetchData(value, 1, false);

      // Settled path: fetch accurate total once user pauses.
      totalDebounceRef.current = setTimeout(() => {
        fetchData(value, 1, true);
      }, 700);
    },
    [fetchData, updateUrl]
  );

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      updateUrl(search, p);
      if (totalDebounceRef.current) clearTimeout(totalDebounceRef.current);
      fetchData(search, p, true);
    },
    [fetchData, search, updateUrl]
  );

  const handleSort = useCallback((field: OrganSortField) => {
    if (sortField === field) {
      setSortDirection((previousDirection) => (previousDirection === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection(field === "name" ? "asc" : "desc");
  }, [sortField]);

  const sortedData = useMemo(() => {
    if (!sortField) return data;

    const getNumericValue = (organ: OrganAggregation) => {
      if (sortField === "currentYearAmount") return parseFloat(organ.total_current_year || "0");
      if (sortField === "totalAmount") return parseFloat(organ.total || "0");
      return parseInt(organ.num_contracts, 10) || 0;
    };

    return [...data].sort((a, b) => {
      if (sortField === "name") {
        const comparison = a.nom_organ.localeCompare(b.nom_organ, "ca", { sensitivity: "base" });
        return sortDirection === "asc" ? comparison : -comparison;
      }

      const comparison = getNumericValue(a) - getNumericValue(b);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortDirection, sortField]);

  useEffect(() => {
    return () => {
      if (totalDebounceRef.current) clearTimeout(totalDebounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div>
      <div className="mb-4 max-w-md">
        <SearchInput
          placeholder="Cerca organisme..."
          value={search}
          onChange={handleSearch}
          debounceMs={550}
          loading={loading}
          loadingText="Filtrant organismes..."
        />
      </div>
      <div className="mb-4 flex justify-end">
        <a
          href={`/api/organismes?${new URLSearchParams({
            ...(search ? { search } : {}),
            page: String(page),
            format: "csv",
          }).toString()}`}
          className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Exporta CSV (vista actual)
        </a>
      </div>

      <div className={`hidden md:block transition-opacity ${loading ? "opacity-50" : ""}`}>
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="w-12 text-left py-3 px-4 font-medium text-gray-500">#</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">
                <button
                  type="button"
                  onClick={() => handleSort("name")}
                  className="inline-flex items-center gap-2 cursor-pointer hover:text-gray-700 transition-colors"
                >
                  <span>Organisme</span>
                  <SortIcon active={sortField === "name"} direction={sortDirection} />
                </button>
              </th>
              <th className="w-36 text-right py-3 px-4 font-medium text-gray-500">
                <button
                  type="button"
                  onClick={() => handleSort("currentYearAmount")}
                  className="inline-flex w-full items-center justify-end gap-2 cursor-pointer hover:text-gray-700 transition-colors"
                >
                  <span>Import {new Date().getFullYear()}</span>
                  <SortIcon active={sortField === "currentYearAmount"} direction={sortDirection} />
                </button>
              </th>
              <th className="w-36 text-right py-3 px-4 font-medium text-gray-500">
                <button
                  type="button"
                  onClick={() => handleSort("totalAmount")}
                  className="inline-flex w-full items-center justify-end gap-2 cursor-pointer hover:text-gray-700 transition-colors"
                >
                  <span>Import històric</span>
                  <SortIcon active={sortField === "totalAmount"} direction={sortDirection} />
                </button>
              </th>
              <th className="w-28 text-right py-3 px-4 font-medium text-gray-500">
                <button
                  type="button"
                  onClick={() => handleSort("contracts")}
                  className="inline-flex w-full items-center justify-end gap-2 cursor-pointer hover:text-gray-700 transition-colors"
                >
                  <span>Contractes</span>
                  <SortIcon active={sortField === "contracts"} direction={sortDirection} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((organ, idx) => {
              const totalAmount = parseFloat(organ.total);
              const currentYearAmount = parseFloat(organ.total_current_year || "0");
              const numContracts = parseInt(organ.num_contracts, 10);
              const rank = (page - 1) * DEFAULT_PAGE_SIZE + idx + 1;

              return (
                <tr key={`${organ.nom_organ}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-400">{rank}</td>
                  <td className="py-3 px-4 break-words">
                    <Link
                      href={`/organismes/${encodeURIComponent(organ.nom_organ)}`}
                      className="text-gray-900 hover:underline font-medium break-words"
                    >
                      {organ.nom_organ}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">{formatCurrency(currentYearAmount)}</td>
                  <td className="py-3 px-4 text-right font-medium">{formatCurrency(totalAmount)}</td>
                  <td className="py-3 px-4 text-right">{formatNumber(numContracts)}</td>
                </tr>
              );
            })}
            {sortedData.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  No s&apos;han trobat resultats.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={`md:hidden space-y-2 transition-opacity ${loading ? "opacity-50" : ""}`}>
        {sortedData.map((organ, idx) => {
          const totalAmount = parseFloat(organ.total);
          const currentYearAmount = parseFloat(organ.total_current_year || "0");
          const numContracts = parseInt(organ.num_contracts, 10);
          const rank = (page - 1) * DEFAULT_PAGE_SIZE + idx + 1;

          return (
            <article key={`m-${organ.nom_organ}-${idx}`} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/organismes/${encodeURIComponent(organ.nom_organ)}`}
                    className="text-sm font-semibold text-gray-900 hover:underline break-words"
                  >
                    {organ.nom_organ}
                  </Link>
                </div>
                <span className="shrink-0 rounded bg-gray-50 px-2 py-0.5 text-xs text-gray-500">#{rank}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500">Import {new Date().getFullYear()}</p>
                  <p className="font-medium text-gray-900">{formatCurrency(currentYearAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Import històric</p>
                  <p className="font-medium text-gray-900">{formatCurrency(totalAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Contractes</p>
                  <p className="font-medium text-gray-900">{formatNumber(numContracts)}</p>
                </div>
              </div>
            </article>
          );
        })}
        {sortedData.length === 0 && !loading && (
          <div className="py-8 text-center text-sm text-gray-500">No s&apos;han trobat resultats.</div>
        )}
      </div>

      <Pagination
        currentPage={page}
        totalItems={total}
        pageSize={DEFAULT_PAGE_SIZE}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
