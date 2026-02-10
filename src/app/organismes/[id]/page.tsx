import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchOrganDetail,
  fetchOrganRecentContracts,
  fetchOrganNearDirectAwardBandCount,
} from "@/lib/api";
import {
  formatCurrency,
  formatNumber,
  formatCompactNumber,
  getBestAvailableContractDate,
  getPublicationUrl,
  formatDate,
} from "@/lib/utils";
import StatCard from "@/components/ui/StatCard";
import YearlyTrendChart from "@/components/charts/YearlyTrendChart";
import SharePageButton from "@/components/ui/SharePageButton";
import OrganContractsExplorer from "@/components/organ/OrganContractsExplorer";
import OrganTopCompaniesSection from "@/components/organ/OrganTopCompaniesSection";
import YearFilterChip from "@/components/ui/YearFilterChip";
import DirectAwardLimitChip from "@/components/ui/DirectAwardLimitChip";
import {
  DIRECT_AWARD_NEAR_LIMIT_MIN,
  DIRECT_AWARD_NEAR_LIMIT_MAX,
} from "@/config/constants";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; near_direct_award?: string }>;
}

const MIN_FILTER_SKELETON_MS = 350;

function parseYearParam(value?: string): number | undefined {
  if (!value || !/^\d{4}$/.test(value)) return undefined;
  const parsed = Number(value);
  const currentYear = new Date().getFullYear();
  if (parsed < 2000 || parsed > currentYear + 1) return undefined;
  return parsed;
}

function parseNearDirectAwardParam(value?: string): boolean {
  return value === "1";
}

async function ensureMinimumSkeletonDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, MIN_FILTER_SKELETON_MS));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const { organ } = await fetchOrganDetail(decodedId);
  const organName = organ?.nom_organ || decodedId;
  const totalAmount = parseFloat(organ?.total || "0");
  const totalContracts = parseInt(organ?.num_contracts || "0", 10);
  const description = organ
    ? `${formatCompactNumber(totalAmount)} adjudicats en ${formatNumber(totalContracts)} contractes públics per ${organName}.`
    : `Detall dels contractes públics de ${organName}.`;
  const imageUrl = `/organismes/${encodeURIComponent(decodedId)}/opengraph-image`;

  return {
    title: organName,
    description,
    openGraph: {
      title: organName,
      description,
      type: "article",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `Resum de contractació pública de ${organName}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: organName,
      description,
      images: [imageUrl],
    },
  };
}

export default async function OrganDetailPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const decodedId = decodeURIComponent(id);
  const selectedYear = parseYearParam(query.year);
  const nearDirectAwardOnly = parseNearDirectAwardParam(query.near_direct_award);
  const shouldEnforceFilterSkeleton = selectedYear !== undefined || nearDirectAwardOnly;
  const organFilterOptions =
    selectedYear !== undefined || nearDirectAwardOnly
      ? {
          ...(selectedYear !== undefined ? { year: selectedYear } : {}),
          ...(nearDirectAwardOnly ? { nearDirectAwardOnly: true } : {}),
        }
      : undefined;

  const [{ organ, yearly }, recentContracts, nearDirectAwardContractsCount] = await Promise.all([
    fetchOrganDetail(decodedId),
    fetchOrganRecentContracts(decodedId, 10, organFilterOptions),
    fetchOrganNearDirectAwardBandCount(decodedId, organFilterOptions),
  ]);

  if (shouldEnforceFilterSkeleton) {
    await ensureMinimumSkeletonDelay();
  }

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
  const statsYear = selectedYear ?? currentYear;
  const selectedYearRow = yearly.find((row) => parseInt(row.year, 10) === statsYear);
  const yearContracts = selectedYearRow ? parseInt(selectedYearRow.num_contracts, 10) || 0 : 0;
  const yearAmount = selectedYearRow ? parseFloat(selectedYearRow.total) || 0 : 0;
  const isYearFiltered = selectedYear !== undefined;
  const yearContractsSubtitle = isYearFiltered
    ? `Filtre actiu: només contractes de ${statsYear}`
    : selectedYearRow
      ? `Total històric: ${formatNumber(numContracts)}`
      : `Sense dades ${statsYear}. Total històric: ${formatNumber(numContracts)}`;
  const yearAmountSubtitle = isYearFiltered
    ? `Filtre actiu: només import de ${statsYear}`
    : selectedYearRow
      ? `Total històric: ${formatCompactNumber(totalAmount)}`
      : `Sense dades ${statsYear}. Total històric: ${formatCompactNumber(totalAmount)}`;
  const nearDirectAwardBandLabel = `${DIRECT_AWARD_NEAR_LIMIT_MIN.toLocaleString("ca-ES")}-${(DIRECT_AWARD_NEAR_LIMIT_MAX - 1).toLocaleString("ca-ES")} EUR`;
  const nearDirectAwardSubtitle = isYearFiltered
    ? `Emesos a ${statsYear} amb import entre ${nearDirectAwardBandLabel}`
    : `Emesos amb import entre ${nearDirectAwardBandLabel}`;
  const nearDirectAwardHref =
    nearDirectAwardContractsCount > 0 && !nearDirectAwardOnly
      ? `/organismes/${encodeURIComponent(decodedId)}?${new URLSearchParams({
          ...(selectedYear !== undefined ? { year: String(selectedYear) } : {}),
          near_direct_award: "1",
        }).toString()}`
      : undefined;

  const lastAwardDate = getBestAvailableContractDate(
    recentContracts[0]?.data_adjudicacio_contracte,
    recentContracts[0]?.data_formalitzacio_contracte,
    recentContracts[0]?.data_publicacio_anunci
  ).date;

  const topCompaniesBaseAmount = isYearFiltered ? yearAmount : totalAmount;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link href="/organismes" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
        &larr; Tornar a organismes
      </Link>

      <div className="mb-1 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">{organ.nom_organ}</h1>
        <SharePageButton className="shrink-0" />
      </div>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <p className="text-gray-500">Organisme contractant</p>
        {selectedYear !== undefined && <YearFilterChip year={selectedYear} />}
        {nearDirectAwardOnly && <DirectAwardLimitChip />}
      </div>

      <section className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={`Import adjudicat ${statsYear}`}
          value={formatCompactNumber(yearAmount)}
          subtitle={yearAmountSubtitle}
        />
        <StatCard
          title={`Contractes ${statsYear}`}
          value={formatNumber(yearContracts)}
          subtitle={yearContractsSubtitle}
        />
        <StatCard
          title="Contractes prop del límit d'adjudicació directa"
          value={formatNumber(nearDirectAwardContractsCount)}
          subtitle={nearDirectAwardSubtitle}
          valueHref={nearDirectAwardHref}
          valueLinkTitle="Aplica filtre de límit d'adjudicació directa"
        />
      </section>

      <section className="mb-12">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">Evolució anual</h2>
              {selectedYear !== undefined && <YearFilterChip year={selectedYear} />}
              {nearDirectAwardOnly && <DirectAwardLimitChip />}
            </div>
            <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              {yearly.length > 0 ? (
                <YearlyTrendChart data={yearly} enableYearFilter />
              ) : (
                <p className="text-sm text-gray-500">No hi ha prou dades anuals per mostrar la gràfica.</p>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Clica una barra per filtrar tota la pàgina per aquell any. Torna a clicar-la per treure el filtre.
            </p>
          </div>

          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">Contractes recents</h2>
              {selectedYear !== undefined && <YearFilterChip year={selectedYear} />}
              {nearDirectAwardOnly && <DirectAwardLimitChip />}
            </div>
            <div className="rounded-lg border border-gray-100 bg-white shadow-sm overflow-hidden">
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

      <OrganTopCompaniesSection
        organName={organ.nom_organ}
        organTotalAmount={topCompaniesBaseAmount}
        year={selectedYear}
        nearDirectAwardOnly={nearDirectAwardOnly}
      />

      <section>
        <OrganContractsExplorer
          organName={organ.nom_organ}
          year={selectedYear}
          nearDirectAwardOnly={nearDirectAwardOnly}
        />
      </section>
    </div>
  );
}
