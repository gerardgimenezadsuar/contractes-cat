"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { CompanyAggregation } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import SearchInput from "@/components/ui/SearchInput";
import Pagination from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";

interface Props {
  initialData: CompanyAggregation[];
  initialTotal: number;
  initialSearch: string;
  initialPage: number;
}

function parseNifs(raw: string): string[] {
  if (!raw) return [];
  const normalized = raw.trim().toUpperCase();

  const byDelimiter = normalized
    .split(/[;,|/]+/)
    .flatMap((part) => part.trim().split(/\s+/))
    .map((part) => part.trim())
    .filter(Boolean);

  if (byDelimiter.length > 1) return Array.from(new Set(byDelimiter));

  // Fallback for malformed concatenations without separators.
  const extracted = normalized.match(/[A-Z]\d{8}|\d{8}[A-Z]|[A-Z0-9]{9}/g) || [];
  if (extracted.length > 1) return Array.from(new Set(extracted));

  return [normalized];
}

export default function CompaniesTable({
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
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (s: string, p: number) => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (s) params.set("search", s);
      params.set("page", String(p));

      const res = await fetch(`/api/empreses?${params.toString()}`, {
        signal: controller.signal,
      });
      const json = await res.json();
      setData(json.data);
      setTotal(json.total);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Error fetching companies:", err);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const updateUrl = useCallback((s: string, p: number) => {
    const params = new URLSearchParams();
    if (s) params.set("search", s);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    const url = qs ? `/empreses?${qs}` : "/empreses";
    window.history.replaceState(null, "", url);
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      setPage(1);
      updateUrl(value, 1);
      fetchData(value, 1);
    },
    [fetchData, updateUrl]
  );

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      updateUrl(search, p);
      fetchData(search, p);
    },
    [fetchData, search, updateUrl]
  );

  return (
    <div>
      <div className="mb-4 max-w-md">
        <SearchInput
          placeholder="Cerca empresa per nom o NIF..."
          value={search}
          onChange={handleSearch}
        />
      </div>
      <div className="mb-4 flex justify-end">
        <a
          href={`/api/empreses?${new URLSearchParams({
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
            <tr className="border-b border-gray-200">
              <th className="w-12 text-left py-3 px-4 font-medium text-gray-500">#</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Empresa</th>
              <th className="w-44 text-left py-3 px-4 font-medium text-gray-500">NIF</th>
              <th className="w-36 text-right py-3 px-4 font-medium text-gray-500">Import total</th>
              <th className="w-28 text-right py-3 px-4 font-medium text-gray-500">Contractes</th>
              <th className="w-32 text-right py-3 px-4 font-medium text-gray-500">Mitjana</th>
            </tr>
          </thead>
          <tbody>
            {data.map((company, idx) => {
              const totalAmount = parseFloat(company.total);
              const numContracts = parseInt(company.num_contracts, 10);
              const avg = numContracts > 0 ? totalAmount / numContracts : 0;
              const rank = (page - 1) * DEFAULT_PAGE_SIZE + idx + 1;

              return (
                <tr
                  key={`${company.identificacio_adjudicatari}-${company.denominacio_adjudicatari}-${idx}`}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4 text-gray-400">{rank}</td>
                  <td className="py-3 px-4 break-words">
                    <Link
                      href={`/empreses/${encodeURIComponent(company.identificacio_adjudicatari)}`}
                      className="text-gray-900 hover:underline font-medium break-words"
                    >
                      {company.denominacio_adjudicatari}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1.5">
                      {parseNifs(company.identificacio_adjudicatari).map((nif) => (
                        <span
                          key={`${company.identificacio_adjudicatari}-${nif}`}
                          className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-[11px] font-mono text-gray-700"
                          title={nif}
                        >
                          {nif}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(totalAmount)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatNumber(numContracts)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-500">
                    {formatCurrency(avg)}
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No s&apos;han trobat resultats.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={`md:hidden space-y-2 transition-opacity ${loading ? "opacity-50" : ""}`}>
        {data.map((company, idx) => {
          const totalAmount = parseFloat(company.total);
          const numContracts = parseInt(company.num_contracts, 10);
          const avg = numContracts > 0 ? totalAmount / numContracts : 0;
          const rank = (page - 1) * DEFAULT_PAGE_SIZE + idx + 1;
          const nifs = parseNifs(company.identificacio_adjudicatari);

          return (
            <article
              key={`m-${company.identificacio_adjudicatari}-${company.denominacio_adjudicatari}-${idx}`}
              className="rounded-lg border border-gray-200 bg-white p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <Link
                  href={`/empreses/${encodeURIComponent(company.identificacio_adjudicatari)}`}
                  className="min-w-0 text-sm font-semibold text-gray-900 hover:underline break-words"
                >
                  {company.denominacio_adjudicatari}
                </Link>
                <span className="shrink-0 rounded bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
                  #{rank}
                </span>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                {nifs.slice(0, 3).map((nif) => (
                  <span
                    key={`m-${company.identificacio_adjudicatari}-${nif}`}
                    className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-[11px] font-mono text-gray-700"
                    title={nif}
                  >
                    {nif}
                  </span>
                ))}
                {nifs.length > 3 && (
                  <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                    +{nifs.length - 3}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500">Import total</p>
                  <p className="font-medium text-gray-900">{formatCurrency(totalAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Contractes</p>
                  <p className="font-medium text-gray-900">{formatNumber(numContracts)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Mitjana</p>
                  <p className="font-medium text-gray-900">{formatCurrency(avg)}</p>
                </div>
              </div>
            </article>
          );
        })}
        {data.length === 0 && !loading && (
          <div className="py-8 text-center text-sm text-gray-500">
            No s&apos;han trobat resultats.
          </div>
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
