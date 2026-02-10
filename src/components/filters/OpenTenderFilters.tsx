"use client";

import { CONTRACT_TYPES, PROCEDURE_TYPES } from "@/config/constants";
import SearchLoadingIndicator from "@/components/ui/SearchLoadingIndicator";

interface OpenTenderFilterState {
  tipus_contracte: string;
  procediment: string;
  amountMin: string;
  amountMax: string;
  nom_organ: string;
  search: string;
  cpvSearch: string;
}

interface Props {
  filters: OpenTenderFilterState;
  onChange: (key: keyof OpenTenderFilterState, value: string) => void;
  onReset: () => void;
  loading?: boolean;
}

export default function OpenTenderFilters({
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
        <SearchLoadingIndicator text="Buscant licitacions obertes..." />
      )}

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Cerca general
        </label>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange("search", e.target.value)}
          placeholder="Ex.: manteniment, neteja, software..."
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Sector (CPV en text)
        </label>
        <input
          type="text"
          value={filters.cpvSearch}
          onChange={(e) => onChange("cpvSearch", e.target.value)}
          placeholder="Ex.: informàtics, construcció, sanitaris..."
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Òrgan de contractació
        </label>
        <input
          type="text"
          value={filters.nom_organ}
          onChange={(e) => onChange("nom_organ", e.target.value)}
          placeholder="Ex.: Ajuntament de..."
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

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

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Pressupost mínim
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
            Pressupost màxim
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
    </div>
  );
}
