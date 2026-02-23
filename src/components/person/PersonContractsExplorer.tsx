"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Contract } from "@/lib/types";
import ContractsTable from "@/components/tables/ContractsTable";
import Pagination from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import { formatCompactNumber, formatNumber } from "@/lib/utils";

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

interface Props {
  personName: string;
  personNifs: string[];
  initialContracts: Contract[];
  initialTotalContracts?: number;
  initialTotalAmount?: number;
  hasNifTargets: boolean;
}

export default function PersonContractsExplorer({
  personName,
  personNifs,
  initialContracts,
  initialTotalContracts = 0,
  initialTotalAmount = 0,
  hasNifTargets,
}: Props) {
  const [contracts, setContracts] = useState(initialContracts);
  const [total, setTotal] = useState(initialTotalContracts);
  const [totalAmount, setTotalAmount] = useState(initialTotalAmount);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [organFilter, setOrganFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);

  const fetchData = useCallback(
    async (p: number, s: SortKey, organ: string) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(p), sort: s });
        if (organ.trim()) params.set("nom_organ", organ.trim());
        if (personNifs.length > 0) params.set("nifs", personNifs.join(","));
        const res = await fetch(
          `/api/persones/${encodeURIComponent(personName)}/contractes?${params.toString()}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
        const json = await res.json();
        setContracts(json.data || []);
        setTotal(json.total || 0);
        setTotalAmount(Number(json.totalAmount || 0));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Error fetching person contracts:", err);
      } finally {
        setLoading(false);
      }
    },
    [personName, personNifs]
  );

  useEffect(() => {
    if (!hasNifTargets) return;
    if (initialContracts.length > 0) return;
    fetchData(1, sort, organFilter);
  }, [fetchData, hasNifTargets, initialContracts.length, organFilter, sort]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      fetchData(p, sort, organFilter);
    },
    [fetchData, sort, organFilter]
  );

  const handleSortChange = useCallback(
    (newSort: SortKey) => {
      setSort(newSort);
      setPage(1);
      fetchData(1, newSort, organFilter);
    },
    [fetchData, organFilter]
  );

  const handleOrganChange = useCallback(
    (value: string) => {
      setOrganFilter(value);
      setPage(1);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchData(1, sort, value), 400);
    },
    [fetchData, sort]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Contractes vinculats ({formatNumber(total)})
        </h2>
        <p className="text-sm text-gray-500">Import total: {formatCompactNumber(totalAmount)}</p>
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
              value={organFilter}
              onChange={(e) => handleOrganChange(e.target.value)}
              placeholder="Filtrar per organ..."
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 sm:max-w-xs"
            />
            <div className="flex items-center gap-2">
              <label htmlFor="person-contracts-sort" className="text-xs text-gray-500">
                Ordenar per
              </label>
              <select
                id="person-contracts-sort"
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
      {!hasNifTargets && (
        <p className="mt-2 text-xs text-gray-500">
          Aquesta persona no té empreses vinculades amb NIF.
        </p>
      )}
    </div>
  );
}
