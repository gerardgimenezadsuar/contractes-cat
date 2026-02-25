"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TopVinculacioRow } from "@/lib/persones-top";

interface Props {
  rows: TopVinculacioRow[];
}

const PAGE_SIZE = 25;
type SortField = "import" | "operacions" | "empreses";
type SortDirection = "asc" | "desc";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ca-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatInt(value: number): string {
  return new Intl.NumberFormat("ca-ES").format(value);
}

function sortIndicator(
  activeField: SortField,
  field: SortField,
  direction: SortDirection
): string {
  if (activeField !== field) return "↕";
  return direction === "desc" ? "↓" : "↑";
}

function detectPersonKind(name: string): "Física" | "Jurídica" {
  const normalized = name.toUpperCase().replace(/\s+/g, " ").trim();
  const legalPattern =
    /\b(SA|S\.A\.|SL|S\.L\.|SLU|S\.L\.U\.|SCP|SLP|SAS|SCCL|COOPERATIVA|FUNDACIO|FUNDACIÓN|ASOCIACION|ASSOCIACIO|SOCIEDAD|LTD|LIMITED|INC|LLC|GMBH|BV|CORP|CORPORATION|UTE|AIE)\b/;
  return legalPattern.test(normalized) ? "Jurídica" : "Física";
}

export default function PersonesTopVinculacioTable({ rows }: Props) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<"all" | "Administrador" | "Òrgan de govern">("all");
  const [sortField, setSortField] = useState<SortField>("import");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const applySort = (field: SortField) => {
    setPage(1);
    if (sortField === field) {
      setSortDirection((d) => (d === "desc" ? "asc" : "desc"));
      return;
    }
    setSortField(field);
    setSortDirection("desc");
  };

  const processedRows = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const matchesSearch =
        searchTerm.length === 0 || row.personName.toLowerCase().includes(searchTerm);
      const matchesPosition =
        positionFilter === "all" || row.mainPosition === positionFilter;
      return matchesSearch && matchesPosition;
    });

    const sorted = [...filtered].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      if (sortField === "import") {
        return (a.totalAmountActivePeriod - b.totalAmountActivePeriod) * direction;
      }
      if (sortField === "operacions") {
        return (a.totalContractsActivePeriod - b.totalContractsActivePeriod) * direction;
      }
      return (a.activeCompaniesWithOps - b.activeCompaniesWithOps) * direction;
    });
    return sorted;
  }, [positionFilter, rows, search, sortDirection, sortField]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return processedRows.slice(start, start + PAGE_SIZE);
  }, [processedRows, safePage]);

  if (rows.length === 0) {
    return (
      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Top persones amb vinculació
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          No hi ha dades disponibles del rànquing en aquest moment.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-gray-900">
        Top persones amb vinculació: administradors o formant part de l&apos;òrgan de govern (segons BORME)
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Rànquing ordenat per import d&apos;operacions vinculades durant períodes actius.
      </p>
      <div className="mt-4 flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cerca persona dins del top 250..."
            className="min-w-[220px] flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-gray-500 focus:outline-none"
          />
          <select
            value={positionFilter}
            onChange={(e) => {
              setPositionFilter(
                e.target.value as "all" | "Administrador" | "Òrgan de govern"
              );
              setPage(1);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-gray-500 focus:outline-none"
          >
            <option value="all">Totes les posicions</option>
            <option value="Administrador">Administrador</option>
            <option value="Òrgan de govern">Òrgan de govern</option>
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="border-b border-gray-200 px-2 py-2 font-medium">#</th>
              <th className="border-b border-gray-200 px-2 py-2 font-medium">Persona (física o jurídica)</th>
              <th className="border-b border-gray-200 px-2 py-2 font-medium">
                <button
                  type="button"
                  onClick={() => applySort("import")}
                  className="inline-flex items-center gap-1 text-left hover:text-gray-800"
                >
                  Import <span>{sortIndicator(sortField, "import", sortDirection)}</span>
                </button>
              </th>
              <th className="border-b border-gray-200 px-2 py-2 font-medium">
                <button
                  type="button"
                  onClick={() => applySort("operacions")}
                  className="inline-flex items-center gap-1 text-left hover:text-gray-800"
                >
                  Operacions <span>{sortIndicator(sortField, "operacions", sortDirection)}</span>
                </button>
              </th>
              <th className="border-b border-gray-200 px-2 py-2 font-medium">
                <button
                  type="button"
                  onClick={() => applySort("empreses")}
                  className="inline-flex items-center gap-1 text-left hover:text-gray-800"
                >
                  Empreses <span>{sortIndicator(sortField, "empreses", sortDirection)}</span>
                </button>
              </th>
              <th className="border-b border-gray-200 px-2 py-2 font-medium">Posició principal</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, idx) => {
              const visibleCompanies = row.companiesSample.slice(0, 3);
              const remaining = Math.max(0, row.companiesSample.length - visibleCompanies.length);
              const personKind = detectPersonKind(row.personName);
              const absoluteRank = (safePage - 1) * PAGE_SIZE + idx + 1;

              return (
                <tr key={`${row.rank}-${row.personName}`} className="align-top">
                  <td className="border-b border-gray-100 px-2 py-3 text-sm text-gray-700">
                    {absoluteRank}
                  </td>
                  <td className="border-b border-gray-100 px-2 py-3">
                    <Link
                      href={`/persones/${encodeURIComponent(row.personName)}`}
                      className="text-sm font-medium text-gray-900 transition-colors hover:text-indigo-700 hover:underline"
                    >
                      {row.personName}
                    </Link>
                    <span className="ml-2 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
                      {personKind}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {visibleCompanies.map((company) => (
                        <span
                          key={company}
                          className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
                        >
                          {company}
                        </span>
                      ))}
                      {remaining > 0 && (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                          +{remaining} més
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="border-b border-gray-100 px-2 py-3 text-sm text-gray-900">
                    {formatCurrency(row.totalAmountActivePeriod)}
                  </td>
                  <td className="border-b border-gray-100 px-2 py-3 text-sm text-gray-700">
                    {formatInt(row.totalContractsActivePeriod)}
                  </td>
                  <td className="border-b border-gray-100 px-2 py-3 text-sm text-gray-700">
                    {formatInt(row.activeCompaniesWithOps)}
                  </td>
                  <td className="border-b border-gray-100 px-2 py-3 text-sm text-gray-700">
                    {row.mainPosition}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {processedRows.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-500">
          No hi ha resultats amb aquests filtres.
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Mostrant {Math.min((safePage - 1) * PAGE_SIZE + 1, processedRows.length)}-
          {Math.min(safePage * PAGE_SIZE, processedRows.length)} de {processedRows.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1 || processedRows.length === 0}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages || processedRows.length === 0}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Següent
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Aquest apartat mostra únicament el top 250 del rànquing.
      </p>
      <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
        <p className="text-xs font-medium text-gray-700">Metodologia</p>
        <p className="mt-1 text-xs text-gray-600">
          El rànquing mostra les 250 persones amb més operacions vinculades, comptant només els períodes
          en què constaven amb càrrec actiu com a administrador o com a membre de l&apos;òrgan de govern.
          Per a cada operació, s&apos;atribueix l&apos;import únicament si la data d&apos;adjudicació cau dins
          del tram actiu del càrrec; després s&apos;agrega per persona i s&apos;ordena per import total.
        </p>
      </div>
    </section>
  );
}
