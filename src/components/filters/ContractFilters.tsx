"use client";

import { CONTRACT_TYPES, PROCEDURE_TYPES } from "@/config/constants";
import SearchLoadingIndicator from "@/components/ui/SearchLoadingIndicator";

export interface ContractFilterValues {
  year: string;
  tipus_contracte: string;
  procediment: string;
  amountMin: string;
  amountMax: string;
  nom_organ: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_CONTRACT_FILTERS: ContractFilterValues = {
  year: "",
  tipus_contracte: "",
  procediment: "",
  amountMin: "",
  amountMax: "",
  nom_organ: "",
  search: "",
  dateFrom: "",
  dateTo: "",
};

interface Props {
  filters: ContractFilterValues;
  onChange: (key: keyof ContractFilterValues, value: string) => void;
  onReset: () => void;
  loading?: boolean;
  /** Rendered inside the mobile sheet: no card chrome, no duplicate title. */
  embedded?: boolean;
}

const YEARS = Array.from({ length: 12 }, (_, i) => String(2015 + i));

const INPUT_CLASS =
  "w-full min-h-11 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";
const LABEL_CLASS = "block text-xs font-medium text-gray-500 mb-1";

export default function ContractFilters({
  filters,
  onChange,
  onReset,
  loading = false,
  embedded = false,
}: Props) {
  const hasFilters = Object.values(filters).some((v) => v !== "");
  // The desktop sidebar and the mobile sheet can both be mounted: keep ids unique.
  const fieldId = (name: string) => (embedded ? `sheet-${name}` : name);

  return (
    <div className={embedded ? "space-y-4" : "bg-white rounded-lg border border-gray-100 shadow-sm p-4 space-y-4"}>
      <div className="flex items-center justify-between">
        {embedded ? <span /> : <h3 className="font-semibold text-gray-900">Filtres</h3>}
        {hasFilters && (
          <button
            onClick={onReset}
            className="min-h-8 text-xs text-red-600 hover:underline"
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
        <label htmlFor={fieldId("contract-filter-search")} className={LABEL_CLASS}>
          Cerca per contracte, empresa o NIF
        </label>
        <div className="relative">
          <input
            id={fieldId("contract-filter-search")}
            type="search"
            value={filters.search}
            onChange={(e) => onChange("search", e.target.value)}
            placeholder="Ex.: COMSA, B-12345678, manteniment..."
            aria-busy={loading}
            enterKeyHint="search"
            className={`${INPUT_CLASS} ${loading ? "pr-10" : ""}`}
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          )}
        </div>
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={fieldId("contract-filter-date-from")} className={LABEL_CLASS}>
            Des de
          </label>
          <input
            id={fieldId("contract-filter-date-from")}
            type="date"
            value={filters.dateFrom}
            max={filters.dateTo || undefined}
            onChange={(e) => onChange("dateFrom", e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor={fieldId("contract-filter-date-to")} className={LABEL_CLASS}>
            Fins a
          </label>
          <input
            id={fieldId("contract-filter-date-to")}
            type="date"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            onChange={(e) => onChange("dateTo", e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {/* Year */}
      <div>
        <label htmlFor={fieldId("contract-filter-year")} className={LABEL_CLASS}>
          Any d&apos;adjudicació
        </label>
        <select
          id={fieldId("contract-filter-year")}
          value={filters.year}
          onChange={(e) => onChange("year", e.target.value)}
          className={INPUT_CLASS}
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
        <label htmlFor={fieldId("contract-filter-type")} className={LABEL_CLASS}>
          Tipus de contracte
        </label>
        <select
          id={fieldId("contract-filter-type")}
          value={filters.tipus_contracte}
          onChange={(e) => onChange("tipus_contracte", e.target.value)}
          className={INPUT_CLASS}
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
        <label htmlFor={fieldId("contract-filter-procedure")} className={LABEL_CLASS}>
          Procediment
        </label>
        <select
          id={fieldId("contract-filter-procedure")}
          value={filters.procediment}
          onChange={(e) => onChange("procediment", e.target.value)}
          className={INPUT_CLASS}
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
          <label htmlFor={fieldId("contract-filter-amount-min")} className={LABEL_CLASS}>
            Import mínim (EUR)
          </label>
          <input
            id={fieldId("contract-filter-amount-min")}
            type="number"
            inputMode="decimal"
            value={filters.amountMin}
            onChange={(e) => onChange("amountMin", e.target.value)}
            placeholder="0"
            min="0"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor={fieldId("contract-filter-amount-max")} className={LABEL_CLASS}>
            Import màxim (EUR)
          </label>
          <input
            id={fieldId("contract-filter-amount-max")}
            type="number"
            inputMode="decimal"
            value={filters.amountMax}
            onChange={(e) => onChange("amountMax", e.target.value)}
            placeholder="Sense límit"
            min="0"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {/* Organ */}
      <div>
        <label htmlFor={fieldId("contract-filter-organ")} className={LABEL_CLASS}>
          Òrgan de contractació
        </label>
        <div className="relative">
          <input
            id={fieldId("contract-filter-organ")}
            type="search"
            value={filters.nom_organ}
            onChange={(e) => onChange("nom_organ", e.target.value)}
            placeholder="Cerca per nom..."
            aria-busy={loading}
            className={`${INPUT_CLASS} ${loading ? "pr-10" : ""}`}
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          )}
        </div>
      </div>
    </div>
  );
}
