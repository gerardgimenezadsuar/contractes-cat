"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import type { CompanyAggregation } from "@/lib/types";
import { formatCompactNumber, formatNumber } from "@/lib/utils";

export default function CompanySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyAggregation[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/empreses?search=${encodeURIComponent(q)}&page=1`
      );
      const json = await res.json();
      setResults(json.data.slice(0, 8));
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(val), 300);
    },
    [search]
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Cerca una empresa per nom o NIF..."
          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent focus:shadow-md transition-shadow bg-white"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-900 rounded-full" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {results.map((company, i) => (
            <Link
              key={`${company.identificacio_adjudicatari}-${i}`}
              href={`/empreses/${encodeURIComponent(company.identificacio_adjudicatari)}`}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {company.denominacio_adjudicatari}
                </p>
                <p className="text-xs text-gray-500 font-mono">
                  {company.identificacio_adjudicatari}
                </p>
              </div>
              <div className="ml-4 text-right shrink-0">
                <p className="text-sm font-medium text-gray-900">
                  {formatCompactNumber(company.total)}
                </p>
                <p className="text-xs text-gray-500">
                  {formatNumber(company.num_contracts)} contractes
                </p>
              </div>
            </Link>
          ))}
          <Link
            href={`/empreses?search=${encodeURIComponent(query)}`}
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-center text-sm text-gray-600 hover:bg-gray-50 bg-gray-50"
          >
            Veure tots els resultats
          </Link>
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-sm text-gray-500 text-center">
          No s&apos;han trobat empreses.
        </div>
      )}
    </div>
  );
}
