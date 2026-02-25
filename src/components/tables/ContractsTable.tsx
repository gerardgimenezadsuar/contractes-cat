"use client";

import { useMemo, useState } from "react";
import type { Contract } from "@/lib/types";
import {
  formatCurrencyFull,
  formatDate,
  getPublicationUrl,
  getBestAvailableContractDate,
  isSuspiciousContractDate,
} from "@/lib/utils";

interface Props {
  contracts: Contract[];
  enableDateSort?: boolean;
  initialDateSort?: "asc" | "desc";
  enableAmountSort?: boolean;
  initialAmountSort?: "asc" | "desc";
  enableOrganFilter?: boolean;
}

function getBestDateTimestamp(contract: Contract): number {
  const bestDate = getBestAvailableContractDate(
    contract.data_adjudicacio_contracte,
    contract.data_formalitzacio_contracte,
    contract.data_publicacio_anunci
  );
  if (!bestDate.date) return 0;
  const timestamp = new Date(bestDate.date).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export default function ContractsTable({
  contracts,
  enableDateSort = false,
  initialDateSort = "desc",
  enableAmountSort = false,
  initialAmountSort = "desc",
  enableOrganFilter = false,
}: Props) {
  const [organFilter, setOrganFilter] = useState("");
  const [sortField, setSortField] = useState<"date" | "amount">(
    enableDateSort ? "date" : "amount"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    enableDateSort ? initialDateSort : initialAmountSort
  );
  const [expandedAwardees, setExpandedAwardees] = useState<Set<string>>(new Set());

  const splitAwardees = (raw?: string): string[] => {
    if (!raw) return [];
    const cleaned = raw.trim();
    if (!cleaned) return [];
    if (cleaned.includes("||")) {
      return cleaned
        .split("||")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (cleaned.includes(";")) {
      return cleaned
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [cleaned];
  };

  const visibleContracts = useMemo(() => {
    const q = organFilter.trim().toUpperCase();
    const filtered = q
      ? contracts.filter((c) => (c.nom_organ || "").toUpperCase().includes(q))
      : contracts;

    if (!(enableDateSort || enableAmountSort)) return filtered;

    return [...filtered].sort((a, b) => {
      if (sortField === "amount" && enableAmountSort) {
        const aAmount = parseFloat(a.import_adjudicacio_sense || "0");
        const bAmount = parseFloat(b.import_adjudicacio_sense || "0");
        return sortDir === "asc" ? aAmount - bAmount : bAmount - aAmount;
      }

      const aTs = getBestDateTimestamp(a);
      const bTs = getBestDateTimestamp(b);
      return sortDir === "asc" ? aTs - bTs : bTs - aTs;
    });
  }, [
    contracts,
    enableDateSort,
    enableAmountSort,
    organFilter,
    sortField,
    sortDir,
  ]);

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

  const showControls = enableOrganFilter || enableDateSort || enableAmountSort;

  return (
    <>
      {showControls && (
        <div className="border-b border-gray-100 px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {enableOrganFilter ? (
              <input
                type="text"
                value={organFilter}
                onChange={(e) => setOrganFilter(e.target.value)}
                placeholder="Filtrar per òrgan..."
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 sm:max-w-xs"
              />
            ) : (
              <div />
            )}

            {(enableDateSort || enableAmountSort) && (
              <div className="flex items-center gap-2">
                <label htmlFor="contracts-sort" className="text-xs text-gray-500">
                  Ordenar per
                </label>
                <select
                  id="contracts-sort"
                  value={`${sortField}-${sortDir}`}
                  onChange={(e) => {
                    const [field, dir] = e.target.value.split("-") as [
                      "date" | "amount",
                      "asc" | "desc",
                    ];
                    setSortField(field);
                    setSortDir(dir);
                  }}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700"
                >
                  {enableDateSort && <option value="date-desc">Data (més recents)</option>}
                  {enableDateSort && <option value="date-asc">Data (més antigues)</option>}
                  {enableAmountSort && <option value="amount-desc">Import (més alt)</option>}
                  {enableAmountSort && <option value="amount-asc">Import (més baix)</option>}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-[1040px] w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="w-[34%] xl:w-[28%] text-left py-3 px-4 font-medium text-gray-500">Denominació</th>
              <th className="hidden xl:table-cell xl:w-[10%] text-left py-3 px-4 font-medium text-gray-500">Procediment</th>
              <th className="w-[21%] xl:w-[17%] text-left py-3 px-4 font-medium text-gray-500">Adjudicatari</th>
              <th className="w-[11%] xl:w-[10%] text-right py-3 px-4 font-medium text-gray-500">Import (sense IVA)</th>
              <th className="w-[8%] xl:w-[7%] text-left py-3 px-4 font-medium text-gray-500">
                Data ref.
              </th>
              <th className="w-[26%] xl:w-[28%] text-left py-3 px-4 font-medium text-gray-500">Organisme</th>
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
                  className="border-b border-gray-100 table-row-hover"
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
