import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import {
  fetchCompanyDetail,
  fetchCompanyContracts,
  fetchCompanyContractsCount,
  fetchCompanyLastAwardDate,
  fetchCompanyTopOrgans,
} from "@/lib/api";
import {
  formatNumber,
  formatCompactNumber,
} from "@/lib/utils";
import StatCard from "@/components/ui/StatCard";
import { YearlyTrendChartLazy } from "@/components/charts/LazyCharts";
import CompanyContractsExplorer from "@/components/company/CompanyContractsExplorer";
import SharePageButton from "@/components/ui/SharePageButton";
import CompanyCounterpartyTable from "@/components/company/CompanyCounterpartyTable";
import BormeSummaryCard from "@/components/company/BormeSummaryCard";
import { loadAdminHistory } from "@/lib/borme";

export const revalidate = 21600;

interface Props {
  params: Promise<{ id: string }>;
}

const getCompanyDetail = cache(async (id: string) => fetchCompanyDetail(id));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const { company } = await getCompanyDetail(decodedId);
  const companyName = company?.denominacio_adjudicatari || decodedId;
  const totalAmount = parseFloat(company?.total || "0");
  const totalContracts = parseInt(company?.num_contracts || "0", 10);
  const description = company
    ? `${formatCompactNumber(totalAmount)} adjudicats en ${formatNumber(
        totalContracts
      )} contractes públics a ${companyName}.`
    : `Detall dels contractes públics adjudicats a ${companyName}.`;
  const imageUrl = `/empreses/${encodeURIComponent(decodedId)}/opengraph-image`;

  return {
    title: companyName,
    description,
    openGraph: {
      title: companyName,
      description,
      type: "article",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `Resum de contractació pública de ${companyName}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: companyName,
      description,
      images: [imageUrl],
    },
  };
}

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  const [{ company, yearly }, contracts, contractsCount, topOrgans, lastAwardDate] = await Promise.all([
    getCompanyDetail(decodedId),
    fetchCompanyContracts(decodedId, 0, 50),
    fetchCompanyContractsCount(decodedId),
    fetchCompanyTopOrgans(decodedId, 10),
    fetchCompanyLastAwardDate(decodedId),
  ]);

  const adminHistory = await loadAdminHistory(decodedId);
  const hasBormeData = Boolean(adminHistory && adminHistory.spans.length > 0);

  if (!company) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-500">No s&apos;ha trobat l&apos;empresa.</p>
        <Link href="/empreses" className="text-blue-600 hover:underline mt-4 inline-block">
          Tornar a empreses
        </Link>
      </div>
    );
  }

  const totalAmount = parseFloat(company.total);
  const numContracts = parseInt(company.num_contracts, 10);
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link
        href="/empreses"
        className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block"
      >
        &larr; Tornar a empreses
      </Link>

      <div className="mb-1 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">
          {company.denominacio_adjudicatari}
        </h1>
        <SharePageButton className="shrink-0" />
      </div>
      <p className="text-gray-500 font-mono mb-8">
        NIF: {company.identificacio_adjudicatari}
      </p>

      <section
        className={`mb-10 ${
          hasBormeData
            ? "grid grid-cols-1 xl:grid-cols-12 gap-6 items-start"
            : "flex justify-center"
        }`}
      >
        <div className={`${hasBormeData ? "xl:col-span-7" : "w-full xl:max-w-4xl"}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard
              title={`Import adjudicat ${currentYear}`}
              value={formatCompactNumber(currentYearAmount)}
              subtitle={currentYearAmountSubtitle}
              compact
            />
            <StatCard
              title={`Contractes ${currentYear}`}
              value={formatNumber(currentYearContracts)}
              subtitle={currentYearContractsSubtitle}
              compact
            />
          </div>

          <div className="mt-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Evolució anual</h2>
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
              {yearly.length > 0 ? (
                <YearlyTrendChartLazy data={yearly} />
              ) : (
                <p className="text-sm text-gray-500">No hi ha prou dades anuals per mostrar la gràfica.</p>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-5 space-y-4">
          {hasBormeData && (
            <BormeSummaryCard
              spans={adminHistory?.spans || []}
              matchedName={adminHistory?.matched_name || ""}
              compact
            />
          )}
        </div>
      </section>

      {/* Counterparties */}
      {topOrgans.length > 0 && (
        <CompanyCounterpartyTable
          rows={topOrgans}
          companyTotalAmount={totalAmount}
          lastAwardDate={lastAwardDate}
        />
      )}

      {/* Full contracts with pagination */}
      <section>
        <CompanyContractsExplorer
          nif={company.identificacio_adjudicatari}
          initialContracts={contracts}
          totalContracts={contractsCount}
        />
      </section>
    </div>
  );
}
