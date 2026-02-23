import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { getPersonAwardeeTargets, loadPersonProfile } from "@/lib/borme";
import { fetchContractsByAwardeesSummary } from "@/lib/api";
import { formatCompactNumber, formatDate, formatNumber } from "@/lib/utils";
import StatCard from "@/components/ui/StatCard";
import SharePageButton from "@/components/ui/SharePageButton";
import PersonContractsExplorer from "@/components/person/PersonContractsExplorer";

export const revalidate = 21600;

interface Props {
  params: Promise<{ name: string }>;
}

const getPersonProfile = cache(async (name: string) => loadPersonProfile(name));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  return {
    title: decodedName,
    description: `Informacio societaria de ${decodedName} segons BORME.`,
  };
}

export default async function PersonDetailPage({ params }: Props) {
  const { name } = await params;
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

  const targets = getPersonAwardeeTargets(profile);
  const contractsSummary =
    targets.nifs.length > 0
      ? await fetchContractsByAwardeesSummary({ nifs: targets.nifs })
      : { total: 0, totalAmount: 0 };
  const activeCompanies = profile.companies.filter((c) => c.active_spans > 0).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
        &larr; Tornar a inici
      </Link>

      <div className="mb-1 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">{profile.person_name}</h1>
        <SharePageButton className="shrink-0" />
      </div>
      <p className="text-gray-600 mb-8">
        Vinculacions societàries extretes del BORME. Primer es mostra la informació legal i després els contractes públics de les empreses vinculades.
      </p>

      <section className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Empreses vinculades" value={formatNumber(profile.num_companies)} compact />
        <StatCard title="Empreses amb NIF" value={formatNumber(profile.num_companies_with_nif)} compact />
        <StatCard title="Empreses amb càrrecs actius" value={formatNumber(activeCompanies)} compact />
        <StatCard
          title="Contractes vinculats"
          value={formatNumber(contractsSummary.total)}
          subtitle={`Import total: ${formatCompactNumber(contractsSummary.totalAmount)}`}
          compact
        />
      </section>

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
                            href={`/empreses/${encodeURIComponent(company.nif)}`}
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

      <section>
        <PersonContractsExplorer
          personName={profile.person_name}
          personNifs={targets.nifs}
          initialContracts={[]}
          initialTotalContracts={contractsSummary.total}
          initialTotalAmount={contractsSummary.totalAmount}
          hasNifTargets={targets.nifs.length > 0}
        />
      </section>
    </div>
  );
}
