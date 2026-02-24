import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import {
  fetchOrganDetail,
  fetchOrganRecentContracts,
  fetchOrganTopCompanies,
} from "@/lib/api";
import {
  formatCurrency,
  formatNumber,
  formatCompactNumber,
  getBestAvailableContractDate,
  getPublicationUrl,
  formatDate,
} from "@/lib/utils";
import { safeJsonLd } from "@/lib/seo/jsonld";
import {
  buildEntityBreadcrumbJsonLd,
  buildEntityJsonLdGraph,
  buildEntityMetadata,
  buildEntityPrimaryJsonLd,
} from "@/lib/seo/entity-seo";
import StatCard from "@/components/ui/StatCard";
import { YearlyTrendChartLazy } from "@/components/charts/LazyCharts";
import SharePageButton from "@/components/ui/SharePageButton";
import OrganContractsExplorer from "@/components/organ/OrganContractsExplorer";
import OrganTopCompaniesTable from "@/components/organ/OrganTopCompaniesTable";

export const revalidate = 21600;

interface Props {
  params: Promise<{ id: string }>;
}

const getOrganDetail = cache(async (id: string) => fetchOrganDetail(id));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const { organ } = await getOrganDetail(decodedId);
  const organName = organ?.nom_organ || decodedId;
  const canonicalOrganId = organ?.nom_organ || decodedId;
  const totalAmount = parseFloat(organ?.total || "0");
  const totalContracts = parseInt(organ?.num_contracts || "0", 10);
  const description = organ
    ? `${formatCompactNumber(totalAmount)} adjudicats en ${formatNumber(totalContracts)} contractes públics per ${organName}.`
    : `Detall dels contractes públics de ${organName}.`;

  const entityPath = `/organismes/${encodeURIComponent(canonicalOrganId)}`;
  const ogTitle = `${organName} — Contractes públics | contractes.cat`;
  const ogDescription = organ
    ? `Consulta els ${formatNumber(totalContracts)} contractes públics de ${organName} per ${formatCompactNumber(totalAmount)}. Dades obertes de contractació pública a Catalunya.`
    : `Consulta els contractes públics de ${organName}. Dades obertes de contractació pública a Catalunya.`;

  return buildEntityMetadata({
    title: organName,
    description,
    ogTitle,
    ogDescription,
    path: entityPath,
    imagePath: `${entityPath}/opengraph-image`,
    imageAlt: `Resum de contractació pública de ${organName}`,
    keywords: [
      organName,
      `${organName} contractes`,
      "organisme contractant",
      "contractació pública Catalunya",
    ],
    openGraphType: "article",
  });
}

export default async function OrganDetailPage({ params }: Props) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  const [{ organ, yearly }, recentContracts, topCompanies] = await Promise.all([
    getOrganDetail(decodedId),
    fetchOrganRecentContracts(decodedId, 10),
    fetchOrganTopCompanies(decodedId, 10),
  ]);

  if (!organ) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-500">No s&apos;ha trobat l&apos;organisme.</p>
        <Link href="/organismes" className="text-blue-600 hover:underline mt-4 inline-block">
          Tornar a organismes
        </Link>
      </div>
    );
  }

  const totalAmount = parseFloat(organ.total);
  const numContracts = parseInt(organ.num_contracts, 10);
  const currentYear = new Date().getFullYear();
  const currentYearRow = yearly.find((row) => parseInt(row.year, 10) === currentYear);
  const currentYearContracts = currentYearRow ? parseInt(currentYearRow.num_contracts, 10) || 0 : 0;
  const currentYearAmount = currentYearRow ? parseFloat(currentYearRow.total) || 0 : 0;
  const currentYearContractsSubtitle = currentYearRow
    ? `Total històric: ${formatNumber(numContracts)}`
    : `Sense dades ${currentYear}. Total històric: ${formatNumber(numContracts)}`;
  const currentYearAmountSubtitle = currentYearRow
    ? `Total històric: ${formatCompactNumber(totalAmount)}`
    : `Sense dades ${currentYear}. Total històric: ${formatCompactNumber(totalAmount)}`;

  const lastAwardDate = getBestAvailableContractDate(
    recentContracts[0]?.data_adjudicacio_contracte,
    recentContracts[0]?.data_formalitzacio_contracte,
    recentContracts[0]?.data_publicacio_anunci
  ).date;
  const entityPath = `/organismes/${encodeURIComponent(organ.nom_organ)}`;
  const organDescription = `${formatCompactNumber(totalAmount)} adjudicats en ${formatNumber(numContracts)} contractes públics per ${organ.nom_organ}.`;
  const jsonLd = buildEntityJsonLdGraph(
    buildEntityPrimaryJsonLd({
      schemaType: "GovernmentOrganization",
      name: organ.nom_organ,
      path: entityPath,
      description: organDescription,
    }),
    buildEntityBreadcrumbJsonLd([
      { name: "Inici", path: "/" },
      { name: "Organismes", path: "/organismes" },
      { name: organ.nom_organ },
    ])
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <Link href="/organismes" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
        &larr; Tornar a organismes
      </Link>

      <div className="mb-1 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">{organ.nom_organ}</h1>
        <SharePageButton className="shrink-0" />
      </div>
      <p className="text-gray-500 mb-8">Organisme contractant</p>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
        <StatCard
          title={`Import adjudicat ${currentYear}`}
          value={formatCompactNumber(currentYearAmount)}
          subtitle={currentYearAmountSubtitle}
        />
        <StatCard
          title={`Contractes ${currentYear}`}
          value={formatNumber(currentYearContracts)}
          subtitle={currentYearContractsSubtitle}
        />
      </section>

      <section className="mb-12">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Evolució anual</h2>
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
              {yearly.length > 0 ? (
                <YearlyTrendChartLazy data={yearly} />
              ) : (
                <p className="text-sm text-gray-500">No hi ha prou dades anuals per mostrar la gràfica.</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Contractes recents</h2>
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3 text-xs text-gray-500">
                Darrera data ref.: <span className="font-medium text-gray-700">{formatDate(lastAwardDate)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[520px] w-full table-auto text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="w-[50%] text-left py-2.5 px-3 md:px-4 font-medium text-gray-500">Empresa</th>
                      <th className="w-[20%] text-left py-2.5 px-3 md:px-4 font-medium text-gray-500 whitespace-nowrap">Data ref.</th>
                      <th className="w-[30%] text-right py-2.5 px-3 md:px-4 font-medium text-gray-500 whitespace-nowrap">Import (sense IVA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentContracts.map((contract, idx) => {
                      const bestDate = getBestAvailableContractDate(
                        contract.data_adjudicacio_contracte,
                        contract.data_formalitzacio_contracte,
                        contract.data_publicacio_anunci
                      );
                      const publicationUrl = getPublicationUrl(contract.enllac_publicacio);
                      return (
                        <tr key={`${contract.codi_expedient}-mini-${idx}`} className="border-b border-gray-100 last:border-b-0">
                          <td className="py-2.5 px-3 md:px-4 align-top text-gray-700">
                            {publicationUrl ? (
                              <a
                                href={publicationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={contract.denominacio_adjudicatari || ""}
                                className="block line-clamp-2 break-words leading-6 hover:underline"
                              >
                                {contract.denominacio_adjudicatari || "—"}
                              </a>
                            ) : (
                              <span
                                title={contract.denominacio_adjudicatari || ""}
                                className="block line-clamp-2 break-words leading-6"
                              >
                                {contract.denominacio_adjudicatari || "—"}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 md:px-4 align-top whitespace-nowrap text-gray-700">{formatDate(bestDate.date)}</td>
                          <td className="py-2.5 px-3 md:px-4 align-top text-right whitespace-nowrap text-gray-900 tabular-nums">
                            {contract.import_adjudicacio_sense ? formatCurrency(contract.import_adjudicacio_sense) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {topCompanies.length > 0 && (
        <OrganTopCompaniesTable rows={topCompanies} organTotalAmount={totalAmount} />
      )}

      <section>
        <OrganContractsExplorer organName={organ.nom_organ} />
      </section>
    </div>
  );
}
