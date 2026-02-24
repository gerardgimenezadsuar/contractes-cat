"use client";

import { useMemo, useRef, useState } from "react";
import type { Contract } from "@/lib/types";
import type { SortState, SortColumn } from "@/lib/table-types";
import { getNextSortState } from "@/lib/table-types";
import { useColumnResize, type ColumnDef } from "@/hooks/useColumnResize";
import {
  formatCurrencyFull,
  formatDate,
  getPublicationUrl,
  getBestAvailableContractDate,
  isSuspiciousContractDate,
} from "@/lib/utils";

interface TableColumnDef {
  id: SortColumn;
  label: string;
  widthPct: number;
  xlWidthPct: number;
  hiddenBelowXl?: boolean;
  align?: "right";
}

const TABLE_COLUMNS: TableColumnDef[] = [
  { id: "denominacio", label: "Denominació", widthPct: 34, xlWidthPct: 28 },
  { id: "procediment", label: "Procediment", widthPct: 0, xlWidthPct: 10, hiddenBelowXl: true },
  { id: "adjudicatari", label: "Adjudicatari", widthPct: 21, xlWidthPct: 17 },
  { id: "amount", label: "Import (sense IVA)", widthPct: 11, xlWidthPct: 10, align: "right" },
  { id: "date", label: "Data ref.", widthPct: 8, xlWidthPct: 7 },
  { id: "organ", label: "Organisme", widthPct: 26, xlWidthPct: 28 },
];

const COLUMN_DEFS: ColumnDef[] = TABLE_COLUMNS.map((c) => ({
  id: c.id,
  initialWidthPct: c.xlWidthPct,
}));

interface Props {
  contracts: Contract[];
  sortState?: SortState;
  onSortChange?: (newSort: SortState) => void;
  enableOrganFilter?: boolean;
}

function splitAwardees(raw?: string): string[] {
  if (!raw) return [];
  const cleaned = raw.trim();
  if (!cleaned) return [];
  if (cleaned.includes("||")) {
    return cleaned.split("||").map((s) => s.trim()).filter(Boolean);
  }
  if (cleaned.includes(";")) {
    return cleaned.split(";").map((s) => s.trim()).filter(Boolean);
  }
  return [cleaned];
}

export default function ContractsTable({
  contracts,
  sortState,
  onSortChange,
  enableOrganFilter = false,
}: Props) {
  const [organFilter, setOrganFilter] = useState("");
  const [expandedAwardees, setExpandedAwardees] = useState<Set<string>>(new Set());
  const tableRef = useRef<HTMLTableElement>(null);
  const { widths, startResize, isResizing } = useColumnResize(COLUMN_DEFS, tableRef);
  const hasWidths = Object.keys(widths).length > 0;

  const visibleContracts = useMemo(() => {
    const q = organFilter.trim().toUpperCase();
    return q
      ? contracts.filter((c) => (c.nom_organ || "").toUpperCase().includes(q))
      : contracts;
  }, [contracts, organFilter]);

  const keyedVisibleContracts = useMemo(() => {
    const seen = new Map<string, number>();
    return visibleContracts.map((contract) => {
      const baseKey = [
        contract.codi_expedient || "",
        contract.nom_organ || "",
        contract.denominacio_adjudicatari || "",
        contract.numero_lot || "",
        contract.data_adjudicacio_contracte || "",
      ].join("|");
      const occurrence = seen.get(baseKey) ?? 0;
      seen.set(baseKey, occurrence + 1);
      const rowKey = occurrence === 0 ? baseKey : `${baseKey}__dup-${occurrence}`;
      return { contract, rowKey };
    });
  }, [visibleContracts]);

  const handleHeaderClick = (column: SortColumn) => {
    if (!onSortChange) return;
    const next = getNextSortState(
      sortState || { column: "date", dir: "desc" },
      column
    );
    onSortChange(next);
  };

  return (
    <>
      {enableOrganFilter && (
        <div className="border-b border-gray-100 px-3 py-3 sm:px-4">
          <input
            type="text"
            value={organFilter}
            onChange={(e) => setOrganFilter(e.target.value)}
            placeholder="Filtrar per òrgan..."
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 sm:max-w-xs"
          />
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table
          ref={tableRef}
          className={`min-w-[1040px] w-full table-fixed text-sm ${isResizing ? "select-none" : ""}`}
        >
          {hasWidths && (
            <colgroup>
              {TABLE_COLUMNS.map((col) => (
                <col
                  key={col.id}
                  style={{ width: `${widths[col.id]}px` }}
                  className={col.hiddenBelowXl ? "hidden xl:table-column" : undefined}
                />
              ))}
            </colgroup>
          )}
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {TABLE_COLUMNS.map((col, i) => {
                const isActive = sortState?.column === col.id;
                const isSortable = !!onSortChange;
                const isLast = i === TABLE_COLUMNS.length - 1;
                return (
                  <th
                    key={col.id}
                    className={`
                      ${col.align === "right" ? "text-right" : "text-left"}
                      py-3 px-4 font-medium text-gray-500 relative
                      ${col.hiddenBelowXl ? "hidden xl:table-cell" : ""}
                      ${isSortable ? "cursor-pointer hover:text-gray-700 hover:bg-gray-100/50 select-none transition-colors" : ""}
                    `}
                    style={!hasWidths ? { width: `${col.xlWidthPct}%` } : undefined}
                    onClick={isSortable ? () => handleHeaderClick(col.id) : undefined}
                    aria-sort={isActive ? (sortState?.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    <span className={`inline-flex items-center gap-1 ${col.align === "right" ? "justify-end w-full" : ""}`}>
                      {col.label}
                      {isSortable && (
                        <span className={`inline-flex flex-col leading-none ${isActive ? "text-gray-700" : "text-gray-300"}`}>
                          <svg width="8" height="5" viewBox="0 0 8 5" className={`${isActive && sortState?.dir === "asc" ? "text-gray-700" : ""}`}>
                            <path d="M4 0L8 5H0L4 0Z" fill="currentColor" />
                          </svg>
                          <svg width="8" height="5" viewBox="0 0 8 5" className={`mt-px ${isActive && sortState?.dir === "desc" ? "text-gray-700" : ""}`}>
                            <path d="M4 5L0 0H8L4 5Z" fill="currentColor" />
                          </svg>
                        </span>
                      )}
                    </span>
                    {/* Resize handle */}
                    {!isLast && (
                      <div
                        onMouseDown={(e) => startResize(i, e)}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute -right-px top-0 bottom-0 w-[3px] cursor-col-resize z-10 border-r border-gray-300 hover:border-blue-500 active:border-blue-500"
                        role="separator"
                        aria-label={`Redimensiona columna ${col.label}`}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {keyedVisibleContracts.map(({ contract: c, rowKey }) => {
              const awardees = splitAwardees(c.denominacio_adjudicatari);
              const hasMultipleAwardees = awardees.length > 1;
              const isAwardeesExpanded = expandedAwardees.has(rowKey);
              const displayAwardee =
                hasMultipleAwardees && !isAwardeesExpanded
                  ? awardees[0]
                  : c.denominacio_adjudicatari || "—";
              const publicationUrl = getPublicationUrl(c.enllac_publicacio);
              const bestDate = getBestAvailableContractDate(
                c.data_adjudicacio_contracte,
                c.data_formalitzacio_contracte,
                c.data_publicacio_anunci
              );
              const suspiciousDate = isSuspiciousContractDate(bestDate.date);
              return (
                <tr
                  key={rowKey}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4 truncate" title={c.denominacio}>
                    {publicationUrl ? (
                      <a
                        href={publicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-900 hover:underline"
                      >
                        {c.denominacio || "—"}
                      </a>
                    ) : (
                      c.denominacio || "—"
                    )}
                  </td>
                  <td className="hidden xl:table-cell py-3 px-4 truncate" title={c.procediment}>
                    {c.procediment || "—"}
                  </td>
                  <td className="py-3 px-4 truncate" title={c.denominacio_adjudicatari}>
                    <span className="align-middle">{displayAwardee}</span>
                    {hasMultipleAwardees && !isAwardeesExpanded && (
                      <button
                        onClick={() =>
                          setExpandedAwardees((prev) => new Set(prev).add(rowKey))
                        }
                        className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer align-middle"
                        title={`UTE amb ${awardees.length} empreses — clic per expandir`}
                      >
                        UTE · +{awardees.length - 1}
                      </button>
                    )}
                    {hasMultipleAwardees && isAwardeesExpanded && (
                      <button
                        onClick={() =>
                          setExpandedAwardees((prev) => {
                            const next = new Set(prev);
                            next.delete(rowKey);
                            return next;
                          })
                        }
                        className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer align-middle"
                      >
                        Redueix
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-xs">
                    {c.import_adjudicacio_sense
                      ? formatCurrencyFull(c.import_adjudicacio_sense)
                      : "—"}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div className="whitespace-nowrap">
                      {formatDate(bestDate.date)}
                    </div>
                    {suspiciousDate && (
                      <div
                        className="mt-0.5 text-[11px] text-amber-700"
                        title="Data atípica detectada al dataset"
                      >
                        atípica
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 align-top whitespace-normal break-words" title={c.nom_organ}>
                    {c.nom_organ || "—"}
                  </td>
                </tr>
              );
            })}
            {visibleContracts.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No s&apos;han trobat contractes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="lg:hidden space-y-2 p-2">
        {keyedVisibleContracts.map(({ contract: c, rowKey }) => {
          const awardees = splitAwardees(c.denominacio_adjudicatari);
          const hasMultipleAwardees = awardees.length > 1;
          const isAwardeesExpanded = expandedAwardees.has(rowKey);
          const displayAwardee =
            hasMultipleAwardees && !isAwardeesExpanded
              ? awardees[0]
              : c.denominacio_adjudicatari || "—";
          const publicationUrl = getPublicationUrl(c.enllac_publicacio);
          const bestDate = getBestAvailableContractDate(
            c.data_adjudicacio_contracte,
            c.data_formalitzacio_contracte,
            c.data_publicacio_anunci
          );
          const suspiciousDate = isSuspiciousContractDate(bestDate.date);
          return (
            <article
              key={`m-${rowKey}`}
              className="rounded-lg border border-gray-200 bg-white p-3"
            >
              {publicationUrl ? (
                <a
                  href={publicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-gray-900 line-clamp-2 hover:underline"
                >
                  {c.denominacio || "Sense denominació"}
                </a>
              ) : (
                <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                  {c.denominacio || "Sense denominació"}
                </p>
              )}

              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500">
                <span className="truncate">{c.tipus_contracte || "—"}</span>
                <span className={`shrink-0 ${suspiciousDate ? "text-amber-700 font-medium" : ""}`}>
                  {formatDate(bestDate.date)}
                </span>
              </div>

              <p className="mt-2 text-xs text-gray-700 line-clamp-2">
                <span className="text-gray-500">Adjudicatari: </span>
                {displayAwardee}
                {hasMultipleAwardees && !isAwardeesExpanded && (
                  <button
                    onClick={() =>
                      setExpandedAwardees((prev) => new Set(prev).add(rowKey))
                    }
                    className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer align-middle"
                  >
                    UTE · +{awardees.length - 1}
                  </button>
                )}
                {hasMultipleAwardees && isAwardeesExpanded && (
                  <button
                    onClick={() =>
                      setExpandedAwardees((prev) => {
                        const next = new Set(prev);
                        next.delete(rowKey);
                        return next;
                      })
                    }
                    className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer align-middle"
                  >
                    Redueix
                  </button>
                )}
              </p>
              <p className="mt-1 text-xs text-gray-700">
                <span className="text-gray-500">Òrgan: </span>
                {c.nom_organ || "—"}
              </p>

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-500">Import (sense IVA)</p>
                  <p className="text-sm font-mono text-gray-900">
                    {c.import_adjudicacio_sense
                      ? formatCurrencyFull(c.import_adjudicacio_sense)
                      : "—"}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
        {visibleContracts.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-500">
            No s&apos;han trobat contractes.
          </div>
        )}
      </div>
    </>
  );
}
