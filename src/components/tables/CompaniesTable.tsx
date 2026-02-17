"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import type { CompanyAggregation } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import SearchInput from "@/components/ui/SearchInput";
import Pagination from "@/components/ui/Pagination";
import { CPV_DIVISIONS, DEFAULT_PAGE_SIZE } from "@/config/constants";

interface Props {
  initialData: CompanyAggregation[];
  initialTotal: number;
  initialSearch: string;
  initialCpv: string[];
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

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function resolveCpvCodesFromTokens(tokens: string[]): string[] {
  const resolved = new Set<string>();

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    const digits = trimmed.replace(/\D/g, "");
    if (digits.length >= 2) {
      const code = digits.slice(0, 2);
      if (CPV_DIVISIONS[code]) {
        resolved.add(code);
        continue;
      }
    }

    const normalizedToken = normalizeText(trimmed);
    for (const [code, label] of Object.entries(CPV_DIVISIONS)) {
      if (normalizeText(label).includes(normalizedToken) || code.includes(normalizedToken)) {
        resolved.add(code);
      }
    }
  }

  return Array.from(resolved).sort((a, b) => Number(a) - Number(b));
}

export default function CompaniesTable({
  initialData,
  initialTotal,
  initialSearch,
  initialCpv,
  initialPage,
}: Props) {
  const [data, setData] = useState(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState(initialSearch);
  const [cpvCodes, setCpvCodes] = useState(() => resolveCpvCodesFromTokens(initialCpv));
  const [cpvQuery, setCpvQuery] = useState("");
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [expandedNifs, setExpandedNifs] = useState<Set<number>>(new Set());
  const cpvDropdownRef = useRef<HTMLDetailsElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const totalDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const cpvOptions = useMemo(
    () =>
      Object.entries(CPV_DIVISIONS)
        .map(([code, label]) => ({ code, label }))
        .sort((a, b) => Number(a.code) - Number(b.code)),
    []
  );

  const filteredCpvOptions = useMemo(() => {
    const q = normalizeText(cpvQuery.trim());
    if (!q) return cpvOptions;
    return cpvOptions.filter(
      (opt) => opt.code.includes(q) || normalizeText(opt.label).includes(q)
    );
  }, [cpvOptions, cpvQuery]);

  const hasCpvFilter = cpvCodes.length > 0;

  const fetchData = useCallback(async (s: string, cpvFilter: string[], p: number, includeTotal = true) => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (s) params.set("search", s);
      if (cpvFilter.length > 0) params.set("cpv", cpvFilter.join(","));
      params.set("page", String(p));
      if (!includeTotal) params.set("includeTotal", "0");

      const res = await fetch(`/api/empreses?${params.toString()}`, {
        signal: controller.signal,
      });
      const json = await res.json();
      setData(json.data);
      if (typeof json.total === "number") setTotal(json.total);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Error fetching companies:", err);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const updateUrl = useCallback((s: string, cpvFilter: string[], p: number) => {
    const params = new URLSearchParams();
    if (s) params.set("search", s);
    if (cpvFilter.length > 0) params.set("cpv", cpvFilter.join(","));
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    const url = qs ? `/empreses?${qs}` : "/empreses";
    window.history.replaceState(null, "", url);
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      setPage(1);
      updateUrl(value, cpvCodes, 1);
      if (totalDebounceRef.current) clearTimeout(totalDebounceRef.current);

      // Fast path while typing: fetch rows only.
      fetchData(value, cpvCodes, 1, false);

      // Settled path: fetch accurate total once user pauses.
      totalDebounceRef.current = setTimeout(() => {
        fetchData(value, cpvCodes, 1, true);
      }, 700);
    },
    [cpvCodes, fetchData, updateUrl]
  );

  const handleCpvToggle = useCallback(
    (code: string) => {
      const nextCodes = cpvCodes.includes(code)
        ? cpvCodes.filter((item) => item !== code)
        : [...cpvCodes, code];

      setCpvCodes(nextCodes);
      setPage(1);
      updateUrl(search, nextCodes, 1);
      if (totalDebounceRef.current) clearTimeout(totalDebounceRef.current);
      fetchData(search, nextCodes, 1, true);
    },
    [cpvCodes, fetchData, search, updateUrl]
  );

  const handleCpvClear = useCallback(() => {
    setCpvCodes([]);
    setPage(1);
    updateUrl(search, [], 1);
    if (totalDebounceRef.current) clearTimeout(totalDebounceRef.current);
    fetchData(search, [], 1, true);
  }, [fetchData, search, updateUrl]);

  const handleCpvRemove = useCallback(
    (code: string) => {
      const nextCodes = cpvCodes.filter((item) => item !== code);
      setCpvCodes(nextCodes);
      setPage(1);
      updateUrl(search, nextCodes, 1);
      if (totalDebounceRef.current) clearTimeout(totalDebounceRef.current);
      fetchData(search, nextCodes, 1, true);
    },
    [cpvCodes, fetchData, search, updateUrl]
  );

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      updateUrl(search, cpvCodes, p);
      if (totalDebounceRef.current) clearTimeout(totalDebounceRef.current);
      fetchData(search, cpvCodes, p, true);
    },
    [cpvCodes, fetchData, search, updateUrl]
  );

  useEffect(() => {
    return () => {
      if (totalDebounceRef.current) clearTimeout(totalDebounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const root = cpvDropdownRef.current;
      if (!root || !root.hasAttribute("open")) return;
      const target = event.target as Node | null;
      if (target && root.contains(target)) return;
      root.removeAttribute("open");
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cpvDropdownRef.current?.removeAttribute("open");
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, []);

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <SearchInput
          placeholder="Cerca empresa per nom o NIF..."
          value={search}
          onChange={handleSearch}
          debounceMs={550}
          loading={loading}
          loadingText="Filtrant empreses..."
        />

        <details
          ref={cpvDropdownRef}
          className="relative rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <summary className="cursor-pointer list-none select-none text-gray-700">
            Filtre CPV {hasCpvFilter ? `(${cpvCodes.length})` : ""}
          </summary>
          <div className="absolute left-0 z-20 mt-2 w-full rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
            <input
              type="text"
              value={cpvQuery}
              onChange={(e) => setCpvQuery(e.target.value)}
              placeholder="Cerca codi o sector CPV..."
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <div className="max-h-56 overflow-auto space-y-1">
              {filteredCpvOptions.map((opt) => (
                <label
                  key={opt.code}
                  className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={cpvCodes.includes(opt.code)}
                    onChange={() => handleCpvToggle(opt.code)}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-700">
                    <span className="font-mono text-xs text-gray-500">CPV {opt.code}</span>{" "}
                    {opt.label}
                  </span>
                </label>
              ))}
              {filteredCpvOptions.length === 0 && (
                <p className="px-2 py-1 text-xs text-gray-500">Sense coincidències</p>
              )}
            </div>
            {hasCpvFilter && (
              <button
                type="button"
                onClick={handleCpvClear}
                className="mt-2 text-xs text-gray-600 underline hover:text-gray-900"
              >
                Neteja CPV
              </button>
            )}
          </div>
        </details>
      </div>

      {hasCpvFilter && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {cpvCodes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
            >
              <span className="font-mono text-[11px]">CPV {code}</span>
              <span>{CPV_DIVISIONS[code] || `Sector ${code}`}</span>
              <button
                type="button"
                onClick={() => handleCpvRemove(code)}
                className="ml-1 text-gray-500 hover:text-gray-800"
                aria-label={`Elimina CPV ${code}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <a
          href={`/api/empreses?${new URLSearchParams({
            ...(search ? { search } : {}),
            ...(cpvCodes.length > 0 ? { cpv: cpvCodes.join(",") } : {}),
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
              <th className="text-left py-3 px-4 font-medium text-gray-500">Empresa</th>
              <th className="w-44 text-left py-3 px-4 font-medium text-gray-500">NIF</th>
              <th className="w-36 text-right py-3 px-4 font-medium text-gray-500">
                Import {new Date().getFullYear()} {hasCpvFilter ? "(CPV)" : ""}
              </th>
              <th className="w-36 text-right py-3 px-4 font-medium text-gray-500">
                {hasCpvFilter ? "Import filtrat CPV" : "Import històric"}
              </th>
              <th className="w-28 text-right py-3 px-4 font-medium text-gray-500">
                {hasCpvFilter ? "Contractes CPV" : "Contractes"}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((company, idx) => {
              const totalAmount = parseFloat(company.total);
              const currentYearAmount = parseFloat(company.total_current_year || "0");
              const numContracts = parseInt(company.num_contracts, 10);
              const rank = (page - 1) * DEFAULT_PAGE_SIZE + idx + 1;
              const nifs = parseNifs(company.identificacio_adjudicatari);
              const names = company.denominacio_adjudicatari.split("||").map((n: string) => n.trim()).filter(Boolean);
              const isUte = nifs.length > 1 || names.length > 1;
              const isExpanded = expandedNifs.has(rank);

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
                      {isUte && !isExpanded ? names[0] : company.denominacio_adjudicatari}
                    </Link>
                    {isUte && !isExpanded && (
                      <button
                        onClick={() => setExpandedNifs((prev) => new Set(prev).add(rank))}
                        className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer align-middle"
                        title={`UTE amb ${names.length} empreses — clic per expandir`}
                      >
                        UTE · +{names.length - 1}
                      </button>
                    )}
                    {isUte && isExpanded && (
                      <button
                        onClick={() => setExpandedNifs((prev) => {
                          const next = new Set(prev);
                          next.delete(rank);
                          return next;
                        })}
                        className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer align-middle"
                      >
                        Redueix
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {isUte && !isExpanded ? (
                        <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-[11px] font-mono text-gray-700">
                          {nifs[0]}
                        </span>
                      ) : (
                        nifs.map((nif) => (
                          <span
                            key={`${company.identificacio_adjudicatari}-${nif}`}
                            className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-[11px] font-mono text-gray-700"
                          >
                            {nif}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(currentYearAmount)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(totalAmount)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatNumber(numContracts)}
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
          const currentYearAmount = parseFloat(company.total_current_year || "0");
          const numContracts = parseInt(company.num_contracts, 10);
          const rank = (page - 1) * DEFAULT_PAGE_SIZE + idx + 1;
          const nifs = parseNifs(company.identificacio_adjudicatari);
          const names = company.denominacio_adjudicatari.split("||").map((n: string) => n.trim()).filter(Boolean);
          const isUte = nifs.length > 1 || names.length > 1;

          return (
            <article
              key={`m-${company.identificacio_adjudicatari}-${company.denominacio_adjudicatari}-${idx}`}
              className="rounded-lg border border-gray-200 bg-white p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/empreses/${encodeURIComponent(company.identificacio_adjudicatari)}`}
                    className="text-sm font-semibold text-gray-900 hover:underline break-words"
                  >
                    {names[0]}
                  </Link>
                  {isUte && (
                    <span className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 align-middle">
                      UTE · {names.length} empreses
                    </span>
                  )}
                </div>
                <span className="shrink-0 rounded bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
                  #{rank}
                </span>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                <span
                  key={`m-${company.identificacio_adjudicatari}-${nifs[0]}`}
                  className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-[11px] font-mono text-gray-700"
                >
                  {nifs[0]}
                </span>
                {nifs.length > 1 && (
                  <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                    +{nifs.length - 1}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500">
                    Import {new Date().getFullYear()} {hasCpvFilter ? "(CPV)" : ""}
                  </p>
                  <p className="font-medium text-gray-900">{formatCurrency(currentYearAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">
                    {hasCpvFilter ? "Import filtrat CPV" : "Import històric"}
                  </p>
                  <p className="font-medium text-gray-900">{formatCurrency(totalAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{hasCpvFilter ? "Contractes CPV" : "Contractes"}</p>
                  <p className="font-medium text-gray-900">{formatNumber(numContracts)}</p>
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
