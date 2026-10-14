import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import {
  COMPETITION_SINCE_YEAR,
  fetchCataloniaCompetition,
  fetchOrganCompetition,
  fetchOrganDetail,
  fetchOrganIneCode,
  fetchOrganRecentContracts,
  fetchOrganTopCompanies,
} from "@/lib/api";
import { withFallback } from "@/lib/socrata";
import { fetchCurrentEnsOfficeHolders } from "@/lib/electes";
import { municipalityFromIne10 } from "@/lib/idescat";
import {
  buildOrganIndicators,
  formatCompactEuros,
  formatDecimal,
  formatEuros,
  lastCompleteYear,
  perInhabitant,
  toYearlyRows,
} from "@/lib/indicators";
import { formatNumber, formatCompactNumber } from "@/lib/utils";
import { safeJsonLd } from "@/lib/seo/jsonld";
import {
  buildEntityBreadcrumbJsonLd,
  buildEntityJsonLdGraph,
  buildEntityMetadata,
  buildEntityPrimaryJsonLd,
} from "@/lib/seo/entity-seo";
import { YearlyTrendChartLazy } from "@/components/charts/LazyCharts";
import SharePageButton from "@/components/ui/SharePageButton";
import EntityHeader, { type HeaderChip, type KeyFigure } from "@/components/entity/EntityHeader";
import SectionTabs from "@/components/entity/SectionTabs";
import { IndicatorGrid } from "@/components/entity/IndicatorCard";
import ContextBand from "@/components/entity/ContextBand";
import OrganContractsExplorer from "@/components/organ/OrganContractsExplorer";
import OrganTopCompaniesTable from "@/components/organ/OrganTopCompaniesTable";
import OrganRecentContracts from "@/components/organ/OrganRecentContracts";
import OrganElectesCard from "@/components/organ/OrganElectesCard";

export const revalidate = 21600;
const ELECTES_PAGE_SIZE = 10;
// Supplier concentration is measured from this year on (see /metodologia).
const CONCENTRATION_SINCE_YEAR = 2023;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const getOrganDetail = cache(async (id: string) => fetchOrganDetail(id));

function readSingleQueryParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function organKind(name: string): string {
  const n = name.toLowerCase();
  if (n.startsWith("ajuntament")) return "Ajuntament";
  if (n.startsWith("consell comarcal")) return "Consell comarcal";
  if (n.startsWith("diputació")) return "Diputació";
  if (n.startsWith("departament")) return "Departament de la Generalitat";
  if (n.startsWith("universitat")) return "Universitat";
  return "Organisme contractant";
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
  return buildEntityMetadata({
    title: organName,
    description,
    path: entityPath,
    imagePath: `${entityPath}/opengraph-image`,
    imageAlt: `Resum de contractació pública de ${organName}`,
    keywords: [organName, `${organName} contractes`, "organisme contractant", "contractació pública Catalunya"],
    openGraphType: "article",
  });
}

export default async function OrganDetailPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const decodedId = decodeURIComponent(id);
  const rawElectesPage = readSingleQueryParam(query.electes_page);
  const parsedElectesPage = parseInt(rawElectesPage, 10);
  const electesPage = Number.isFinite(parsedElectesPage) && parsedElectesPage > 0 ? parsedElectesPage : 1;

  const { organ, yearly } = await getOrganDetail(decodedId);

  if (!organ) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-gray-500">No s&apos;ha trobat l&apos;organisme.</p>
        <Link href="/organismes" className="mt-4 inline-block text-accent hover:underline">
          Tornar a organismes
        </Link>
      </div>
    );
  }

  const organName = organ.nom_organ;
  const [recentContracts, topCompanies, topSince, ineCode, competition, baseline, electes] = await Promise.all([
    withFallback(fetchOrganRecentContracts(organName, 10), [], "fetchOrganRecentContracts"),
    withFallback(fetchOrganTopCompanies(organName, 10), [], "fetchOrganTopCompanies"),
    withFallback(fetchOrganTopCompanies(organName, 5, CONCENTRATION_SINCE_YEAR), [], "fetchOrganTopCompaniesSince"),
    withFallback(fetchOrganIneCode(organName), null, "fetchOrganIneCode"),
    withFallback(fetchOrganCompetition(organName), null, "fetchOrganCompetition"),
    withFallback(fetchCataloniaCompetition(), null, "fetchCataloniaCompetition"),
    withFallback(
      fetchCurrentEnsOfficeHolders(organName, { page: electesPage, pageSize: ELECTES_PAGE_SIZE }),
      {
        codiEns: null,
        ensName: null,
        matchedEnsNames: [],
        totalCurrentRoles: 0,
        page: electesPage,
        pageSize: ELECTES_PAGE_SIZE,
        rows: [],
      },
      "fetchCurrentEnsOfficeHolders"
    ),
  ]);

  const totalAmount = parseFloat(organ.total);
  const numContracts = parseInt(organ.num_contracts, 10);
  const currentYear = new Date().getFullYear();
  const yearlyRows = toYearlyRows(yearly);
  const lastYear = lastCompleteYear(yearlyRows);
  const currentRow = yearlyRows.find((row) => row.year === currentYear) ?? null;
  const municipality = organName.toLowerCase().startsWith("ajuntament") ? municipalityFromIne10(ineCode) : null;

  const indicators = buildOrganIndicators({
    yearly: yearlyRows,
    population: municipality?.population ?? null,
    populationYear: municipality?.populationYear ?? null,
    competition,
    baseline,
    topAmountsSince: topSince.map((row) => parseFloat(row.total) || 0),
    topNameSince: topSince[0]?.denominacio_adjudicatari,
    sinceYear: CONCENTRATION_SINCE_YEAR,
    competitionSinceYear: COMPETITION_SINCE_YEAR,
  });

  const perHab = lastYear ? perInhabitant(lastYear.total, municipality?.population) : null;
  const figures: KeyFigure[] = [
    { label: "Total adjudicat", value: formatCompactEuros(totalAmount), note: "IVA inclòs, tots els anys" },
    { label: "Contractes", value: formatNumber(numContracts), note: "publicats al portal" },
    lastYear
      ? {
          label: `Adjudicat el ${lastYear.year}`,
          value: formatCompactEuros(lastYear.total),
          note: `${formatNumber(lastYear.contracts)} contractes`,
        }
      : { label: `Adjudicat el ${currentYear}`, value: formatCompactEuros(currentRow?.total ?? 0), note: "any en curs" },
    perHab !== null && lastYear
      ? { label: `Per habitant, ${lastYear.year}`, value: formatEuros(perHab), unit: "/ hab.", note: "Població: Idescat" }
      : {
          label: `Adjudicat el ${currentYear}`,
          value: formatCompactEuros(currentRow?.total ?? 0),
          note: currentRow ? `${formatNumber(currentRow.contracts)} contractes, any en curs` : "sense dades encara",
        },
  ];

  const chips: HeaderChip[] = [];
  if (ineCode) chips.push({ label: "INE", value: ineCode.slice(0, 5), mono: true });
  if (municipality) chips.push({ label: "Idescat", value: municipality.id, mono: true });
  const firstYear = yearlyRows.filter((row) => row.year >= 2015 && row.total > 0).map((row) => row.year).sort()[0];
  if (firstYear) chips.push({ label: "Publica des de", value: String(firstYear) });
  if (currentRow) chips.push({ label: `Publicats el ${currentYear}`, value: formatNumber(currentRow.contracts) });

  const eyebrow = municipality
    ? `${organKind(organName)} · ${municipality.comarca} · ${formatDecimal(municipality.population ?? 0, 0)} habitants (${municipality.populationYear})`
    : organKind(organName);

  const entityPath = `/organismes/${encodeURIComponent(organName)}`;
  const organDescription = `${formatCompactNumber(totalAmount)} adjudicats en ${formatNumber(numContracts)} contractes públics per ${organName}.`;
  const electesTotalPages = Math.max(1, Math.ceil(electes.totalCurrentRoles / electes.pageSize));
  const hasElectes = electes.totalCurrentRoles > 0;
  const hasTopCompanies = topCompanies.length > 0;
  const buildElectesPageHref = (targetPage: number): string => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (key === "electes_page") continue;
      if (Array.isArray(value)) {
        for (const v of value) if (v) qs.append(key, v);
      } else if (value) {
        qs.set(key, value);
      }
    }
    if (targetPage > 1) qs.set("electes_page", String(targetPage));
    const s = qs.toString();
    return s ? `${entityPath}?${s}#carrecs` : `${entityPath}#carrecs`;
  };

  const tabs = [
    { id: "resum", label: "Resum" },
    ...(hasTopCompanies ? [{ id: "empreses", label: "Empreses" }] : []),
    ...(hasElectes ? [{ id: "carrecs", label: "Càrrecs electes" }] : []),
    { id: "contractes", label: "Contractes" },
  ];

  const jsonLd = buildEntityJsonLdGraph(
    buildEntityPrimaryJsonLd({
      schemaType: "GovernmentOrganization",
      name: organName,
      path: entityPath,
      description: organDescription,
    }),
    buildEntityBreadcrumbJsonLd([
      { name: "Inici", path: "/" },
      { name: "Organismes", path: "/organismes" },
      { name: organName },
    ])
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <EntityHeader
        backHref="/organismes"
        backLabel="Tornar a organismes"
        eyebrow={eyebrow}
        title={organName}
        chips={chips}
        figures={figures}
        actions={<SharePageButton className="shrink-0" />}
      />
      <SectionTabs tabs={tabs} />

      <section id="resum" className="scroll-mt-32 pt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-gray-900">Com contracta</h2>
          <Link href="/metodologia" className="text-sm text-accent hover:underline">
            Metodologia
          </Link>
        </div>
        {indicators.length > 0 ? (
          <IndicatorGrid indicators={indicators} />
        ) : (
          <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
            No hi ha prou dades per calcular indicadors de competència per a aquest organisme.
          </p>
        )}
        {municipality ? (
          <div className="mt-3">
            <ContextBand municipality={municipality} />
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="min-w-0 xl:col-span-3">
            <h2 className="mb-3 font-display text-xl font-semibold text-gray-900">Import adjudicat per any</h2>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              {yearly.length > 0 ? (
                <YearlyTrendChartLazy data={yearly} color="#0f5e63" />
              ) : (
                <p className="text-sm text-gray-500">No hi ha prou dades anuals per mostrar la gràfica.</p>
              )}
            </div>
          </div>
          <div className="min-w-0 xl:col-span-2">
            <h2 className="mb-3 font-display text-xl font-semibold text-gray-900">Contractes recents</h2>
            <OrganRecentContracts contracts={recentContracts} />
          </div>
        </div>
      </section>

      {hasTopCompanies ? (
        <section id="empreses" className="scroll-mt-32 pt-10">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-gray-900">Empreses adjudicatàries principals</h2>
            <span className="text-sm text-gray-500">tots els anys</span>
          </div>
          <OrganTopCompaniesTable rows={topCompanies} organTotalAmount={totalAmount} />
        </section>
      ) : null}

      {hasElectes ? (
        <section id="carrecs" className="scroll-mt-32 pt-10">
          <h2 className="mb-3 font-display text-xl font-semibold text-gray-900">Càrrecs electes actuals</h2>
          <div className="xl:max-w-3xl">
            <OrganElectesCard
              rows={electes.rows}
              totalCurrentRoles={electes.totalCurrentRoles}
              page={electes.page}
              totalPages={electesTotalPages}
              buildPageHref={buildElectesPageHref}
            />
          </div>
        </section>
      ) : null}

      <section id="contractes" className="scroll-mt-32 pt-10">
        <OrganContractsExplorer organName={organName} />
      </section>
    </div>
  );
}
