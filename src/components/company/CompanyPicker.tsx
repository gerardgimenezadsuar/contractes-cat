"use client";

import { useEffect, useRef, useState } from "react";
import type { CompanyAggregation } from "@/lib/types";
import { isAmbiguousCompanyId } from "@/lib/company-identity";

export interface PickedCompany {
  nif: string;
  name: string;
}

interface Props {
  label: string;
  value: PickedCompany | null;
  onChange: (value: PickedCompany | null) => void;
  placeholder?: string;
}

/** Company autocomplete over /api/empreses that returns a NIF. */
export default function CompanyPicker({ label, value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyAggregation[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/empreses?search=${encodeURIComponent(q)}&page=1&includeTotal=0&includeCurrentYear=0`,
          { signal: controller.signal }
        );
        const json = await res.json();
        if (controller.signal.aborted) return;
        const rows = ((json.data || []) as CompanyAggregation[])
          .filter((r) => !isAmbiguousCompanyId(r.identificacio_adjudicatari))
          .slice(0, 8);
        setResults(rows);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
  };

  if (value) {
    return (
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
        <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2">
          <span className="min-w-0 truncate text-sm font-medium text-gray-900">
            {value.name} <span className="font-mono text-xs text-gray-500">{value.nif}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
            className="shrink-0 text-sm text-accent hover:underline"
          >
            Canvia
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Nom o NIF de l'empresa"}
          className="mt-1 block w-full min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </label>
      {open ? (
        <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {loading && results.length === 0 ? <li className="px-3 py-2 text-sm text-gray-500">Cercant…</li> : null}
          {!loading && results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">Cap empresa trobada.</li>
          ) : null}
          {results.map((r) => (
            <li key={r.identificacio_adjudicatari}>
              <button
                type="button"
                onClick={() => {
                  onChange({ nif: r.identificacio_adjudicatari, name: r.denominacio_adjudicatari });
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{r.denominacio_adjudicatari}</span>{" "}
                <span className="font-mono text-xs text-gray-500">{r.identificacio_adjudicatari}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
