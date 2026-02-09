import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchCompanyDetail,
  fetchCompanyContracts,
  fetchCompanyContractsCount,
  fetchCompanyLastAwardDate,
  fetchCompanyTopOrgans,
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
import CompanyContractsExplorer from "@/components/company/CompanyContractsExplorer";
import SharePageButton from "@/components/ui/SharePageButton";
import CompanyCounterpartyTable from "@/components/company/CompanyCounterpartyTable";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const { company } = await fetchCompanyDetail(decodedId);
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
    fetchCompanyDetail(decodedId),
    fetchCompanyContracts(decodedId, 0, 50),
    fetchCompanyContractsCount(decodedId),
    fetchCompanyTopOrgans(decodedId, 10),
    fetchCompanyLastAwardDate(decodedId),
  ]);

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
  const avg = numContracts > 0 ? totalAmount / numContracts : 0;
  const recentContracts = [...contracts]
    .sort((a, b) => {
      const aDate = getBestAvailableContractDate(
        a.data_adjudicacio_contracte,
        a.data_formalitzacio_contracte,
        a.data_publicacio_anunci
      ).date;
      const bDate = getBestAvailableContractDate(
        b.data_adjudicacio_contracte,
        b.data_formalitzacio_contracte,
        b.data_publicacio_anunci
      ).date;
      const aTs = aDate ? new Date(aDate).getTime() : 0;
      const bTs = bDate ? new Date(bDate).getTime() : 0;
      return bTs - aTs;
    })
    .slice(0, 10);

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

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        <StatCard
          title="Import total adjudicat"
          value={formatCompactNumber(totalAmount)}
        />
        <StatCard
          title="Total contractes"
          value={formatNumber(numContracts)}
        />
        <StatCard
          title="Import mitjà"
          value={formatCurrency(avg)}
        />
      </section>

      {/* Yearly + recent contracts */}
      <section className="mb-12">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Evolució anual
            </h2>
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
              {yearly.length > 0 ? (
                <YearlyTrendChart data={yearly} />
              ) : (
                <p className="text-sm text-gray-500">No hi ha prou dades anuals per mostrar la gràfica.</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Contractes recents
            </h2>
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3 text-xs text-gray-500">
                Darrera adjudicació: <span className="font-medium text-gray-700">{formatDate(lastAwardDate)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[520px] w-full table-auto text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="w-[50%] text-left py-2.5 px-3 md:px-4 font-medium text-gray-500">Òrgan</th>
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
                                title={contract.nom_organ || ""}
                                className="block line-clamp-2 break-words leading-6 hover:underline"
                              >
                                {contract.nom_organ || "—"}
                              </a>
                            ) : (
                              <span
                                title={contract.nom_organ || ""}
                                className="block line-clamp-2 break-words leading-6"
                              >
                                {contract.nom_organ || "—"}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 md:px-4 align-top whitespace-nowrap text-gray-700">{formatDate(bestDate.date)}</td>
                          <td className="py-2.5 px-3 md:px-4 align-top text-right whitespace-nowrap text-gray-900 tabular-nums">
                            {contract.import_adjudicacio_sense
                              ? formatCurrency(contract.import_adjudicacio_sense)
                              : "—"}
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
