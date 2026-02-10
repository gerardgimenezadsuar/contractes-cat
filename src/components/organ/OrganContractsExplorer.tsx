"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Contract } from "@/lib/types";
import ContractsTable from "@/components/tables/ContractsTable";
import Pagination from "@/components/ui/Pagination";
import YearFilterChip from "@/components/ui/YearFilterChip";
import DirectAwardLimitChip from "@/components/ui/DirectAwardLimitChip";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import { formatNumber } from "@/lib/utils";

interface Props {
  organName: string;
  year?: number;
  nearDirectAwardOnly?: boolean;
}

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export default function OrganContractsExplorer({
  organName,
  year,
  nearDirectAwardOnly,
}: Props) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [companyFilter, setCompanyFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);

  const fetchData = useCallback(
    async (p: number, s: SortKey, search: string) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const params = new URLSearchParams({ nom_organ: organName, page: String(p), sort: s });
        if (year !== undefined) params.set("year", String(year));
        if (nearDirectAwardOnly) params.set("near_direct_award", "1");
        if (search.trim()) params.set("search", search.trim());
        const res = await fetch(`/api/contractes?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
        const json = await res.json();
        setContracts(json.data);
        setTotal(json.total);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Error fetching organ contracts:", err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [organName, year, nearDirectAwardOnly]
  );

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    setPage(1);
    setSort("date-desc");
    setCompanyFilter("");
    setContracts([]);
    setTotal(0);

    if (abortRef.current) abortRef.current.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    fetchData(1, "date-desc", "");
  }, [fetchData]);

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      fetchData(p, sort, companyFilter);
    },
    [fetchData, sort, companyFilter]
  );

  const handleSortChange = useCallback(
    (newSort: SortKey) => {
      setSort(newSort);
      setPage(1);
      fetchData(1, newSort, companyFilter);
    },
    [fetchData, companyFilter]
  );

  const handleCompanyChange = useCallback(
    (value: string) => {
      setCompanyFilter(value);
      setPage(1);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchData(1, sort, value), 400);
    },
    [fetchData, sort]
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold text-gray-900">Contractes ({formatNumber(total)})</h2>
          {year !== undefined && <YearFilterChip year={year} />}
          {nearDirectAwardOnly && <DirectAwardLimitChip />}
        </div>
      </div>
      <div
        className={`bg-white rounded-lg border border-gray-100 shadow-sm ${
          loading ? "opacity-50" : ""
        }`}
      >
        <div className="border-b border-gray-100 px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="text"
              value={companyFilter}
              onChange={(e) => handleCompanyChange(e.target.value)}
              placeholder="Filtrar per empresa..."
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 sm:max-w-xs"
            />
            <div className="flex items-center gap-2">
              <label htmlFor="organ-contracts-sort" className="text-xs text-gray-500">
                Ordenar per
              </label>
              <select
                id="organ-contracts-sort"
                value={sort}
                onChange={(e) => handleSortChange(e.target.value as SortKey)}
                className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700"
              >
                <option value="date-desc">Data (mes recents)</option>
                <option value="date-asc">Data (mes antigues)</option>
                <option value="amount-desc">Import (mes alt)</option>
                <option value="amount-asc">Import (mes baix)</option>
              </select>
            </div>
          </div>
        </div>

        <ContractsTable contracts={contracts} />
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
