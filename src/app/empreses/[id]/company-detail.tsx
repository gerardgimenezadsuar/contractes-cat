import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import {
  COMPETITION_SINCE_YEAR,
  fetchCataloniaCompetition,
  fetchCompanyCompetition,
  fetchCompanyDetail,
  fetchCompanyContracts,
  fetchCompanyContractsCount,
  fetchCompanyLastAwardDate,
  fetchAwardeeTotalsByNifs,
  fetchCompanyTopOrgans,
  resolveMaskedAwardee,
} from "@/lib/api";
import { buildCompanyIndicators, formatCompactEuros, lastCompleteYear, toYearlyRows } from "@/lib/indicators";
import { formatNumber, formatCompactNumber, formatDate } from "@/lib/utils";
import { safeJsonLd } from "@/lib/seo/jsonld";
import {
  buildEntityBreadcrumbJsonLd,
  buildEntityJsonLdGraph,
  buildEntityMetadata,
  buildEntityPrimaryJsonLd,
} from "@/lib/seo/entity-seo";
import { YearlyTrendChartLazy } from "@/components/charts/LazyCharts";
import CompanyContractsExplorer from "@/components/company/CompanyContractsExplorer";
import SharePageButton from "@/components/ui/SharePageButton";
import CompanyCounterpartyTable from "@/components/company/CompanyCounterpartyTable";
import BormeSummaryCard from "@/components/company/BormeSummaryCard";
import EntityHeader, { type HeaderChip, type KeyFigure } from "@/components/entity/EntityHeader";
import SectionTabs from "@/components/entity/SectionTabs";
import { IndicatorGrid } from "@/components/entity/IndicatorCard";
import { loadAdminHistory, loadCompanyGroupByNif, loadRelatedCompanies } from "@/lib/borme";
import RelatedCompaniesSection from "@/components/company/RelatedCompaniesSection";
import { buildCompanyHref, isAmbiguousCompanyId } from "@/lib/company-identity";
import MaskedIdentityNotice from "@/components/company/MaskedIdentityNotice";

/**
 * Company page shared by /empreses/[id] and /empreses/[id]/nom/[name].
 *
 * `?name=` (only used to tell apart people behind an anonymised DNI) is
 * rewritten to the /nom/[name] path in next.config.ts, so neither route
 * reads searchParams and both can be ISR-cached.
 *
 * No withFallback here: a failed Socrata call throws, so Next keeps serving
 * the last good cached version instead of caching a degraded page.
 */

const getCompanyDetail = cache(async (id: string, companyName?: string) => fetchCompanyDetail(id, companyName));

export async function buildCompanyMetadata(decodedId: string, name?: string): Promise<Metadata> {
  const { company } = await getCompanyDetail(decodedId, name);
  const companyName = company?.denominacio_adjudicatari || decodedId;
  const canonicalCompanyId = company?.identificacio_adjudicatari || decodedId;
  const totalAmount = parseFloat(company?.total || "0");
  const totalContracts = parseInt(company?.num_contracts || "0", 10);
  const description = company
    ? `${formatCompactNumber(totalAmount)} adjudicats en ${formatNumber(totalContracts)} contractes públics a ${companyName}.`
    : `Detall dels contractes públics adjudicats a ${companyName}.`;

  const entityPath = buildCompanyHref(canonicalCompanyId, companyName);
  return buildEntityMetadata({
    title: companyName,
    description,
    path: entityPath,
    imagePath: `/empreses/${encodeURIComponent(canonicalCompanyId)}/opengraph-image`,
    imageAlt: `Resum de contractació pública de ${companyName}`,
    keywords: [companyName, decodedId, `${companyName} contractes`, "contractació pública Catalunya"],
    openGraphType: "article",
  });
}

export async function CompanyDetail({ decodedId, name }: { decodedId: string; name?: string }) {

  const { company, yearly } = await getCompanyDetail(decodedId, name);

  if (!company) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-gray-500">No s&apos;ha trobat l&apos;empresa.</p>
        <Link href="/empreses" className="mt-4 inline-block text-accent hover:underline">
          Tornar a empreses
        </Link>
      </div>
    );
  }

  const nif = company.identificacio_adjudicatari;
  const canMeasureCompetition = !isAmbiguousCompanyId(nif);
  const [contracts, contractsCount, topOrgans, lastAwardDate, competition, baseline, adminHistory, relatedCompanies, companyGroup] = await Promise.all([
    fetchCompanyContracts(decodedId, name, 0, 50),
    fetchCompanyContractsCount(decodedId, name),
    fetchCompanyTopOrgans(decodedId, name, 10),
    fetchCompanyLastAwardDate(decodedId, name),
    canMeasureCompetition ? fetchCompanyCompetition(nif) : Promise.resolve(null),
    canMeasureCompetition ? fetchCataloniaCompetition() : Promise.resolve(null),
    loadAdminHistory(decodedId),
    canMeasureCompetition ? loadRelatedCompanies(nif) : Promise.resolve([]),
    canMeasureCompetition ? loadCompanyGroupByNif(nif) : Promise.resolve(null),
  ]);
  const hasNetwork = relatedCompanies.length > 0 || Boolean(companyGroup && companyGroup.size > 1);
  const relatedTotals =
    relatedCompanies.length > 0
      ? await fetchAwardeeTotalsByNifs(relatedCompanies.flatMap((r) => (r.nif ? [r.nif] : []))).catch(() => new Map())
      : new Map();
  const maskedIdentity = isAmbiguousCompanyId(nif) ? await resolveMaskedAwardee(decodedId, name) : null;
  const hasBormeData = Boolean(adminHistory && adminHistory.spans.length > 0);

  const totalAmount = parseFloat(company.total);
  const numContracts = parseInt(company.num_contracts, 10);
  const currentYear = new Date().getFullYear();
  const yearlyRows = toYearlyRows(yearly);
  const lastYear = lastCompleteYear(yearlyRows);
  const currentRow = yearlyRows.find((row) => row.year === currentYear) ?? null;
  const indicators = buildCompanyIndicators(competition, baseline, COMPETITION_SINCE_YEAR);

  const figures: KeyFigure[] = [
    { label: "Total adjudicat", value: formatCompactEuros(totalAmount), note: "IVA inclòs, tots els anys" },
    { label: "Contractes", value: formatNumber(numContracts), note: "publicats al portal" },
    lastYear
      ? { label: `Adjudicat el ${lastYear.year}`, value: formatCompactEuros(lastYear.total), note: `${formatNumber(lastYear.contracts)} contractes` }
      : { label: `Adjudicat el ${currentYear}`, value: formatCompactEuros(currentRow?.total ?? 0), note: "any en curs" },
    {
      label: `Adjudicat el ${currentYear}`,
      value: formatCompactEuros(currentRow?.total ?? 0),
      note: currentRow ? `${formatNumber(currentRow.contracts)} contractes, any en curs` : "sense dades encara",
    },
  ];

  const chips: HeaderChip[] = [{ label: "NIF", value: nif, mono: true }];
  if (lastAwardDate) chips.push({ label: "Darrera adjudicació", value: formatDate(lastAwardDate) });
  if (hasBormeData && adminHistory?.matched_name) chips.push({ label: "BORME", value: adminHistory.matched_name });

  const entityPath = buildCompanyHref(nif, company.denominacio_adjudicatari);
  const companyDescription = `${formatCompactNumber(totalAmount)} adjudicats en ${formatNumber(numContracts)} contractes públics a ${company.denominacio_adjudicatari}.`;
  const jsonLd = buildEntityJsonLdGraph(
    buildEntityPrimaryJsonLd({
      schemaType: "Organization",
      name: company.denominacio_adjudicatari,
      path: entityPath,
      description: companyDescription,
      extraFields: { identifier: nif },
    }),
    buildEntityBreadcrumbJsonLd([
      { name: "Inici", path: "/" },
      { name: "Empreses", path: "/empreses" },
      { name: company.denominacio_adjudicatari },
    ])
  );

  const tabs = [
    { id: "resum", label: "Resum" },
    ...(topOrgans.length > 0 ? [{ id: "organismes", label: "Organismes" }] : []),
    ...(hasBormeData ? [{ id: "administradors", label: "Administradors" }] : []),
    ...(hasNetwork ? [{ id: "relacionades", label: "Empreses relacionades" }] : []),
    { id: "contractes", label: "Contractes" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <EntityHeader
        backHref="/empreses"
        backLabel="Tornar a empreses"
        eyebrow="Empresa adjudicatària"
        title={company.denominacio_adjudicatari}
        chips={chips}
        figures={figures}
        actions={<SharePageButton className="shrink-0" />}
      />
      {maskedIdentity ? (
        <MaskedIdentityNotice cluster={maskedIdentity.cluster} others={maskedIdentity.others} />
      ) : null}
      <SectionTabs tabs={tabs} />

      <section id="resum" className="scroll-mt-32 pt-8">
        {indicators.length > 0 ? (
          <>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-gray-900">Com guanya els contractes</h2>
              <Link href="/metodologia" className="text-sm text-accent hover:underline">
                Metodologia
              </Link>
            </div>
            <IndicatorGrid indicators={indicators} />
          </>
        ) : null}

        <div className={`grid grid-cols-1 gap-6 ${indicators.length > 0 ? "mt-8" : ""} xl:grid-cols-5`}>
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
          {hasBormeData ? (
            <div id="administradors" className="min-w-0 scroll-mt-32 xl:col-span-2">
              <h2 className="mb-3 font-display text-xl font-semibold text-gray-900">Administradors (BORME)</h2>
              <BormeSummaryCard spans={adminHistory?.spans || []} matchedName={adminHistory?.matched_name || ""} compact />
            </div>
          ) : null}
        </div>
      </section>

      {topOrgans.length > 0 ? (
        <section id="organismes" className="scroll-mt-32 pt-10">
          <CompanyCounterpartyTable rows={topOrgans} companyTotalAmount={totalAmount} lastAwardDate={lastAwardDate} />
        </section>
      ) : null}

      {hasNetwork ? (
        <section id="relacionades" className="scroll-mt-32 pt-10">
          <RelatedCompaniesSection
            companyName={company.denominacio_adjudicatari}
            related={relatedCompanies}
            totals={relatedTotals}
            group={companyGroup}
          />
        </section>
      ) : null}

      <section id="contractes" className="scroll-mt-32 pt-10">
        <CompanyContractsExplorer
          nif={nif}
          awardeeName={company.denominacio_adjudicatari}
          initialContracts={contracts}
          totalContracts={contractsCount}
        />
      </section>
    </div>
  );
}
