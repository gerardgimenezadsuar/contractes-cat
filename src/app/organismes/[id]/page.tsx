import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import {
  fetchOrganDetail,
  fetchOrganRecentContracts,
  fetchOrganTopCompanies,
} from "@/lib/api";
import { fetchCurrentEnsOfficeHolders } from "@/lib/electes";
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
const ELECTES_PAGE_SIZE = 10;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const getOrganDetail = cache(async (id: string) => fetchOrganDetail(id));

function readSingleQueryParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

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

export default async function OrganDetailPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const decodedId = decodeURIComponent(id);
  const rawElectesPage = readSingleQueryParam(query.electes_page);
  const parsedElectesPage = parseInt(rawElectesPage, 10);
  const electesPage = Number.isFinite(parsedElectesPage) && parsedElectesPage > 0
    ? parsedElectesPage
    : 1;

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

  const electes = await fetchCurrentEnsOfficeHolders(organ.nom_organ, {
    page: electesPage,
    pageSize: ELECTES_PAGE_SIZE,
  });

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
  const electesTotalPages = Math.max(1, Math.ceil(electes.totalCurrentRoles / electes.pageSize));
  const hasElectes = electes.totalCurrentRoles > 0;
  const hasTopCompanies = topCompanies.length > 0;
  const electesBasePath = `/organismes/${encodeURIComponent(organ.nom_organ)}`;
  const buildElectesPageHref = (targetPage: number): string => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (key === "electes_page") continue;
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v) params.append(key, v);
        }
      } else if (value) {
        params.set(key, value);
      }
    }
    if (targetPage > 1) params.set("electes_page", String(targetPage));
    const qs = params.toString();
    return qs ? `${electesBasePath}?${qs}` : electesBasePath;
  };

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

  const electesCard = hasElectes ? (
    <div className="min-w-0">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Càrrecs electes actuals</h2>
      <p className="mb-3 text-xs text-gray-500">
        Font: Transparència Catalunya. Llistat inferit per darrer nomenament conegut per plaça.
      </p>
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-3 py-2.5 text-xs text-gray-700">
          <span className="font-medium">{formatNumber(electes.totalCurrentRoles)}</span> càrrecs inferits.
        </div>
        <ul className="divide-y divide-gray-100">
          {electes.rows.map((row) => (
            <li
              key={row.key}
              className="px-3 py-2.5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
            >
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
        {electesTotalPages > 1 ? (
          <div className="border-t border-gray-100 px-3 py-2.5 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="text-gray-600">
              Pàgina {formatNumber(electes.page)} de {formatNumber(electesTotalPages)}
            </p>
            <div className="flex items-center gap-1.5">
              {electes.page > 1 ? (
                <Link
                  href={buildElectesPageHref(electes.page - 1)}
                  scroll={false}
                  className="px-2.5 py-1 rounded border border-gray-300 hover:bg-gray-50"
                >
                  Anterior
                </Link>
              ) : (
                <span className="px-2.5 py-1 rounded border border-gray-200 text-gray-400">
                  Anterior
                </span>
              )}
              {electes.page < electesTotalPages ? (
                <Link
                  href={buildElectesPageHref(electes.page + 1)}
                  scroll={false}
                  className="px-2.5 py-1 rounded border border-gray-300 hover:bg-gray-50"
                >
                  Següent
                </Link>
              ) : (
                <span className="px-2.5 py-1 rounded border border-gray-200 text-gray-400">
                  Següent
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

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

      {hasTopCompanies || hasElectes ? (
        <section className="mb-12">
          {hasTopCompanies && hasElectes ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              <div className="min-w-0 xl:col-span-2">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Empreses adjudicatàries principals</h2>
                <OrganTopCompaniesTable rows={topCompanies} organTotalAmount={totalAmount} />
              </div>
              <div className="min-w-0 xl:col-span-1">{electesCard}</div>
            </div>
          ) : null}

          {hasTopCompanies && !hasElectes ? (
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Empreses adjudicatàries principals</h2>
              <OrganTopCompaniesTable rows={topCompanies} organTotalAmount={totalAmount} />
            </div>
          ) : null}

          {!hasTopCompanies && hasElectes ? electesCard : null}
        </section>
      ) : null}

      <section>
        <OrganContractsExplorer organName={organ.nom_organ} />
      </section>
    </div>
  );
}
