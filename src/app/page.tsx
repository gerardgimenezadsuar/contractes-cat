import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchTotalContracts,
  fetchTotalAmount,
  fetchUniqueCompanies,
  fetchTopCompanies,
  fetchYearlyTrend,
  fetchCpvDistribution,
  fetchContracts,
  fetchTopOrgans,
} from "@/lib/api";
import {
  formatCompactNumber,
  formatCurrencyFull,
  formatDate,
  formatNumber,
  getBestAvailableContractDate,
  getPublicationUrl,
} from "@/lib/utils";
import StatCard from "@/components/ui/StatCard";
import {
  CompanyBarChartLazy,
  YearlyTrendChartLazy,
} from "@/components/charts/LazyCharts";
import CompanySearch from "@/components/ui/CompanySearch";
import { safeJsonLd } from "@/lib/seo/jsonld";
import { SITE_NAME, SITE_URL } from "@/config/constants";
import { buildCompanyHref } from "@/lib/company-identity";

export const metadata: Metadata = {
  title: "Contractació pública a Catalunya | contractes.cat",
  description:
    "Consulta contractes públics i adjudicacions de la contractació pública a Catalunya per empresa, organisme i persona.",
  keywords: [
    "contractes públics Catalunya",
    "contractació pública Catalunya",
    "adjudicacions públiques Catalunya",
    "licitacions Catalunya",
    "empreses adjudicatàries Catalunya",
    "organismes contractants Catalunya",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Contractació pública a Catalunya",
    description:
      "Consulta contractes públics i adjudicacions de la contractació pública a Catalunya per empresa, organisme i persona.",
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: "/social-card-v1.png",
        width: 1200,
        height: 630,
        alt: "Contractació pública a Catalunya - contractes.cat",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contractació pública a Catalunya",
    description:
      "Consulta contractes públics i adjudicacions de la contractació pública a Catalunya per empresa, organisme i persona.",
    images: ["/social-card-v1.png"],
  },
};

function isAjuntament(name: string): boolean {
  return /\bajuntament\b/i.test(name);
}

export default async function HomePage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const topCompaniesMinYear = currentYear - 2;

  const [
    totalContracts,
    totalAmount,
    uniqueCompanies,
    topCompanies,
    yearlyTrend,
    cpvSectors,
    recentContracts,
    topOrgans2024to2026,
  ] = await Promise.all([
    fetchTotalContracts(),
    fetchTotalAmount(),
    fetchUniqueCompanies(),
    fetchTopCompanies(10, { minYear: topCompaniesMinYear, maxYear: currentYear }),
    fetchYearlyTrend(),
    fetchCpvDistribution(10),
    fetchContracts({ page: 1, pageSize: 8 }),
    fetchTopOrgans(120, { minYear: 2024, maxYear: 2026 }),
  ]);

  const currentYearRow = yearlyTrend.find((row) => parseInt(row.year, 10) === currentYear);
  const currentYearContracts = currentYearRow ? parseInt(currentYearRow.num_contracts, 10) || 0 : 0;
  const currentYearAmount = currentYearRow ? parseFloat(currentYearRow.total) || 0 : 0;

  // YoY trend: compare last two complete years (currentYear-1 vs currentYear-2)
  const previousYearRow = yearlyTrend.find((row) => parseInt(row.year, 10) === currentYear - 1);
  const twoYearsAgoRow = yearlyTrend.find((row) => parseInt(row.year, 10) === currentYear - 2);
  const prevContracts = previousYearRow ? parseInt(previousYearRow.num_contracts, 10) || 0 : 0;
  const twoYearsContracts = twoYearsAgoRow ? parseInt(twoYearsAgoRow.num_contracts, 10) || 0 : 0;
  const contractsTrend =
    twoYearsContracts > 0 ? ((prevContracts - twoYearsContracts) / twoYearsContracts) * 100 : null;
  const prevAmount = previousYearRow ? parseFloat(previousYearRow.total) || 0 : 0;
  const twoYearsAmount = twoYearsAgoRow ? parseFloat(twoYearsAgoRow.total) || 0 : 0;
  const amountTrend =
    twoYearsAmount > 0 ? ((prevAmount - twoYearsAmount) / twoYearsAmount) * 100 : null;
  const trendLabel =
    previousYearRow && twoYearsAgoRow
      ? `${twoYearsAgoRow.year}→${previousYearRow.year}`
      : undefined;

  const topAjuntaments = topOrgans2024to2026.filter((row) => isAjuntament(row.nom_organ)).slice(0, 5);
  const topAltresOrgans = topOrgans2024to2026.filter((row) => !isAjuntament(row.nom_organ)).slice(0, 5);
  const homeJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: "ca",
        description:
          "Contractació pública a Catalunya: cercador i anàlisi d'adjudicacions per empreses, organismes i persones amb dades obertes.",
      },
      {
        "@type": "DataCatalog",
        name: "Observatori de contractació pública a Catalunya",
        url: SITE_URL,
        inLanguage: "ca",
        about: "Contractació pública a Catalunya",
      },
    ],
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(homeJsonLd) }} />
      <section className="mb-10 bg-gradient-to-b from-indigo-50/60 to-white">
        <div className="mx-auto max-w-7xl px-4 pb-4 pt-10">
          <div className="mb-2 flex justify-center">
            <span className="hidden items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
              {formatNumber(totalContracts)} contractes · {formatCompactNumber(totalAmount)} adjudicats · Dades obertes
            </span>
          </div>
          <div className="relative mb-3 mt-2">
            <h1 className="text-3xl font-bold text-gray-900 text-center leading-tight sm:text-4xl">
              Contractació pública a Catalunya
            </h1>
          </div>
          <p className="mb-5 text-center text-sm text-gray-600 sm:text-base max-w-2xl mx-auto">
            Observatori independent per consultar qui rep contractes públics a Catalunya. Cerca per <span className="font-medium text-gray-900">empresa</span>, <span className="font-medium text-gray-900">organisme</span> o <span className="font-medium text-gray-900">persona vinculada</span>.
          </p>
          <div className="mb-3 flex justify-center">
            <CompanySearch />
          </div>
          <div className="mb-2 hidden flex-wrap items-center justify-center gap-4 text-xs text-gray-500 sm:flex">
            <Link href="/empreses" className="underline hover:text-gray-800">Rànquing empreses</Link>
            <Link href="/persones" className="underline hover:text-gray-800">Cerca persones</Link>
            <Link href="/organismes" className="underline hover:text-gray-800">Rànquing organismes</Link>
            <Link href="/contractes" className="underline hover:text-gray-800">Explorador contractes</Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-8">
        <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={`Contractes ${currentYear} (en curs)`}
            value={formatNumber(currentYearContracts)}
            trend={contractsTrend}
            trendLabel={trendLabel}
            subtitle={`Any complet ${currentYear - 1}: ${formatNumber(prevContracts)}`}
          />
          <StatCard
            title={`Import adjudicat ${currentYear} (en curs)`}
            value={formatCompactNumber(currentYearAmount)}
            trend={amountTrend}
            trendLabel={trendLabel}
            subtitle={`Any complet ${currentYear - 1}: ${formatCompactNumber(prevAmount)}`}
          />
          <StatCard
            title="Empreses adjudicatàries"
            value={formatNumber(uniqueCompanies)}
            subtitle="Empreses úniques al dataset"
          />
          <StatCard
            title="Total contractes al dataset"
            value={formatNumber(totalContracts)}
            subtitle="Publicats a la plataforma de transparència"
          />
        </section>

        <section className="mb-10 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Top 10 empreses per import adjudicat {topCompaniesMinYear}-{currentYear}
              </h2>
              <Link href="/empreses" className="text-sm text-gray-600 underline hover:text-gray-900">
                Veure totes
              </Link>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              <CompanyBarChartLazy data={topCompanies} />
            </div>
            <p className="mt-2 text-xs text-gray-500">Basat en la data d&apos;adjudicació del contracte.</p>
          </div>

          <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-gray-900">Organismes 2024-2026</h2>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Top 5 Ajuntaments
                </p>
                <div className="overflow-hidden rounded-md border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="sr-only">
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Organisme</th>
                        <th scope="col">Import</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topAjuntaments.map((organ, index) => (
                        <tr key={`${organ.nom_organ}-${index}`} className="border-b border-gray-100 last:border-b-0">
                          <td className="px-2 py-2 text-xs text-gray-500">{index + 1}</td>
                          <td className="px-1 py-2">
                            <Link
                              href={`/organismes/${encodeURIComponent(organ.nom_organ)}`}
                              className="text-gray-700 hover:text-indigo-600 hover:underline"
                            >
                              {organ.nom_organ}
                            </Link>
                          </td>
                          <td className="px-2 py-2 text-right font-medium text-gray-900 whitespace-nowrap">
                            {formatCompactNumber(parseFloat(organ.total) || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Top 5 Altres
                </p>
                <div className="overflow-hidden rounded-md border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="sr-only">
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Organisme</th>
                        <th scope="col">Import</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topAltresOrgans.map((organ, index) => (
                        <tr key={`${organ.nom_organ}-${index}`} className="border-b border-gray-100 last:border-b-0">
                          <td className="px-2 py-2 text-xs text-gray-500">{index + 1}</td>
                          <td className="px-1 py-2">
                            <Link
                              href={`/organismes/${encodeURIComponent(organ.nom_organ)}`}
                              className="text-gray-700 hover:text-indigo-600 hover:underline"
                            >
                              {organ.nom_organ}
                            </Link>
                          </td>
                          <td className="px-2 py-2 text-right font-medium text-gray-900 whitespace-nowrap">
                            {formatCompactNumber(parseFloat(organ.total) || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Altres inclou Generalitat, consorcis, diputacions i ens públics.</p>
          </div>
        </section>

        <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Evolució anual</h2>
            <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              <YearlyTrendChartLazy data={yearlyTrend} />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              L&apos;increment dels primers anys reflecteix l&apos;adopció progressiva del registre digital.
              Les dades dels últims 5 anys són les més representatives.
            </p>
          </div>
          <div>
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Top sectors econòmics</h2>
            <div className="rounded-lg border border-gray-100 bg-white p-0 shadow-sm">
              <div className="max-h-[390px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th scope="col" className="w-[10%] px-3 py-2 text-left font-medium text-gray-500">#</th>
                      <th scope="col" className="w-[44%] px-3 py-2 text-left font-medium text-gray-500">Sector</th>
                      <th scope="col" className="w-[12%] px-3 py-2 text-left font-medium text-gray-500">Codi</th>
                      <th scope="col" className="w-[19%] px-3 py-2 text-right font-medium text-gray-500">Import</th>
                      <th scope="col" className="w-[15%] px-3 py-2 text-right font-medium text-gray-500">Contractes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cpvSectors.map((sector, index) => (
                      <tr key={`${sector.code}-${index}`} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                        <td className="px-3 py-2 text-gray-800">{sector.sector}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{sector.code}</td>
                        <td className="px-3 py-2 text-right text-gray-900">
                          {formatCompactNumber(sector.total)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {formatNumber(sector.num_contracts)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Agrupació per sectors amplis amb codi de 2 dígits.
            </p>
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Contractes recents</h2>
            <Link href="/contractes" className="text-sm text-gray-600 underline hover:text-gray-900">
              Veure explorer complet
            </Link>
          </div>
          <div className="space-y-3 md:hidden">
            {recentContracts.map((c, index) => {
              const bestDate = getBestAvailableContractDate(
                c.data_adjudicacio_contracte,
                c.data_formalitzacio_contracte,
                c.data_publicacio_anunci
              );
              const publicationUrl = getPublicationUrl(c.enllac_publicacio);
              return (
                <article
                  key={`${c.codi_expedient}-${index}`}
                  className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm"
                >
                  <p className="mb-1 text-xs text-gray-500">{formatDate(bestDate.date)}</p>
                  {publicationUrl ? (
                    <a
                      href={publicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-2 text-sm font-medium text-gray-900 hover:underline"
                    >
                      {c.denominacio || "—"}
                      <span className="sr-only"> (obre en una nova pestanya)</span>
                    </a>
                  ) : (
                    <p className="line-clamp-2 text-sm font-medium text-gray-900">{c.denominacio || "—"}</p>
                  )}
                  <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                    {c.identificacio_adjudicatari ? (
                      <Link
                        href={buildCompanyHref(
                          c.identificacio_adjudicatari,
                          c.denominacio_adjudicatari || ""
                        )}
                        className="hover:underline hover:text-indigo-600"
                      >
                        {c.denominacio_adjudicatari || "—"}
                      </Link>
                    ) : (
                      c.denominacio_adjudicatari || "—"
                    )}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-600">{c.nom_organ || "—"}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{c.tipus_contracte || "—"}</span>
                    <span className="font-mono text-xs text-gray-900">
                      {formatCurrencyFull(c.import_adjudicacio_amb_iva || "0")}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border border-gray-100 bg-white shadow-sm md:block">
            <table className="min-w-[920px] w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th scope="col" className="w-[14%] px-4 py-3 text-left font-medium text-gray-500">Data ref.</th>
                  <th scope="col" className="w-[24%] px-4 py-3 text-left font-medium text-gray-500">Denominació</th>
                  <th scope="col" className="w-[19%] px-4 py-3 text-left font-medium text-gray-500">Adjudicatari</th>
                  <th scope="col" className="w-[23%] px-4 py-3 text-left font-medium text-gray-500">Organisme</th>
                  <th scope="col" className="w-[10%] px-4 py-3 text-right font-medium text-gray-500">Import (IVA)</th>
                  <th scope="col" className="w-[10%] px-4 py-3 text-left font-medium text-gray-500">Tipus</th>
                </tr>
              </thead>
              <tbody>
                {recentContracts.map((c, index) => {
                  const bestDate = getBestAvailableContractDate(
                    c.data_adjudicacio_contracte,
                    c.data_formalitzacio_contracte,
                    c.data_publicacio_anunci
                  );
                  const publicationUrl = getPublicationUrl(c.enllac_publicacio);
                  return (
                    <tr key={`${c.codi_expedient}-${index}`} className="border-b border-gray-100 align-top hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-700">{formatDate(bestDate.date)}</td>
                      <td className="px-4 py-3 text-gray-900" title={c.denominacio || ""}>
                        {publicationUrl ? (
                          <a
                            href={publicationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {c.denominacio || "—"}
                            <span className="sr-only"> (obre en una nova pestanya)</span>
                          </a>
                        ) : (
                          c.denominacio || "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700" title={c.denominacio_adjudicatari || ""}>
                        {c.identificacio_adjudicatari ? (
                          <Link
                            href={buildCompanyHref(
                              c.identificacio_adjudicatari,
                              c.denominacio_adjudicatari || ""
                            )}
                            className="hover:underline hover:text-indigo-600"
                          >
                            {c.denominacio_adjudicatari || "—"}
                          </Link>
                        ) : (
                          c.denominacio_adjudicatari || "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700" title={c.nom_organ || ""}>{c.nom_organ || "—"}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-900">
                        {formatCurrencyFull(c.import_adjudicacio_amb_iva || "0")}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{c.tipus_contracte || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Mostra dels contractes més recents segons la millor data disponible (adjudicació,
            formalització o publicació).
          </p>
        </section>

        {/* Anàlisi callout banner */}
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-900">
                Anàlisi de risc: contractes menors concentrats al llindar dels 15.000 €
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Detectem si hi ha una acumulació inusual de contractes just per sota del llindar legal. Podria indicar fraccionament per evitar licitació pública.
              </p>
              <Link href="/analisi" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-900 underline hover:text-amber-700">
                Veure l&apos;anàlisi completa
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/empreses"
            className="group rounded-lg border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
              </svg>
            </div>
            <h3 className="mb-1 font-semibold text-gray-900">Empreses</h3>
            <p className="text-sm text-gray-600">
              Rànquing per import adjudicat. Cerca per nom o NIF i veu l&apos;historial complet.
            </p>
          </Link>
          <Link
            href="/organismes"
            className="group rounded-lg border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-purple-200 hover:shadow-md"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600 transition-colors group-hover:bg-purple-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 10c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
              </svg>
            </div>
            <h3 className="mb-1 font-semibold text-gray-900">Organismes</h3>
            <p className="text-sm text-gray-600">
              Ajuntaments, Generalitat i ens públics. Detall anual i empreses adjudicatàries.
            </p>
          </Link>
          <Link
            href="/contractes"
            className="group rounded-lg border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-teal-200 hover:shadow-md"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 transition-colors group-hover:bg-teal-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <h3 className="mb-1 font-semibold text-gray-900">Contractes</h3>
            <p className="text-sm text-gray-600">
              Explora tots els contractes amb filtres per any, tipus, procediment i import.
            </p>
          </Link>
          <Link
            href="/analisi"
            className="group rounded-lg border border-amber-200 bg-amber-50/50 p-5 shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 transition-colors group-hover:bg-amber-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
              </svg>
            </div>
            <h3 className="mb-1 font-semibold text-amber-900">Anàlisi</h3>
            <p className="text-sm text-amber-800">
              Detecció de patrons de risc i anàlisi del pes dels contractes menors.
            </p>
          </Link>
        </section>
      </div>
    </div>
  );
}
