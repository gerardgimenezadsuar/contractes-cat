"use client";

import { useState } from "react";
import Link from "next/link";
import { formatNumber } from "@/lib/utils";

export interface ElectesRow {
  key: string;
  personName: string;
  carrec: string;
}

interface Props {
  rows: ElectesRow[];
  totalCurrentRoles: number;
  pageSize: number;
}

// Paginated in the browser so the organ page needs no searchParams and stays ISR-cached.
export default function OrganElectesCard({ rows, totalCurrentRoles, pageSize }: Props) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);

  const pagerButton = (target: number, label: string, enabled: boolean) =>
    enabled ? (
      <button
        type="button"
        onClick={() => setPage(target)}
        className="rounded border border-gray-300 px-2.5 py-1 hover:bg-gray-50"
      >
        {label}
      </button>
    ) : (
      <span className="rounded border border-gray-200 px-2.5 py-1 text-gray-400">{label}</span>
    );

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2.5 text-xs text-gray-700">
        <span className="font-medium">{formatNumber(totalCurrentRoles)}</span> càrrecs inferits. Font: Transparència
        Catalunya, darrer nomenament conegut per plaça.
      </div>
      <ul className="divide-y divide-gray-100">
        {visible.map((row) => (
          <li key={row.key} className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={`/persones?search=${encodeURIComponent(row.personName)}`}
              prefetch={false}
              className="text-sm font-medium text-gray-900 hover:underline"
            >
              {row.personName}
            </Link>
            <span className="inline-flex w-fit shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-700">
              {row.carrec}
            </span>
          </li>
        ))}
      </ul>
      {totalPages > 1 ? (
        <div className="flex flex-col gap-2 border-t border-gray-100 px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="text-gray-600">
            Pàgina {formatNumber(page)} de {formatNumber(totalPages)}
          </p>
          <div className="flex items-center gap-1.5">
            {pagerButton(page - 1, "Anterior", page > 1)}
            {pagerButton(page + 1, "Següent", page < totalPages)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
