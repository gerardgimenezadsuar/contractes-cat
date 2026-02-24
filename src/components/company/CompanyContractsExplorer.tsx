"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Contract } from "@/lib/types";
import type { SortState } from "@/lib/table-types";
import { sortStateToParam } from "@/lib/table-types";
import ContractsTable from "@/components/tables/ContractsTable";
import Pagination from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import { formatNumber } from "@/lib/utils";

interface Props {
  nif: string;
  initialContracts: Contract[];
  totalContracts: number;
}

export default function CompanyContractsExplorer({
  nif,
  initialContracts,
  totalContracts,
}: Props) {
  const [contracts, setContracts] = useState(initialContracts);
  const [total, setTotal] = useState(totalContracts);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ column: "date", dir: "desc" });
  const [organFilter, setOrganFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);
  const hasFetched = useRef(false);

  const fetchData = useCallback(
    async (p: number, s: string, organ: string) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const params = new URLSearchParams({ nif, page: String(p), sort: s });
        if (organ.trim()) params.set("nom_organ", organ.trim());
        const res = await fetch(`/api/contractes?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
        const json = await res.json();
        setContracts(json.data);
        setTotal(json.total);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Error fetching company contracts:", err);
      } finally {
        setLoading(false);
      }
    },
    [nif]
  );

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      fetchData(p, sortStateToParam(sort), organFilter);
    },
    [fetchData, sort, organFilter]
  );

  const handleSortChange = useCallback(
    (newSort: SortState) => {
      setSort(newSort);
      setPage(1);
      hasFetched.current = true;
      fetchData(1, sortStateToParam(newSort), organFilter);
    },
    [fetchData, organFilter]
  );

  const handleOrganChange = useCallback(
    (value: string) => {
      setOrganFilter(value);
      setPage(1);
      hasFetched.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => fetchData(1, sortStateToParam(sort), value),
        400
      );
    },
    [fetchData, sort]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Contractes ({formatNumber(total)})
        </h2>
      </div>
      <div
        className={`bg-white rounded-lg border border-gray-100 shadow-sm ${
          loading ? "opacity-50" : ""
        }`}
      >
        <div className="border-b border-gray-100 px-3 py-3 sm:px-4">
          <input
            type="text"
            value={organFilter}
            onChange={(e) => handleOrganChange(e.target.value)}
            placeholder="Filtrar per organ..."
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 sm:max-w-xs"
          />
        </div>

        <ContractsTable
          contracts={contracts}
          sortState={sort}
          onSortChange={handleSortChange}
        />
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
