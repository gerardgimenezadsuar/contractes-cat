"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Contract } from "@/lib/types";
import ContractFilters from "@/components/filters/ContractFilters";
import ContractsTable from "@/components/tables/ContractsTable";
import Pagination from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import { formatNumber } from "@/lib/utils";

const EMPTY_CONTRACTS: Contract[] = [];

const EMPTY_FILTERS = {
  year: "",
  tipus_contracte: "",
  procediment: "",
  amountMin: "",
  amountMax: "",
  nom_organ: "",
  search: "",
};

interface Props {
  initialFilters?: typeof EMPTY_FILTERS;
  initialPage?: number;
  initialContracts?: Contract[];
  initialTotal?: number;
}

export default function ContractExplorer({
  initialFilters = EMPTY_FILTERS,
  initialPage = 1,
  initialContracts = EMPTY_CONTRACTS,
  initialTotal = 0,
}: Props) {
  const [filters, setFilters] = useState(initialFilters);
  const [contracts, setContracts] = useState<Contract[]>(initialContracts);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>(null);
  const abortRef = useRef<AbortController>(null);
  const latestReqIdRef = useRef(0);

  const fetchData = useCallback(
    async (f: typeof EMPTY_FILTERS, p: number) => {
      const reqId = ++latestReqIdRef.current;
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (f.year) params.set("year", f.year);
        if (f.tipus_contracte) params.set("tipus_contracte", f.tipus_contracte);
        if (f.procediment) params.set("procediment", f.procediment);
        if (f.amountMin) params.set("amountMin", f.amountMin);
        if (f.amountMax) params.set("amountMax", f.amountMax);
        if (f.nom_organ) params.set("nom_organ", f.nom_organ);
        if (f.search) params.set("search", f.search);
        params.set("page", String(p));

        const res = await fetch(`/api/contractes?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(
            `Failed to fetch contracts (${res.status}): ${errorText.slice(0, 200)}`
          );
        }
        const json = await res.json();
        if (reqId !== latestReqIdRef.current) return;
        setContracts(json.data);
        setTotal(json.total);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Error fetching contracts:", err);
      } finally {
        if (reqId === latestReqIdRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  const buildQueryString = useCallback((f: typeof EMPTY_FILTERS, p: number) => {
    const params = new URLSearchParams();
    if (f.year) params.set("year", f.year);
    if (f.tipus_contracte) params.set("tipus_contracte", f.tipus_contracte);
    if (f.procediment) params.set("procediment", f.procediment);
    if (f.amountMin) params.set("amountMin", f.amountMin);
    if (f.amountMax) params.set("amountMax", f.amountMax);
    if (f.nom_organ) params.set("nom_organ", f.nom_organ);
    if (f.search) params.set("search", f.search);
    if (p > 1) params.set("page", String(p));
    return params.toString();
  }, []);

  const updateUrl = useCallback(
    (f: typeof EMPTY_FILTERS, p: number) => {
      const qs = buildQueryString(f, p);
      const url = qs ? `/contractes?${qs}` : "/contractes";
      window.history.replaceState(null, "", url);
    },
    [buildQueryString]
  );

  const handleCopyShareLink = useCallback(async () => {
    const qs = buildQueryString(filters, page);
    const url = `${window.location.origin}${qs ? `/contractes?${qs}` : "/contractes"}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch (err) {
      console.error("Error copying share link:", err);
    }
  }, [buildQueryString, filters, page]);

  useEffect(() => {
    if (initialContracts.length === 0) {
      fetchData(filters, page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      const newFilters = { ...filters, [key]: value };
      setFilters(newFilters);
      setPage(1);
      updateUrl(newFilters, 1);

      // Debounce text inputs
      if (key === "search" || key === "nom_organ" || key === "amountMin" || key === "amountMax") {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchData(newFilters, 1), 400);
      } else {
        fetchData(newFilters, 1);
      }
    },
    [filters, fetchData, updateUrl]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

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

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");
  const exportParams = new URLSearchParams();
  if (filters.year) exportParams.set("year", filters.year);
  if (filters.tipus_contracte) exportParams.set("tipus_contracte", filters.tipus_contracte);
  if (filters.procediment) exportParams.set("procediment", filters.procediment);
  if (filters.amountMin) exportParams.set("amountMin", filters.amountMin);
  if (filters.amountMax) exportParams.set("amountMax", filters.amountMax);
  if (filters.nom_organ) exportParams.set("nom_organ", filters.nom_organ);
  if (filters.search) exportParams.set("search", filters.search);
  exportParams.set("page", String(page));
  exportParams.set("format", "csv");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <aside>
        {/* Mobile filter toggle */}
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
          <ContractFilters
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleReset}
            loading={loading}
          />
        </div>
      </aside>

      <div>
        <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <p className="text-sm text-gray-500">
            {loading ? "Carregant..." : `${formatNumber(total)} contractes trobats`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/contractes?${exportParams.toString()}`}
              className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Exporta CSV (vista actual)
            </a>
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {shareCopied ? "Enllaç copiat" : "Copia enllaç"}
            </button>
          </div>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Data ref. = data d&apos;adjudicació; si manca, formalització o publicació. Pot haver-hi
          registres atípics al dataset original.
        </p>

        <div
          className={`bg-white rounded-lg border border-gray-100 shadow-sm ${
            loading ? "opacity-50" : ""
          }`}
        >
          <ContractsTable contracts={contracts} />
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
