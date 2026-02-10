"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Contract } from "@/lib/types";
import OpenTenderFilters from "@/components/filters/OpenTenderFilters";
import OpenTendersTable from "@/components/tables/OpenTendersTable";
import Pagination from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import { formatNumber } from "@/lib/utils";

const EMPTY_FILTERS = {
  tipus_contracte: "",
  procediment: "",
  amountMin: "",
  amountMax: "",
  nom_organ: "",
  search: "",
  cpvSearch: "",
};

interface Props {
  initialFilters?: typeof EMPTY_FILTERS;
  initialPage?: number;
}

export default function OpenTenderExplorer({
  initialFilters = EMPTY_FILTERS,
  initialPage = 1,
}: Props) {
  const [filters, setFilters] = useState(initialFilters);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>(null);
  const abortRef = useRef<AbortController>(null);
  const latestReqIdRef = useRef(0);

  const fetchData = useCallback(async (f: typeof EMPTY_FILTERS, p: number) => {
    const reqId = ++latestReqIdRef.current;
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (f.tipus_contracte) params.set("tipus_contracte", f.tipus_contracte);
      if (f.procediment) params.set("procediment", f.procediment);
      if (f.amountMin) params.set("amountMin", f.amountMin);
      if (f.amountMax) params.set("amountMax", f.amountMax);
      if (f.nom_organ) params.set("nom_organ", f.nom_organ);
      if (f.search) params.set("search", f.search);
      if (f.cpvSearch) params.set("cpvSearch", f.cpvSearch);
      params.set("page", String(p));

      const res = await fetch(`/api/licitacions?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Failed to fetch open tenders (${res.status}): ${errorText.slice(0, 200)}`
        );
      }

      const json = await res.json();
      if (reqId !== latestReqIdRef.current) return;
      setContracts(json.data);
      setTotal(json.total);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("Error fetching open tenders:", err);
    } finally {
      if (reqId === latestReqIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const buildQueryString = useCallback((f: typeof EMPTY_FILTERS, p: number) => {
    const params = new URLSearchParams();
    if (f.tipus_contracte) params.set("tipus_contracte", f.tipus_contracte);
    if (f.procediment) params.set("procediment", f.procediment);
    if (f.amountMin) params.set("amountMin", f.amountMin);
    if (f.amountMax) params.set("amountMax", f.amountMax);
    if (f.nom_organ) params.set("nom_organ", f.nom_organ);
    if (f.search) params.set("search", f.search);
    if (f.cpvSearch) params.set("cpvSearch", f.cpvSearch);
    if (p > 1) params.set("page", String(p));
    return params.toString();
  }, []);

  const updateUrl = useCallback(
    (f: typeof EMPTY_FILTERS, p: number) => {
      const qs = buildQueryString(f, p);
      const url = qs ? `/licitacions?${qs}` : "/licitacions";
      window.history.replaceState(null, "", url);
    },
    [buildQueryString]
  );

  useEffect(() => {
    fetchData(filters, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleFilterChange = useCallback(
    (key: keyof typeof EMPTY_FILTERS, value: string) => {
      const newFilters = { ...filters, [key]: value };
      setFilters(newFilters);
      setPage(1);
      updateUrl(newFilters, 1);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchData(newFilters, 1), 350);
    },
    [filters, fetchData, updateUrl]
  );

  const handleReset = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    updateUrl(EMPTY_FILTERS, 1);
    fetchData(EMPTY_FILTERS, 1);
  }, [fetchData, updateUrl]);

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      updateUrl(filters, p);
      fetchData(filters, p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [filters, fetchData, updateUrl]
  );

  const exportParams = new URLSearchParams();
  if (filters.tipus_contracte) exportParams.set("tipus_contracte", filters.tipus_contracte);
  if (filters.procediment) exportParams.set("procediment", filters.procediment);
  if (filters.amountMin) exportParams.set("amountMin", filters.amountMin);
  if (filters.amountMax) exportParams.set("amountMax", filters.amountMax);
  if (filters.nom_organ) exportParams.set("nom_organ", filters.nom_organ);
  if (filters.search) exportParams.set("search", filters.search);
  if (filters.cpvSearch) exportParams.set("cpvSearch", filters.cpvSearch);
  exportParams.set("page", String(page));
  exportParams.set("format", "csv");

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <aside>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="lg:hidden w-full flex items-center justify-between bg-white rounded-lg border border-gray-100 shadow-sm px-4 py-3 mb-2 text-sm font-medium text-gray-700"
        >
          <span>Filtres{hasActiveFilters ? " (actius)" : ""}</span>
          <svg
            className={`w-4 h-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div className={`${filtersOpen ? "block" : "hidden"} lg:block`}>
          <OpenTenderFilters
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleReset}
            loading={loading}
          />
        </div>
      </aside>

      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {loading ? "Carregant..." : `${formatNumber(total)} licitacions obertes`}
          </p>
          <a
            href={`/api/licitacions?${exportParams.toString()}`}
            className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Exporta CSV (vista actual)
          </a>
        </div>

        <p className="mb-3 text-xs text-gray-500">
          Només es mostren expedients en fase d&apos;anunci de licitació i amb termini de presentació d&apos;ofertes vigent.
        </p>

        <div className={`bg-white rounded-lg border border-gray-100 shadow-sm ${loading ? "opacity-50" : ""}`}>
          <OpenTendersTable contracts={contracts} />
        </div>

        <Pagination
          currentPage={page}
          totalItems={total}
          pageSize={DEFAULT_PAGE_SIZE}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
