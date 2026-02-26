"use client";

import { useState } from "react";
import Link from "next/link";
import type { CompanyAggregation } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { buildCompanyHref } from "@/lib/company-identity";

interface Props {
  rows: CompanyAggregation[];
  organTotalAmount: number;
}

function parseNifs(raw: string): string[] {
  if (!raw) return [];
  const normalized = raw.trim().toUpperCase();

  const byDelimiter = normalized
    .split(/[;,|/]+/)
    .flatMap((part) => part.trim().split(/\s+/))
    .map((part) => part.trim())
    .filter(Boolean);

  if (byDelimiter.length > 1) return Array.from(new Set(byDelimiter));

  const extracted = normalized.match(/[A-Z]\d{8}|\d{8}[A-Z]|[A-Z0-9]{9}/g) || [];
  if (extracted.length > 1) return Array.from(new Set(extracted));

  return [normalized];
}

export default function OrganTopCompaniesTable({ rows, organTotalAmount }: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 font-medium text-gray-500">Empresa</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">NIF</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500">Import</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500">Contractes</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500">% del total organisme</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((company, idx) => {
              const amount = parseFloat(company.total) || 0;
              const contracts = parseInt(company.num_contracts, 10) || 0;
              const share = organTotalAmount > 0 ? (amount / organTotalAmount) * 100 : 0;
              const rowKey = `${company.identificacio_adjudicatari}-${idx}`;
              const nifs = parseNifs(company.identificacio_adjudicatari);
              const names = company.denominacio_adjudicatari
                .split("||")
                .map((n) => n.trim())
                .filter(Boolean);
              const isUte = nifs.length > 1 || names.length > 1;
              const isExpanded = expandedRows.has(rowKey);
              const companyLabel =
                isUte && !isExpanded ? names[0] || company.denominacio_adjudicatari : company.denominacio_adjudicatari;

              return (
                <tr
                  key={rowKey}
                  className="border-b border-gray-100 last:border-b-0"
                >
                  <td className="py-3 px-4">
                    <Link
                      href={buildCompanyHref(company.identificacio_adjudicatari, companyLabel)}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {companyLabel}
                    </Link>
                    {isUte && !isExpanded && (
                      <button
                        onClick={() => setExpandedRows((prev) => new Set(prev).add(rowKey))}
                        className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer align-middle"
                        title={`UTE amb ${Math.max(names.length, nifs.length)} empreses — clic per expandir`}
                      >
                        UTE · +{Math.max(names.length, nifs.length) - 1}
                      </button>
                    )}
                    {isUte && isExpanded && (
                      <button
                        onClick={() =>
                          setExpandedRows((prev) => {
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
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {isUte && !isExpanded ? (
                        <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-[11px] font-mono text-gray-700">
                          {nifs[0]}
                        </span>
                      ) : (
                        nifs.map((nif) => (
                          <span
                            key={`${rowKey}-${nif}`}
                            className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-[11px] font-mono text-gray-700"
                          >
                            {nif}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">{formatCurrency(amount)}</td>
                  <td className="py-3 px-4 text-right">{formatNumber(contracts)}</td>
                  <td className="py-3 px-4 text-right text-gray-600">{share.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Import calculat sobre contractes amb import (amb IVA) informat.
      </p>
    </>
  );
}
