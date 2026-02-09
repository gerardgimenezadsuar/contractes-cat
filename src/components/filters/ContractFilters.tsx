"use client";

import { CONTRACT_TYPES, PROCEDURE_TYPES } from "@/config/constants";
import SearchLoadingIndicator from "@/components/ui/SearchLoadingIndicator";

interface Props {
  filters: {
    year: string;
    tipus_contracte: string;
    procediment: string;
    amountMin: string;
    amountMax: string;
    nom_organ: string;
    search: string;
  };
  onChange: (key: string, value: string) => void;
  onReset: () => void;
  loading?: boolean;
}

const YEARS = Array.from({ length: 12 }, (_, i) => String(2015 + i));

export default function ContractFilters({
  filters,
  onChange,
  onReset,
  loading = false,
}: Props) {
  const hasFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Filtres</h3>
        {hasFilters && (
          <button
            onClick={onReset}
            className="text-xs text-red-600 hover:underline"
          >
            Esborra filtres
          </button>
        )}
      </div>
      {loading && (
        <SearchLoadingIndicator text="Filtrant tots els registres..." />
      )}

      {/* Search */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Cerca per contracte, empresa o NIF
        </label>
        <div className="relative">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange("search", e.target.value)}
            placeholder="Ex.: COMSA, B-12345678, manteniment..."
            aria-busy={loading}
            className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 ${
              loading ? "pr-10" : ""
            }`}
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          )}
        </div>
      </div>

      {/* Year */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Any
        </label>
        <select
          value={filters.year}
          onChange={(e) => onChange("year", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">Tots els anys</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          )).reverse()}
        </select>
      </div>

      {/* Contract type */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Tipus de contracte
        </label>
        <select
          value={filters.tipus_contracte}
          onChange={(e) => onChange("tipus_contracte", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">Tots els tipus</option>
          {CONTRACT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Procedure */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Procediment
        </label>
        <select
          value={filters.procediment}
          onChange={(e) => onChange("procediment", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">Tots els procediments</option>
          {PROCEDURE_TYPES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Amount range */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Import mínim (EUR)
          </label>
          <input
            type="number"
            value={filters.amountMin}
            onChange={(e) => onChange("amountMin", e.target.value)}
            placeholder="0"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Import màxim (EUR)
          </label>
          <input
            type="number"
            value={filters.amountMax}
            onChange={(e) => onChange("amountMax", e.target.value)}
            placeholder="Sense límit"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </div>

      {/* Organ */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Òrgan de contractació
        </label>
        <div className="relative">
          <input
            type="text"
            value={filters.nom_organ}
            onChange={(e) => onChange("nom_organ", e.target.value)}
            placeholder="Cerca per nom..."
            aria-busy={loading}
            className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 ${
              loading ? "pr-10" : ""
            }`}
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          )}
        </div>
      </div>
    </div>
  );
}
