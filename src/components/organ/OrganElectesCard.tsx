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
  page: number;
  totalPages: number;
  buildPageHref: (page: number) => string;
}

export default function OrganElectesCard({ rows, totalCurrentRoles, page, totalPages, buildPageHref }: Props) {
  const pagerLink = (target: number, label: string, enabled: boolean) =>
    enabled ? (
      <Link href={buildPageHref(target)} scroll={false} className="rounded border border-gray-300 px-2.5 py-1 hover:bg-gray-50">
        {label}
      </Link>
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
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={`/persones?search=${encodeURIComponent(row.personName)}`}
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
            {pagerLink(page - 1, "Anterior", page > 1)}
            {pagerLink(page + 1, "Següent", page < totalPages)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
