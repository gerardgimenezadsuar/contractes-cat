import type { Metadata } from "next";
import Link from "next/link";
import { listTopCompanyGroups } from "@/lib/borme";
import { displayCompanyName } from "@/lib/company-names";
import { formatCompactEuros } from "@/lib/indicators";
import { formatNumber } from "@/lib/utils";

export const revalidate = 21600;

const PAGE_SIZE = 50;

export const metadata: Metadata = {
  title: "Grups empresarials",
  description:
    "Grups empresarials reconstruïts a partir del BORME (empreses i les seves filials) i els contractes públics que han guanyat a Catalunya.",
  alternates: { canonical: "/grups" },
};

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function GroupsPage({ searchParams }: Props) {
  const params = await searchParams;
  const parsed = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const offset = (page - 1) * PAGE_SIZE;
  // Fetch one extra row to know whether there is a next page.
  const rows = await listTopCompanyGroups(offset, PAGE_SIZE + 1);
  const groups = rows.slice(0, PAGE_SIZE);
  const hasNext = rows.length > PAGE_SIZE;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="font-display text-3xl font-semibold text-gray-900">Grups empresarials</h1>
      <p className="mt-2 max-w-3xl text-gray-600">
        Empreses agrupades per propietat segons el BORME (una empresa és la sòcia única d&apos;una altra), ordenades
        pel total de contractes públics que han guanyat les empreses del grup.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Grup</th>
              <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Empreses</th>
              <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Contractes</th>
              <th className="px-4 py-3 text-right font-medium">Import</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr key={g.groupId} className="border-b border-gray-100 last:border-b-0">
                <td className="px-4 py-3 text-gray-400">{offset + i + 1}</td>
                <td className="px-4 py-3">
                  <Link href={`/grups/${g.groupId}`} className="font-medium text-gray-900 hover:underline">
                    {displayCompanyName(g.rootName, false)}
                  </Link>
                  <p className="text-xs text-gray-500 sm:hidden">
                    {formatNumber(g.size)} empreses, {formatNumber(g.numContractors)} amb contractes
                  </p>
                </td>
                <td className="hidden px-4 py-3 text-right text-gray-700 sm:table-cell">
                  {formatNumber(g.size)}
                  <span className="text-xs text-gray-500"> ({formatNumber(g.numContractors)} amb contractes)</span>
                </td>
                <td className="hidden px-4 py-3 text-right md:table-cell">{formatNumber(g.numContracts)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCompactEuros(g.totalAmount)}</td>
              </tr>
            ))}
            {groups.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No hi ha grups disponibles.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Paginació">
        {page > 1 ? (
          <Link href={page === 2 ? "/grups" : `/grups?page=${page - 1}`} className="text-accent hover:underline">
            ← Anterior
          </Link>
        ) : (
          <span />
        )}
        {hasNext ? (
          <Link href={`/grups?page=${page + 1}`} className="text-accent hover:underline">
            Següent →
          </Link>
        ) : null}
      </nav>

      <p className="mt-6 max-w-3xl text-xs text-gray-500">
        El BORME només publica el soci de les societats unipersonals: els grups poden ser més grans del que es mostra.
        No s&apos;hi inclouen empreses que venen societats ja constituïdes ni proveïdors de serveis corporatius.
      </p>
    </div>
  );
}
