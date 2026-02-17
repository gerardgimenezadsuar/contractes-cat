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
import CompanyBarChart from "@/components/charts/CompanyBarChart";
import YearlyTrendChart from "@/components/charts/YearlyTrendChart";
import CompanySearch from "@/components/ui/CompanySearch";

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

  const topAjuntaments = topOrgans2024to2026.filter((row) => isAjuntament(row.nom_organ)).slice(0, 5);
  const topAltresOrgans = topOrgans2024to2026.filter((row) => !isAjuntament(row.nom_organ)).slice(0, 5);

  return (
    <div>
      <section className="mb-10 bg-gradient-to-b from-gray-50 to-white">
        <div className="mx-auto max-w-7xl px-4 pb-1 pt-8">
          <div className="relative mb-3">
            <h1 className="text-3xl font-bold text-gray-900 text-center sm:text-4xl">
              Observatori independent de contractació pública
            </h1>
          </div>
          <p className="mb-4 text-center text-sm text-gray-700 sm:text-base">
            Busca directament empreses i organismes per supervisar activitat i imports adjudicats.
          </p>
          <div className="mb-2 flex justify-center">
            <CompanySearch />
          </div>
          <div className="mb-2 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500">
            <Link href="/empreses" className="underline hover:text-gray-800">Rànquing empreses</Link>
            <Link href="/organismes" className="underline hover:text-gray-800">Rànquing organismes</Link>
            <Link href="/contractes" className="underline hover:text-gray-800">Explorador contractes</Link>
          </div>
          <p className="text-center text-xs text-gray-400">
            Dades obertes de la Plataforma de Transparència de Catalunya.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-8">
        <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <StatCard title="Empreses adjudicatàries" value={formatNumber(uniqueCompanies)} />
          <StatCard
            title="Total contractes al dataset"
            value={formatNumber(totalContracts)}
            subtitle="Publicats a la plataforma"
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
              <CompanyBarChart data={topCompanies} />
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
                    <tbody>
                      {topAjuntaments.map((organ, index) => (
                        <tr key={`${organ.nom_organ}-${index}`} className="border-b border-gray-100 last:border-b-0">
                          <td className="px-2 py-2 text-xs text-gray-500">{index + 1}</td>
                          <td className="px-1 py-2 text-gray-700">{organ.nom_organ}</td>
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
                    <tbody>
                      {topAltresOrgans.map((organ, index) => (
                        <tr key={`${organ.nom_organ}-${index}`} className="border-b border-gray-100 last:border-b-0">
                          <td className="px-2 py-2 text-xs text-gray-500">{index + 1}</td>
                          <td className="px-1 py-2 text-gray-700">{organ.nom_organ}</td>
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
              <YearlyTrendChart data={yearlyTrend} />
            </div>
            <p className="mt-2 text-xs text-gray-400">
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
                      <th className="w-[10%] px-3 py-2 text-left font-medium text-gray-500">#</th>
                      <th className="w-[44%] px-3 py-2 text-left font-medium text-gray-500">Sector</th>
                      <th className="w-[12%] px-3 py-2 text-left font-medium text-gray-500">Codi</th>
                      <th className="w-[19%] px-3 py-2 text-right font-medium text-gray-500">Import</th>
                      <th className="w-[15%] px-3 py-2 text-right font-medium text-gray-500">Contractes</th>
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
                    </a>
                  ) : (
                    <p className="line-clamp-2 text-sm font-medium text-gray-900">{c.denominacio || "—"}</p>
                  )}
                  <p className="mt-1 line-clamp-2 text-xs text-gray-600">{c.denominacio_adjudicatari || "—"}</p>
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
                  <th className="w-[14%] px-4 py-3 text-left font-medium text-gray-500">Data ref.</th>
                  <th className="w-[24%] px-4 py-3 text-left font-medium text-gray-500">Denominació</th>
                  <th className="w-[19%] px-4 py-3 text-left font-medium text-gray-500">Adjudicatari</th>
                  <th className="w-[23%] px-4 py-3 text-left font-medium text-gray-500">Organisme</th>
                  <th className="w-[10%] px-4 py-3 text-right font-medium text-gray-500">Import (IVA)</th>
                  <th className="w-[10%] px-4 py-3 text-left font-medium text-gray-500">Tipus</th>
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
                          </a>
                        ) : (
                          c.denominacio || "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700" title={c.denominacio_adjudicatari || ""}>{c.denominacio_adjudicatari || "—"}</td>
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

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/empreses"
            className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md"
          >
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Empreses</h3>
            <p className="text-sm text-gray-600">
              Rànquing d&apos;empreses per import total de contractes adjudicats. Cerca per nom o NIF.
            </p>
          </Link>
          <Link
            href="/organismes"
            className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md"
          >
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Organismes</h3>
            <p className="text-sm text-gray-600">
              Rànquing d&apos;organismes per import adjudicat, amb detall anual i contractes recents.
            </p>
          </Link>
          <Link
            href="/contractes"
            className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md"
          >
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Contractes</h3>
            <p className="text-sm text-gray-600">
              Explora tots els contractes amb filtres per any, tipus, procediment i import.
            </p>
          </Link>
          <Link
            href="/analisi"
            className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md"
          >
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Anàlisi</h3>
            <p className="text-sm text-gray-600">
              Detecció de patrons, llindars de contractes menors i focus en transparència.
            </p>
          </Link>
        </section>
      </div>
    </div>
  );
}
