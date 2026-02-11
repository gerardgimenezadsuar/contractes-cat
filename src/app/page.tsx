import Link from "next/link";
import {
  fetchTotalContracts,
  fetchTotalAmount,
  fetchUniqueCompanies,
  fetchTopCompanies,
  fetchYearlyTrend,
  fetchContractTypeDistribution,
  fetchCpvDistribution,
} from "@/lib/api";
export const revalidate = 21600;
import { formatCompactNumber, formatNumber } from "@/lib/utils";
import StatCard from "@/components/ui/StatCard";
import CompanyBarChart from "@/components/charts/CompanyBarChart";
import YearlyTrendChart from "@/components/charts/YearlyTrendChart";
import ContractTypeChart from "@/components/charts/ContractTypeChart";
import CpvSectorChart from "@/components/charts/CpvSectorChart";
import CompanySearch from "@/components/ui/CompanySearch";
import SharePageButton from "@/components/ui/SharePageButton";

export default async function HomePage() {
  const currentYear = new Date().getFullYear();
  const topCompaniesMinYear = currentYear - 2;
  const [totalContracts, totalAmount, uniqueCompanies, topCompanies, yearlyTrend, contractTypes, cpvSectors] =
    await Promise.all([
      fetchTotalContracts(),
      fetchTotalAmount(),
      fetchUniqueCompanies(),
      fetchTopCompanies(10, { minYear: topCompaniesMinYear, maxYear: currentYear }),
      fetchYearlyTrend(),
      fetchContractTypeDistribution(),
      fetchCpvDistribution(10),
    ]);

  const currentYearRow = yearlyTrend.find((row) => parseInt(row.year, 10) === currentYear);
  const currentYearContracts = currentYearRow ? parseInt(currentYearRow.num_contracts, 10) || 0 : 0;
  const currentYearAmount = currentYearRow ? parseFloat(currentYearRow.total) || 0 : 0;

  const typeChartData = contractTypes.map((d) => ({
    name: d.tipus_contracte,
    value: parseInt(d.total, 10),
    amount: parseFloat(d.amount),
  }));

  return (
    <div>
      {/* Hero + Search */}
      <section className="bg-gradient-to-b from-gray-50 to-white mb-12">
        <div className="max-w-7xl mx-auto px-4 pt-8 pb-0">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h1 className="text-4xl font-bold text-gray-900">
              Contractació pública a Catalunya
            </h1>
            <SharePageButton className="shrink-0" />
          </div>
          <p className="text-lg text-gray-600 max-w-3xl mb-6">
            Anàlisi independent de les dades obertes de la Plataforma de serveis
            de contractació pública de Catalunya. Explora qui rep els contractes
            públics, per quin import i amb quins procediments.
          </p>
          <CompanySearch />
          <p className="text-xs text-gray-400 mt-2">
            Dades del conjunt &quot;Contractació pública a Catalunya&quot; publicat
            a la Plataforma de Transparència. Pot no incloure tots els contractes
            públics de Catalunya.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 pb-8">
      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <StatCard
          title={`Contractes ${currentYear}`}
          value={formatNumber(currentYearContracts)}
          subtitle={`Total dataset: ${formatNumber(totalContracts)}`}
        />
        <StatCard
          title={`Import adjudicat ${currentYear}`}
          value={formatCompactNumber(currentYearAmount)}
          subtitle={`Total dataset: ${formatCompactNumber(totalAmount)}`}
        />
        <StatCard
          title="Empreses adjudicatàries"
          value={formatNumber(uniqueCompanies)}
        />
        <StatCard
          title="Total contractes al dataset"
          value={formatNumber(totalContracts)}
          subtitle="Publicats a la plataforma"
        />
      </section>

      {/* Top Companies */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Top 10 empreses per import adjudicat ({topCompaniesMinYear}-{currentYear})
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Basat en la data d&apos;adjudicació del contracte.
            </p>
          </div>
          <Link
            href="/empreses"
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Veure totes
          </Link>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <CompanyBarChart data={topCompanies} />
        </div>
      </section>

      {/* Two-column: Yearly trend + Contract types */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Evolució anual
          </h2>
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
            <YearlyTrendChart data={yearlyTrend} />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            L&apos;increment dels primers anys reflecteix l&apos;adopció progressiva del registre digital, no un augment real de la despesa. Les dades dels últims 5 anys són les més representatives.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Per tipus de contracte
          </h2>
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
            <ContractTypeChart data={typeChartData} />
          </div>
        </div>
      </section>

      {/* CPV Sector distribution */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Top sectors econòmics (CPV)
          </h2>
          <Link
            href="/analisi"
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Veure anàlisi completa
          </Link>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <CpvSectorChart data={cpvSectors} />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Classificació segons el Vocabulari Comú de Contractació Pública (CPV).
          Només contractes amb codi CPV informat.
        </p>
      </section>

      {/* Quick Links */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link
          href="/empreses"
          className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Empreses
          </h3>
          <p className="text-sm text-gray-600">
            Rànquing d&apos;empreses per import total de contractes adjudicats.
            Cerca per nom o NIF.
          </p>
        </Link>
        <Link
          href="/organismes"
          className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Organismes
          </h3>
          <p className="text-sm text-gray-600">
            Rànquing d&apos;organismes per import adjudicat, amb detall anual i
            contractes recents.
          </p>
        </Link>
        <Link
          href="/contractes"
          className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Contractes
          </h3>
          <p className="text-sm text-gray-600">
            Explora tots els contractes amb filtres per any, tipus, procediment
            i import.
          </p>
        </Link>
        <Link
          href="/analisi"
          className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Anàlisi
          </h3>
          <p className="text-sm text-gray-600">
            Anàlisi del llindar de contractes menors (15.000 EUR) i
            distribucions per tipus i procediment.
          </p>
        </Link>
      </section>
      </div>
    </div>
  );
}
