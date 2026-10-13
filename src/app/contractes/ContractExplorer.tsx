"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Contract } from "@/lib/types";
import ContractFilters, {
  type ContractFilterValues,
  EMPTY_CONTRACT_FILTERS,
} from "@/components/filters/ContractFilters";
import ContractsTable from "@/components/tables/ContractsTable";
import Pagination from "@/components/ui/Pagination";
import ActiveFilterChips from "@/components/filters/ActiveFilterChips";
import MobileSheet from "@/components/ui/MobileSheet";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import { formatNumber } from "@/lib/utils";
import {
  CONTRACT_SORT_OPTIONS,
  DEFAULT_CONTRACT_SORT,
  type ContractSortKey,
} from "@/lib/contract-sort";
import { trackEvent } from "@/lib/analytics";

const EMPTY_CONTRACTS: Contract[] = [];

// Query-string keys as the API route and the CLI expect them.
const FILTER_PARAM_KEYS: Record<keyof ContractFilterValues, string> = {
  year: "year",
  tipus_contracte: "tipus_contracte",
  procediment: "procediment",
  amountMin: "amountMin",
  amountMax: "amountMax",
  nom_organ: "nom_organ",
  search: "search",
  dateFrom: "date_from",
  dateTo: "date_to",
};

const DEBOUNCED_KEYS: ReadonlySet<keyof ContractFilterValues> = new Set([
  "search",
  "nom_organ",
  "amountMin",
  "amountMax",
]);

function buildParams(f: ContractFilterValues, sort: ContractSortKey, page: number): URLSearchParams {
  const params = new URLSearchParams();
  (Object.keys(FILTER_PARAM_KEYS) as Array<keyof ContractFilterValues>).forEach((key) => {
    if (f[key]) params.set(FILTER_PARAM_KEYS[key], f[key]);
  });
  if (sort !== DEFAULT_CONTRACT_SORT) params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  return params;
}

function countActiveFilters(f: ContractFilterValues): number {
  return Object.values(f).filter((v) => v !== "").length;
}

interface Props {
  initialFilters?: ContractFilterValues;
  initialSort?: ContractSortKey;
  initialPage?: number;
  initialContracts?: Contract[];
  initialTotal?: number;
}

export default function ContractExplorer({
  initialFilters = EMPTY_CONTRACT_FILTERS,
  initialSort = DEFAULT_CONTRACT_SORT,
  initialPage = 1,
  initialContracts = EMPTY_CONTRACTS,
  initialTotal = 0,
}: Props) {
  const [filters, setFilters] = useState<ContractFilterValues>(initialFilters);
  const [sort, setSort] = useState<ContractSortKey>(initialSort);
  const [contracts, setContracts] = useState<Contract[]>(initialContracts);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>(null);
  const abortRef = useRef<AbortController>(null);
  const latestReqIdRef = useRef(0);

  const fetchData = useCallback(
    async (f: ContractFilterValues, s: ContractSortKey, p: number) => {
      const reqId = ++latestReqIdRef.current;
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const params = buildParams(f, s, p);
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

  const updateUrl = useCallback((f: ContractFilterValues, s: ContractSortKey, p: number) => {
    const qs = buildParams(f, s, p).toString();
    const url = qs ? `/contractes?${qs}` : "/contractes";
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    if (initialContracts.length === 0) {
      fetchData(filters, sort, page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = useCallback(
    (key: keyof ContractFilterValues, value: string) => {
      const newFilters = { ...filters, [key]: value };
      setFilters(newFilters);
      setPage(1);
      updateUrl(newFilters, sort, 1);
      if (value) trackEvent("filter_change", { page: "contractes", filter: key });

      if (DEBOUNCED_KEYS.has(key)) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchData(newFilters, sort, 1), 400);
      } else {
        fetchData(newFilters, sort, 1);
      }
    },
    [filters, sort, fetchData, updateUrl]
  );

  const handleSortChange = useCallback(
    (nextSort: ContractSortKey) => {
      setSort(nextSort);
      setPage(1);
      updateUrl(filters, nextSort, 1);
      trackEvent("sort_change", { page: "contractes", sort: nextSort });
      fetchData(filters, nextSort, 1);
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
    setFilters(EMPTY_CONTRACT_FILTERS);
    setPage(1);
    updateUrl(EMPTY_CONTRACT_FILTERS, sort, 1);
    fetchData(EMPTY_CONTRACT_FILTERS, sort, 1);
  }, [sort, fetchData, updateUrl]);

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      updateUrl(filters, sort, p);
      trackEvent("paginate", { page: "contractes", to: p });
      fetchData(filters, sort, p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [filters, sort, fetchData, updateUrl]
  );

  const activeFilterCount = countActiveFilters(filters);
  const exportParams = buildParams(filters, sort, page);
  exportParams.set("page", String(page));
  exportParams.set("format", "csv");

  const resultsLabel = loading
    ? "Carregant..."
    : `${formatNumber(total)} contractes trobats`;

  const renderFilters = (embedded: boolean) => (
    <ContractFilters
      filters={filters}
      onChange={handleFilterChange}
      onReset={handleReset}
      loading={loading}
      embedded={embedded}
    />
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <aside className="hidden lg:block">{renderFilters(false)}</aside>

      {/* min-w-0 lets the wide table scroll inside its card instead of widening the page */}
      <div className="min-w-0">
        {/* Mobile: filter button + sheet */}
        <div className="mb-3 flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => {
              setSheetOpen(true);
              trackEvent("filters_open", { page: "contractes" });
            }}
            className="inline-flex min-h-11 flex-1 items-center justify-between rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-800 shadow-sm active:bg-gray-50"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
          >
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18M6 12h12M10 19h4" />
              </svg>
              Filtres
            </span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <select
            aria-label="Ordenar per"
            value={sort}
            onChange={(e) => handleSortChange(e.target.value as ContractSortKey)}
            className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 shadow-sm"
          >
            {(Object.keys(CONTRACT_SORT_OPTIONS) as ContractSortKey[]).map((key) => (
              <option key={key} value={key}>
                {CONTRACT_SORT_OPTIONS[key].label}
              </option>
            ))}
          </select>
        </div>

        <MobileSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Filtres"
          footer={
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="min-h-12 w-full rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white active:bg-gray-700"
            >
              {loading ? "Carregant..." : `Mostra ${formatNumber(total)} contractes`}
            </button>
          }
        >
          {renderFilters(true)}
        </MobileSheet>

        <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <p className="text-sm text-gray-500" aria-live="polite">
            {resultsLabel}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="hidden items-center gap-2 text-xs text-gray-500 lg:inline-flex">
              Ordenar per
              <select
                value={sort}
                onChange={(e) => handleSortChange(e.target.value as ContractSortKey)}
                className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700"
              >
                {(Object.keys(CONTRACT_SORT_OPTIONS) as ContractSortKey[]).map((key) => (
                  <option key={key} value={key}>
                    {CONTRACT_SORT_OPTIONS[key].label}
                  </option>
                ))}
              </select>
            </label>
            <a
              href={`/api/contractes?${exportParams.toString()}`}
              onClick={() => trackEvent("export_csv", { page: "contractes" })}
              className="inline-flex min-h-9 items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Exporta CSV (vista actual)
            </a>
          </div>
        </div>

        <ActiveFilterChips
          filters={filters}
          onRemove={(key) => handleFilterChange(key, "")}
          onClear={handleReset}
        />

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
