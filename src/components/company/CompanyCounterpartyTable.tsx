"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

interface CounterpartyRow {
  nom_organ: string;
  total: string;
  num_contracts: string;
}

interface Props {
  rows: CounterpartyRow[];
  companyTotalAmount: number;
  lastAwardDate?: string;
}

export default function CompanyCounterpartyTable({
  rows,
  companyTotalAmount,
  lastAwardDate,
}: Props) {
  const [organSearch, setOrganSearch] = useState("");

  const visibleRows = useMemo(() => {
    const q = organSearch.trim().toUpperCase();
    if (!q) return rows;
    return rows.filter((r) => r.nom_organ.toUpperCase().includes(q));
  }, [rows, organSearch]);

  return (
    <section className="mb-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900">
          Principals òrgans contractants (a aquesta empresa)
        </h2>
        <div className="text-xs text-gray-500">
          Darrera data ref.:{" "}
          <span className="font-medium text-gray-700">{formatDate(lastAwardDate)}</span>
        </div>
      </div>

      <div className="mb-3 max-w-md">
        <input
          type="text"
          value={organSearch}
          onChange={(e) => setOrganSearch(e.target.value)}
          placeholder="Filtra per òrgan..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 font-medium text-gray-500">Òrgan</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500">Import</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500">Contractes</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500">% del total empresa</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((organ) => {
              const organTotal = parseFloat(organ.total) || 0;
              const organContracts = parseInt(organ.num_contracts, 10) || 0;
              const share = companyTotalAmount > 0 ? (organTotal / companyTotalAmount) * 100 : 0;
              return (
                <tr
                  key={organ.nom_organ}
                  className="border-b border-gray-100 last:border-b-0"
                >
                  <td className="py-3 px-4">
                    <Link
                      href={`/organismes/${encodeURIComponent(organ.nom_organ)}`}
                      className="hover:underline text-gray-900"
                    >
                      {organ.nom_organ}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(organTotal)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatNumber(organContracts)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {share.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-500">
                  No hi ha òrgans que coincideixin amb el filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Import calculat sobre contractes amb import (amb IVA) informat.
      </p>
    </section>
  );
}
