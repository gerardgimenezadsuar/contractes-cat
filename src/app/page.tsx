import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
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
import { withFallback } from "@/lib/socrata";
import { formatDate, formatNumber, getBestAvailableContractDate, getPublicationUrl } from "@/lib/utils";
import { formatCompactEuros } from "@/lib/indicators";
import CompanySearch from "@/components/ui/CompanySearch";
import KeyFigures, { type KeyFigure } from "@/components/entity/KeyFigures";
import HomeRankings, { type RankTab } from "@/components/home/HomeRankings";
import ExampleProfileCard from "@/components/home/ExampleProfileCard";
import { HOME_EXAMPLE_NIF } from "@/lib/home-examples";
import { safeJsonLd } from "@/lib/seo/jsonld";
import { SITE_NAME, SITE_URL } from "@/config/constants";
import { buildCompanyHref } from "@/lib/company-identity";
import { displayCompanyName } from "@/lib/company-names";
import { listTopCompanyGroups, loadBormeCoverage } from "@/lib/borme";
import { fetchTrending } from "@/lib/trending";
import TrackedLinks from "@/components/entity/TrackedLinks";

const OG_DESCRIPTION =
  "Contractes públics adjudicats a Catalunya, administradors i propietaris de les empreses (BORME) i grups empresarials. Cerca per empresa, organisme o persona.";

export const metadata: Metadata = {
  title: "Contractes públics a Catalunya: qui els guanya i qui controla les empreses | contractes.cat",
  description:
    "Cerca qualsevol empresa, organisme o persona: contractes públics adjudicats a Catalunya i qui controla les empreses que els guanyen (propietaris i administradors segons el BORME). Contratos públicos en Cataluña.",
  keywords: [
    "contractes públics Catalunya",
    "contractació pública Catalunya",
    "adjudicacions públiques Catalunya",
    "licitacions Catalunya",
    "administradors empreses BORME",
    "grups empresarials Catalunya",
    "contratos públicos Cataluña",
    "empreses adjudicatàries Catalunya",
    "organismes contractants Catalunya",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Contractació pública a Catalunya",
    description: OG_DESCRIPTION,
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
    description: OG_DESCRIPTION,
    images: ["/social-card-v1.png"],
  },
};

const RANK_SIZE = 8;

function contractsLabel(n: number): string {
  return n === 1 ? "1 contracte" : `${formatNumber(n)} contractes`;
}

export default async function HomePage() {
  const currentYear = new Date().getFullYear();
  const rankMinYear = currentYear - 2;

  const [
    totalContracts,
    totalAmount,
    uniqueCompanies,
    topCompanies,
    yearlyTrend,
    cpvSectors,
    recentContracts,
    topOrgans,
    topGroups,
    coverage,
    trending,
  ] = await Promise.all([
    fetchTotalContracts(),
    fetchTotalAmount(),
    fetchUniqueCompanies(),
    withFallback(fetchTopCompanies(RANK_SIZE, { minYear: rankMinYear, maxYear: currentYear }), [], "fetchTopCompanies"),
    withFallback(fetchYearlyTrend(), [], "fetchYearlyTrend"),
    withFallback(fetchCpvDistribution(RANK_SIZE), [], "fetchCpvDistribution"),
    withFallback(fetchContracts({ page: 1, pageSize: 6 }), [], "fetchContracts"),
    withFallback(fetchTopOrgans(RANK_SIZE, { minYear: rankMinYear, maxYear: currentYear }), [], "fetchTopOrgans"),
    listTopCompanyGroups(0, RANK_SIZE),
    loadBormeCoverage(),
    fetchTrending(),
  ]);

  const currentYearRow = yearlyTrend.find((row) => parseInt(row.year, 10) === currentYear);
  const currentYearContracts = currentYearRow ? parseInt(currentYearRow.num_contracts, 10) || 0 : 0;
  const currentYearAmount = currentYearRow ? parseFloat(currentYearRow.total) || 0 : 0;
  const previousYearRow = yearlyTrend.find((row) => parseInt(row.year, 10) === currentYear - 1);

  const figures: KeyFigure[] = [
    { label: "Contractes", value: formatNumber(totalContracts), note: `${formatCompactEuros(totalAmount)} adjudicats en total` },
    {
      label: `Adjudicat el ${currentYear}`,
      value: formatCompactEuros(currentYearAmount),
      note: `${formatNumber(currentYearContracts)} contractes, any en curs`,
    },
    { label: "Empreses adjudicatàries", value: formatNumber(uniqueCompanies), note: "amb algun contracte públic" },
    coverage && coverage.companies > 0
      ? {
          label: "Empreses amb BORME",
          value: formatNumber(coverage.companies),
          note: `administradors i propietaris · ${formatNumber(coverage.groups)} grups`,
        }
      : {
          label: `Adjudicat el ${currentYear - 1}`,
          value: formatCompactEuros(previousYearRow ? parseFloat(previousYearRow.total) || 0 : 0),
          note: "any complet",
        },
  ];

  const rankPeriod = `Import adjudicat ${rankMinYear}-${currentYear}, IVA inclòs.`;
  const tabs: RankTab[] = [
    {
      id: "empreses",
      label: "Empreses",
      period: rankPeriod,
      moreHref: "/empreses",
      moreLabel: "Totes les empreses",
      rows: topCompanies.map((c) => ({
        name: c.denominacio_adjudicatari,
        href: buildCompanyHref(c.identificacio_adjudicatari, c.denominacio_adjudicatari),
        amount: parseFloat(c.total) || 0,
        amountLabel: formatCompactEuros(parseFloat(c.total) || 0),
        detail: contractsLabel(parseInt(c.num_contracts, 10) || 0),
      })),
    },
    {
      id: "grups",
      label: "Grups",
      period: "Total adjudicat a les empreses de cada grup, tots els anys. Grups reconstruïts a partir del BORME.",
      moreHref: "/grups",
      moreLabel: "Tots els grups",
      rows: topGroups.map((g) => ({
        name: displayCompanyName(g.rootName, false),
        href: `/grups/${g.groupId}`,
        amount: g.totalAmount,
        amountLabel: formatCompactEuros(g.totalAmount),
        detail: `${formatNumber(g.size)} empreses`,
      })),
    },
    {
      id: "organismes",
      label: "Organismes",
      period: rankPeriod,
      moreHref: "/organismes",
      moreLabel: "Tots els organismes",
      rows: topOrgans.map((o) => ({
        name: o.nom_organ,
        href: `/organismes/${encodeURIComponent(o.nom_organ)}`,
        amount: parseFloat(o.total) || 0,
        amountLabel: formatCompactEuros(parseFloat(o.total) || 0),
        detail: contractsLabel(parseInt(o.num_contracts, 10) || 0),
      })),
    },
    {
      id: "sectors",
      label: "Sectors",
      period: "Per divisió CPV, tots els anys, IVA inclòs.",
      moreHref: "/contractes",
      moreLabel: "Explorador de contractes",
      rows: cpvSectors.map((s) => ({
        name: s.sector,
        amount: s.total,
        amountLabel: formatCompactEuros(s.total),
        detail: contractsLabel(s.num_contracts),
      })),
    },
  ].filter((tab) => tab.rows.length > 0);

  const explore = [
    {
      href: `/connexions?a=${HOME_EXAMPLE_NIF}&an=SOREA&b=A66098435&bn=Aig%C3%BCes%20de%20Barcelona`,
      title: "Com es connecten dues empreses",
      text: "La cadena de socis i administradors que les uneix.",
    },
    {
      href: "/grups",
      title: "Grups empresarials",
      text: "Matrius i filials, i el que han guanyat plegades.",
    },
    {
      href: "/persones",
      title: "Persones",
      text: "Qui és propietari o administrador de quines empreses.",
    },
    {
      href: "/analisi",
      title: "Contractes menors al llindar",
      text: "Acumulacions just per sota dels 15.000 €.",
    },
    {
      href: "/contractes",
      title: "Explorador de contractes",
      text: "Filtres per any, tipus, procediment i import.",
    },
  ];

  const trendingRows = [
    {
      label: "Empreses més consultades",
      links: trending.companies.map((c) => ({ key: c.nif, href: buildCompanyHref(c.nif, c.name), label: c.name })),
    },
    {
      label: "Organismes més consultats",
      links: trending.organs.map((o) => ({ key: o, href: `/organismes/${encodeURIComponent(o)}`, label: o })),
    },
  ].filter((row) => row.links.length > 0);

  // Examples sit beside the search on desktop and further down on phones, so
  // the search stays the first thing and the card reads as an example.
  const examples = (placement: string) => (
    <TrackedLinks from={`home/example-${placement}`}>
      <Suspense fallback={<div className="h-72 rounded-xl border border-gray-200 bg-white" />}>
        <ExampleProfileCard />
      </Suspense>
    </TrackedLinks>
  );

  const homeJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: "ca",
        description:
          "Contractació pública a Catalunya: contractes adjudicats, administradors i grups empresarials de les empreses adjudicatàries, amb dades obertes i del BORME.",
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

      <section className="border-b border-gray-200 bg-gradient-to-b from-accent-soft/70 to-white">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-8 px-4 pb-8 pt-7 sm:pt-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-14 lg:pb-12">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-accent">
              Contractes públics + Registre Mercantil · dades obertes
            </p>
            <h1 className="mt-2 font-display text-[1.85rem] font-semibold leading-[1.12] text-gray-900 [text-wrap:balance] sm:text-[2.6rem]">
              Contractes públics, administradors i grups de les empreses de Catalunya
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-gray-600 sm:text-base">
              Creuem {formatNumber(totalContracts)} contractes públics amb el BORME: qui guanya les adjudicacions, qui
              controla aquestes empreses i a quin grup pertanyen.
            </p>
            <div className="mt-6">
              <CompanySearch />
            </div>
            {trendingRows.length > 0 ? (
              <TrackedLinks from="home/trending" className="mt-5 space-y-2">
                {trendingRows.map((row) => (
                  <div key={row.label} className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
                    <p className="shrink-0 text-xs text-gray-500 sm:w-44">{row.label} aquesta setmana</p>
                    <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                      {row.links.map((link) => (
                        <li key={link.key} className="shrink-0">
                          <Link
                            href={link.href}
                            className="inline-flex min-h-8 max-w-[16rem] items-center rounded-full border border-gray-200 bg-white px-3 text-[13px] text-gray-700 hover:border-accent hover:text-accent"
                          >
                            <span className="truncate">{link.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </TrackedLinks>
            ) : null}
          </div>
          <div className="hidden lg:block">{examples("hero")}</div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4">
        <KeyFigures figures={figures} className="mt-6" />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12 lg:py-10">
          <div className="min-w-0 space-y-10">
            <TrackedLinks from="home/ranking">
              <HomeRankings tabs={tabs} />
            </TrackedLinks>

            <div className="lg:hidden">{examples("body")}</div>

            {recentContracts.length > 0 ? (
              <TrackedLinks as="section" from="home/recent">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <h2 className="font-display text-xl font-semibold text-gray-900 sm:text-2xl">Darrers contractes</h2>
                  <Link href="/contractes" className="text-sm font-medium text-accent hover:underline">
                    Explorador &rarr;
                  </Link>
                </div>
                <ul className="border-t border-gray-900">
                  {recentContracts.map((c, index) => {
                    const date = getBestAvailableContractDate(
                      c.data_adjudicacio_contracte,
                      c.data_formalitzacio_contracte,
                      c.data_publicacio_anunci
                    ).date;
                    const publicationUrl = getPublicationUrl(c.enllac_publicacio);
                    const amount = parseFloat(c.import_adjudicacio_amb_iva || "0") || 0;
                    return (
                      <li key={`${c.codi_expedient}-${index}`} className="border-b border-gray-200 py-2.5 text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                          {publicationUrl ? (
                            <a
                              href={publicationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-w-0 truncate font-medium text-gray-900 hover:underline"
                              title={c.denominacio || ""}
                            >
                              {c.denominacio || "—"}
                            </a>
                          ) : (
                            <span className="min-w-0 truncate font-medium text-gray-900" title={c.denominacio || ""}>
                              {c.denominacio || "—"}
                            </span>
                          )}
                          <span className="shrink-0 font-medium text-gray-900 tabular-nums">{formatCompactEuros(amount)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {formatDate(date)}
                          {" · "}
                          {c.identificacio_adjudicatari ? (
                            <Link
                              href={buildCompanyHref(c.identificacio_adjudicatari, c.denominacio_adjudicatari || "")}
                              className="text-gray-700 hover:text-accent hover:underline"
                            >
                              {c.denominacio_adjudicatari || "—"}
                            </Link>
                          ) : (
                            c.denominacio_adjudicatari || "—"
                          )}
                          {c.nom_organ ? ` · ${c.nom_organ}` : null}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </TrackedLinks>
            ) : null}
          </div>

          <TrackedLinks as="section" from="home/explore">
            <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">Explora</h2>
            <ul className="mt-2 border-t border-gray-900">
              {explore.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="group block border-b border-gray-200 py-3">
                    <span className="flex items-center justify-between gap-2 text-sm font-medium text-gray-900 group-hover:text-accent">
                      {item.title}
                      <span aria-hidden className="text-gray-400 group-hover:text-accent">
                        &rarr;
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">{item.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </TrackedLinks>
        </div>
      </div>
    </div>
  );
}
