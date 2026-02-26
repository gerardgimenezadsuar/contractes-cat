import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { getPersonAwardeeTargets, loadPersonProfile } from "@/lib/borme";
import { fetchContractsByAwardeesSummary } from "@/lib/api";
import { fetchPublicOfficeProfile } from "@/lib/electes";
import { formatCompactNumber, formatDate, formatNumber } from "@/lib/utils";
import { formatPersonDisplayName } from "@/lib/person-utils";
import { safeJsonLd } from "@/lib/seo/jsonld";
import {
  buildEntityBreadcrumbJsonLd,
  buildEntityJsonLdGraph,
  buildEntityMetadata,
  buildEntityPrimaryJsonLd,
} from "@/lib/seo/entity-seo";
import StatCard from "@/components/ui/StatCard";
import SharePageButton from "@/components/ui/SharePageButton";
import PersonContractsExplorer from "@/components/person/PersonContractsExplorer";
import { buildCompanyHref } from "@/lib/company-identity";

export const revalidate = 21600;

interface Props {
  params: Promise<{ name: string }>;
  searchParams: Promise<{
    date_from?: string;
    date_to?: string;
    nifs?: string;
    nif_windows?: string;
    nom_organ?: string;
  }>;
}

const getPersonProfile = cache(async (name: string) => loadPersonProfile(name));
const getContractsSummary = cache(async (nifs: string[]) =>
  fetchContractsByAwardeesSummary({ nifs })
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const profile = await getPersonProfile(decodedName);

  const displayName = formatPersonDisplayName(profile?.person_name || decodedName);
  const bormeName = profile?.person_name || decodedName;

  const targets = profile ? getPersonAwardeeTargets(profile) : { nifs: [], companyNames: [] };
  const contractsSummary =
    targets.nifs.length > 0
      ? await getContractsSummary(targets.nifs)
      : { total: 0, totalAmount: 0 };

  const description = profile
    ? `${displayName}: ${formatNumber(profile.num_companies)} empreses vinculades, ${formatNumber(contractsSummary.total)} contractes públics (${formatCompactNumber(contractsSummary.totalAmount)}). Informació societària del BORME i contractes públics a Catalunya.`
    : `Informació societària de ${displayName} segons BORME.`;

  const entityPath = `/persones/${encodeURIComponent(bormeName)}`;
  return buildEntityMetadata({
    title: displayName,
    description,
    path: entityPath,
    imagePath: `${entityPath}/opengraph-image`,
    imageAlt: `Perfil de contractació pública de ${displayName}`,
    keywords: [
      displayName,
      bormeName,
      `${displayName} contractes`,
      `${displayName} empreses`,
      "BORME",
      "contractació pública Catalunya",
    ],
    openGraphType: "profile",
  });
}

export default async function PersonDetailPage({ params, searchParams }: Props) {
  const { name } = await params;
  const query = await searchParams;
  const decodedName = decodeURIComponent(name);
  const profile = await getPersonProfile(decodedName);

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-500">No s&apos;ha trobat la persona.</p>
        <Link href="/" className="text-blue-600 hover:underline mt-4 inline-block">
          Tornar a inici
        </Link>
      </div>
    );
  }

  const displayName = formatPersonDisplayName(profile.person_name);
  const personNameForHref = profile.person_name;
  const targets = getPersonAwardeeTargets(profile);
  const contractsSummary =
    targets.nifs.length > 0
      ? await getContractsSummary(targets.nifs)
      : { total: 0, totalAmount: 0 };
  const activeCompanies = profile.companies.filter((c) => c.active_spans > 0).length;
  const publicOffice = await fetchPublicOfficeProfile(profile.person_name);

  const safeDateFrom = /^\d{4}-\d{2}-\d{2}$/.test(query?.date_from || "")
    ? query.date_from || ""
    : "";
  const safeDateTo = /^\d{4}-\d{2}-\d{2}$/.test(query?.date_to || "")
    ? query.date_to || ""
    : "";
  const safeNomOrgan = (query?.nom_organ || "").trim().slice(0, 160);
  const scopedNifs = (query?.nifs || "")
    .split(",")
    .map((nif) => nif.trim().toUpperCase())
    .filter((nif) => /^[A-Z0-9]{8,12}$/.test(nif));
  const effectiveNifs = scopedNifs.length > 0 ? Array.from(new Set(scopedNifs)) : targets.nifs;
  const rawNifWindows = (query?.nif_windows || "").trim();
  const requestedNifWindows = rawNifWindows
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [nifRaw, fromRaw, toRaw] = chunk.split(",");
      const nif = (nifRaw || "").trim().toUpperCase();
      const from = (fromRaw || "").trim();
      const to = (toRaw || "").trim();
      return {
        nif,
        dateFrom: /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined,
        dateTo: /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined,
      };
    })
    .filter((item) => /^[A-Z0-9]{8,12}$/.test(item.nif));

  function normalizeDate(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) {
      const [, yyyy, mm, dd] = compactMatch;
      return `${yyyy}-${mm}-${dd}`;
    }
    const isoPrefix = trimmed.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoPrefix)) return isoPrefix;
    const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashMatch) {
      const [, dd, mm, yyyy] = slashMatch;
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  const companyWindowsByNif = new Map<string, Array<{ start: string; end: string | null }>>();
  for (const company of profile.companies) {
    if (!company.nif) continue;
    const start = normalizeDate(company.first_date_start);
    if (!start) continue;
    const end = normalizeDate(company.last_date_end);
    const windows = companyWindowsByNif.get(company.nif) || [];
    windows.push({
      start,
      end,
    });
    companyWindowsByNif.set(company.nif, windows);
  }

  function rangesOverlap(
    startA: string,
    endA: string | null,
    startB: string,
    endB: string | null
  ): boolean {
    const aEnd = endA ?? "9999-12-31";
    const bEnd = endB ?? "9999-12-31";
    return startA <= bEnd && startB <= aEnd;
  }

  function maxDate(a: string, b: string): string {
    return a >= b ? a : b;
  }

  function minDateOrNull(a: string | null, b: string | null): string | null {
    if (a === null) return b;
    if (b === null) return a;
    return a <= b ? a : b;
  }

  function buildNifWindowParam(
    windows: Array<{ nif: string; dateFrom?: string; dateTo?: string }>
  ): string {
    return windows
      .map((window) => `${window.nif},${window.dateFrom || ""},${window.dateTo || ""}`)
      .join(";");
  }

  const overlapByPeriod = new Map<string, { total: number; totalAmount: number }>();
  const overlapByPeriodAndOrgan = new Map<string, { total: number; totalAmount: number }>();
  const eligibleNifWindowsByPeriod = new Map<
    string,
    Array<{ nif: string; dateFrom?: string; dateTo?: string }>
  >();
  if (targets.nifs.length > 0 && publicOffice.periods.length > 0) {
    const overlapRows = await Promise.all(
      publicOffice.periods.map(async (period) => {
        if (!period.startDate) {
          return [
            period.key,
            { total: 0, totalAmount: 0 },
            { total: 0, totalAmount: 0 },
            [] as Array<{ nif: string; dateFrom?: string; dateTo?: string }>,
          ] as const;
        }
        const periodStart = period.startDate;
        const eligibleNifWindows = targets.nifs.flatMap((nif) => {
          const windows = companyWindowsByNif.get(nif) || [];
          return windows
            .filter((window) => rangesOverlap(window.start, window.end, periodStart, period.endDate))
            .map((window) => ({
              nif,
              dateFrom: maxDate(periodStart, window.start),
              dateTo: minDateOrNull(period.endDate, window.end) || undefined,
            }));
        });
        if (eligibleNifWindows.length === 0) {
          return [
            period.key,
            { total: 0, totalAmount: 0 },
            { total: 0, totalAmount: 0 },
            eligibleNifWindows,
          ] as const;
        }
        const [summary, summaryByOrgan] = await Promise.all([
          fetchContractsByAwardeesSummary({
            nifs: targets.nifs,
            nifDateWindows: eligibleNifWindows,
          }),
          fetchContractsByAwardeesSummary({
            nifs: targets.nifs,
            nifDateWindows: eligibleNifWindows,
            nom_organ: period.ensName || undefined,
          }),
        ]);
        return [period.key, summary, summaryByOrgan, eligibleNifWindows] as const;
      })
    );
    for (const [key, summary, summaryByOrgan, eligibleNifWindows] of overlapRows) {
      overlapByPeriod.set(key, summary);
      overlapByPeriodAndOrgan.set(key, summaryByOrgan);
      eligibleNifWindowsByPeriod.set(key, eligibleNifWindows);
    }
  }

  const periodRangeCounts = new Map<string, number>();
  for (const period of publicOffice.periods) {
    const rangeKey = `${period.startDate || "none"}|${period.endDate || "open"}`;
    periodRangeCounts.set(rangeKey, (periodRangeCounts.get(rangeKey) || 0) + 1);
  }
  const periodRangeSeen = new Map<string, number>();
  const displayPeriods = publicOffice.periods.map((period) => {
    const rangeKey = `${period.startDate || "none"}|${period.endDate || "open"}`;
    const seen = (periodRangeSeen.get(rangeKey) || 0) + 1;
    periodRangeSeen.set(rangeKey, seen);
    return {
      period,
      isFirstInRange: seen === 1,
      rangeCount: periodRangeCounts.get(rangeKey) || 1,
    };
  });

  function buildPeriodContractsHref(period: (typeof publicOffice.periods)[number], onlyCurrentEns = false): string {
    const params = new URLSearchParams();
    if (period.startDate) params.set("date_from", period.startDate);
    if (period.endDate) params.set("date_to", period.endDate);
    const eligibleNifWindows = eligibleNifWindowsByPeriod.get(period.key) || [];
    if (eligibleNifWindows.length > 0) {
      const eligibleNifs = Array.from(new Set(eligibleNifWindows.map((w) => w.nif)));
      params.set("nifs", eligibleNifs.join(","));
      params.set("nif_windows", buildNifWindowParam(eligibleNifWindows));
    }
    if (onlyCurrentEns && period.ensName?.trim()) {
      params.set("nom_organ", period.ensName.trim());
    }
    return params.size
      ? `/persones/${encodeURIComponent(personNameForHref)}?${params.toString()}#contractes`
      : `/persones/${encodeURIComponent(personNameForHref)}#contractes`;
  }

  const uniqueRangeKeys = new Set(
    publicOffice.periods.map((period) => `${period.startDate || "none"}|${period.endDate || "open"}`)
  );
  const singleRangeSummary =
    uniqueRangeKeys.size === 1 && displayPeriods.length > 0
      ? (() => {
          const representative = displayPeriods[0].period;
          const summary = overlapByPeriod.get(representative.key) || { total: 0, totalAmount: 0 };
          return {
            total: summary.total,
            totalAmount: summary.totalAmount,
            href: buildPeriodContractsHref(representative, false),
          };
        })()
      : null;

  const effectiveNifWindows =
    requestedNifWindows.length > 0 ? requestedNifWindows : undefined;
  const explorerScopeKey = [
    personNameForHref,
    safeNomOrgan,
    safeDateFrom,
    safeDateTo,
    rawNifWindows,
    effectiveNifs.join(","),
  ].join("|");
  const scopedContractsSummary =
    effectiveNifs.length > 0 && (safeDateFrom || safeDateTo || safeNomOrgan || effectiveNifWindows)
      ? await fetchContractsByAwardeesSummary({
          nifs: effectiveNifs,
          nom_organ: safeNomOrgan || undefined,
          dateFrom: safeDateFrom || undefined,
          dateTo: safeDateTo || undefined,
          nifDateWindows: effectiveNifWindows,
        })
      : contractsSummary;

  const personPath = `/persones/${encodeURIComponent(profile.person_name)}`;
  const personDescription = `${displayName}: vinculacions societàries i contractes públics a Catalunya.`;
  const jsonLd = buildEntityJsonLdGraph(
    buildEntityPrimaryJsonLd({
      schemaType: "Person",
      name: displayName,
      alternateName: profile.person_name,
      path: personPath,
      description: personDescription,
    }),
    buildEntityBreadcrumbJsonLd([
      { name: "Inici", path: "/" },
      { name: "Persones", path: "/persones" },
      { name: displayName },
    ])
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
        &larr; Tornar a inici
      </Link>

      <div className="mb-1 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">{displayName}</h1>
        <SharePageButton className="shrink-0" />
      </div>
      <p className="text-sm text-gray-500 mb-1">
        Nom al registre: <span className="font-medium text-gray-700">{profile.person_name}</span>
      </p>
      <p className="text-gray-600 mb-8">
        Vinculacions societàries extretes del BORME. Primer es mostra la informació legal i després els contractes públics de les empreses vinculades.
      </p>

      <section className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Empreses vinculades" value={formatNumber(profile.num_companies)} compact />
        <StatCard title="Empreses amb contractes públics" value={formatNumber(profile.num_companies_with_nif)} compact />
        <StatCard title="Empreses amb càrrecs actius" value={formatNumber(activeCompanies)} compact />
        <StatCard
          title="Potencials Contractes vinculats"
          titleTooltip="Import màxim potencial: inclou tots els contractes de les empreses vinculades sense filtrar pels períodes actius del càrrec. El filtratge temporal arribarà aviat."
          value={formatNumber(contractsSummary.total)}
          subtitle={`Import total: ${formatCompactNumber(contractsSummary.totalAmount)}`}
          compact
        />
      </section>

      {publicOffice.periods.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Càrrecs públics</h2>
          <p className="mb-3 text-sm text-gray-500">Font: Transparència Catalunya</p>
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden mb-8">
            {singleRangeSummary ? (
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Aquesta persona té <span className="font-medium">{formatNumber(singleRangeSummary.total)} contractes</span> adjudicats a empreses vinculades mentre ocupava càrrec públic en aquest període. La taula mostra quants provenen de cada ens.{" "}
                <Link href={singleRangeSummary.href} className="text-blue-600 hover:underline">
                  Veure tots els contractes del període
                </Link>
                .
              </div>
            ) : (
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Cada fila mostra quants contractes provenen de l&apos;ens on aquesta persona tenia càrrec durant el període indicat.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2.5 px-3 font-medium text-gray-500">Ens</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-500">Càrrec</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-500">Període</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-500">Contractes (ens)</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPeriods.map(({ period, isFirstInRange, rangeCount }) => {
                    const overlapByOrgan = overlapByPeriodAndOrgan.get(period.key) || { total: 0, totalAmount: 0 };
                    const periodLabel = period.startDate
                      ? `${formatDate(period.startDate)} - ${period.endDate ? formatDate(period.endDate) : "actual"}`
                      : "No informat";
                    const inferLabel =
                      period.endDateInference === "successor"
                        ? "Fi inferit per nomenament d'una altra persona"
                        : period.endDateInference === "open"
                          ? "Sense successor publicat"
                          : "Sense data de nomenament";
                    const scrutinyHrefEns = buildPeriodContractsHref(period, true);

                    return (
                      <tr key={period.key} className="border-b border-gray-100 last:border-b-0 align-top">
                        <td className="py-2.5 px-3 text-gray-900">
                          <div className="font-medium">{period.ensName}</div>
                          <div className="text-xs text-gray-500">Codi: {period.codiEns}</div>
                        </td>
                        <td className="py-2.5 px-3 text-gray-700">
                          <div>{period.carrec}</div>
                          {period.partit ? (
                            <div className="text-xs text-gray-500 mt-1">Partit: {period.partit}</div>
                          ) : null}
                        </td>
                        {isFirstInRange ? (
                          <td rowSpan={rangeCount} className="py-2.5 px-3 text-gray-700 align-top">
                            <div>{periodLabel}</div>
                            <div className="text-xs text-gray-500 mt-1">{inferLabel}</div>
                          </td>
                        ) : null}
                        <td className="py-2.5 px-3 text-gray-700">
                          <div>{formatNumber(overlapByOrgan.total)} contractes</div>
                          <div className="text-xs text-gray-500 mt-1">{formatCompactNumber(overlapByOrgan.totalAmount)}</div>
                          <Link href={scrutinyHrefEns} className="mt-1 inline-block text-sm text-blue-600 hover:underline">
                            Veure contractes d&apos;aquest ens
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
              Les dates de fi es dedueixen quan el mateix càrrec rep un nomenament posterior d&apos;una altra persona.
            </div>
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Vinculacions legals (BORME)</h2>
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Empresa</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">NIF</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Relacions</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Primer alta</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Fi darrer càrrec</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Estat</th>
                </tr>
              </thead>
              <tbody>
                {profile.companies.map((company) => {
                  const relationTypes = Array.from(new Set(company.roles.map((r) => r.relation_type))).join(", ");
                  const label = company.company_name_matched || company.company_name_borme;
                  return (
                    <tr
                      key={`${company.company_name_borme}-${company.nif || "no-nif"}`}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <td className="py-3 px-4 text-gray-900">
                        {company.nif ? (
                          <Link
                            href={buildCompanyHref(company.nif, label)}
                            className="hover:underline"
                          >
                            {label}
                          </Link>
                        ) : (
                          label
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-700">{company.nif || "—"}</td>
                      <td className="py-3 px-4 text-gray-700">{relationTypes || "—"}</td>
                      <td className="py-3 px-4 text-gray-700">{formatDate(company.first_date_start)}</td>
                      <td className="py-3 px-4 text-gray-700">
                        {company.last_date_end ? formatDate(company.last_date_end) : "—"}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {company.active_spans > 0 ? "Actiu" : "Històric"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="contractes">
        <PersonContractsExplorer
          key={explorerScopeKey}
          personName={profile.person_name}
          personNifs={effectiveNifs}
          initialContracts={[]}
          initialTotalContracts={scopedContractsSummary.total}
          initialTotalAmount={scopedContractsSummary.totalAmount}
          hasNifTargets={effectiveNifs.length > 0}
          initialOrganFilter={safeNomOrgan}
          initialDateFrom={safeDateFrom}
          initialDateTo={safeDateTo}
          initialNifWindows={rawNifWindows}
        />
      </section>
    </div>
  );
}
