"use client";

import type { ContractFilterValues } from "@/components/filters/ContractFilters";
import { formatDate } from "@/lib/utils";

const LABELS: Record<keyof ContractFilterValues, string> = {
  search: "Cerca",
  year: "Any",
  tipus_contracte: "Tipus",
  procediment: "Procediment",
  amountMin: "Import mín.",
  amountMax: "Import màx.",
  nom_organ: "Òrgan",
  dateFrom: "Des de",
  dateTo: "Fins a",
};

function formatValue(key: keyof ContractFilterValues, value: string): string {
  if (key === "dateFrom" || key === "dateTo") return formatDate(value);
  if (key === "amountMin" || key === "amountMax") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? `${n.toLocaleString("ca-ES")} €` : value;
  }
  return value;
}

interface Props {
  filters: ContractFilterValues;
  onRemove: (key: keyof ContractFilterValues) => void;
  onClear: () => void;
}

export default function ActiveFilterChips({ filters, onRemove, onClear }: Props) {
  const active = (Object.keys(LABELS) as Array<keyof ContractFilterValues>).filter(
    (key) => filters[key] !== ""
  );
  if (active.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Filtres actius">
      {active.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onRemove(key)}
          className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 pl-3 pr-2 text-xs text-indigo-800 hover:bg-indigo-100"
          aria-label={`Treu el filtre ${LABELS[key]}: ${formatValue(key, filters[key])}`}
        >
          <span className="truncate" aria-hidden="true">
            <span className="font-medium">{LABELS[key]}:</span> {formatValue(key, filters[key])}
          </span>
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ))}
      {active.length > 1 && (
        <button
          type="button"
          onClick={onClear}
          className="min-h-8 px-2 text-xs text-red-600 hover:underline"
        >
          Esborra-ho tot
        </button>
      )}
    </div>
  );
}
