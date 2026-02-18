import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchThresholdDistribution,
  fetchMinorBandSummary,
  fetchTopOrgansInMinorRiskBand,
  fetchTopCompaniesInMinorRiskBand,
  fetchMinorShareYearly,
} from "@/lib/api";
import { formatNumber, formatCompactNumber, formatCurrency } from "@/lib/utils";
import {
  MinorShareTrendChartLazy,
  ThresholdChartLazy,
} from "@/components/charts/LazyCharts";
import StatCard from "@/components/ui/StatCard";
import SharePageButton from "@/components/ui/SharePageButton";

export const metadata: Metadata = {
  title: "Anàlisi",
  description:
    "Monitoratge ciutadà de contractes menors: risc de concentració al llindar i pes dels menors sobre el total de contractació.",
};

function estimateExpectedRiskBandCount(
  buckets: { range_start: number; range_end: number; count: number }[]
): number | null {
  const baseline = buckets.filter((b) => b.range_start < 14500 && b.count > 0);
  if (baseline.length < 6) return null;

  const points = baseline.map((b) => ({
    x: (b.range_start + b.range_end) / 2,
    y: Math.log(b.count),
  }));
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const expectedCountForFinal500 = Math.exp(intercept + slope * 14750);
  const expectedCountFor14900To15000 = expectedCountForFinal500 * 0.2;

  if (!Number.isFinite(expectedCountFor14900To15000)) return null;
  return Math.max(0, expectedCountFor14900To15000);
}

export default async function AnalisiPage() {
  const [
    thresholdData,
    bandSummary,
    topRiskOrgans,
    topRiskCompanies,
    minorShareYearly,
  ] = await Promise.all([
    fetchThresholdDistribution(),
    fetchMinorBandSummary(),
    fetchTopOrgansInMinorRiskBand(15),
    fetchTopCompaniesInMinorRiskBand(15),
    fetchMinorShareYearly(),
  ]);

  const totalMinorUnder15k = bandSummary.total_minor_under_15k;
  const riskBandCount = bandSummary.risk_band_14900_15000;
  const riskBandPct =
    totalMinorUnder15k > 0 ? (riskBandCount / totalMinorUnder15k) * 100 : null;
  const oneInN = riskBandCount > 0 ? Math.round(totalMinorUnder15k / riskBandCount) : null;
  const riskBandAmount = bandSummary.risk_band_14900_15000_amount;
  const riskBandAvgAmount = riskBandCount > 0 ? riskBandAmount / riskBandCount : null;
  const expectedRiskBandCount = estimateExpectedRiskBandCount(thresholdData);
  const expectedRiskBandAmount =
    expectedRiskBandCount !== null && riskBandAvgAmount !== null
      ? expectedRiskBandCount * riskBandAvgAmount
      : null;
  const excessRiskBandCount =
    expectedRiskBandCount !== null ? riskBandCount - expectedRiskBandCount : null;
  const excessRiskBandAmount =
    expectedRiskBandAmount !== null ? riskBandAmount - expectedRiskBandAmount : null;

  const currentYear = new Date().getFullYear();
  const lastCompleteYear = currentYear - 1;
  const minorShareYearlyComplete = minorShareYearly.filter(
    (year) => Number(year.year) <= lastCompleteYear
  );
  const hiddenFutureYears = minorShareYearly.filter(
    (year) => Number(year.year) > lastCompleteYear
  );

  const totals = minorShareYearlyComplete.reduce(
    (acc, year) => ({
      totalContracts: acc.totalContracts + year.total_contracts,
      minorContracts: acc.minorContracts + year.minor_contracts,
      totalAmount: acc.totalAmount + year.total_amount,
      minorAmount: acc.minorAmount + year.minor_amount,
    }),
    { totalContracts: 0, minorContracts: 0, totalAmount: 0, minorAmount: 0 }
  );

  const overallMinorContractsShare =
    totals.totalContracts > 0
      ? (totals.minorContracts / totals.totalContracts) * 100
      : null;
  const overallMinorAmountShare =
    totals.totalAmount > 0 ? (totals.minorAmount / totals.totalAmount) * 100 : null;

  const latestYear = minorShareYearlyComplete[minorShareYearlyComplete.length - 1];
  const previousYear =
    minorShareYearlyComplete.length > 1
      ? minorShareYearlyComplete[minorShareYearlyComplete.length - 2]
      : undefined;
  const deltaLatestPct =
    latestYear && previousYear
      ? latestYear.minor_contracts_share - previousYear.minor_contracts_share
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Anàlisi ciutadana</h1>
        <SharePageButton className="shrink-0" />
      </div>
      <p className="text-gray-600 mb-4">
        Aquesta pàgina prioritza dues preguntes: si hi ha concentració de
        contractes menors just per sota de 15.000 EUR i quin pes tenen els
        contractes menors dins del conjunt de la contractació pública.
      </p>
      <div className="mb-10 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-900">
          Metodologia: per coherència estadística, tots els indicadors d&apos;aquesta
          pàgina exclouen contractes amb import inferior a 500 EUR.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          1) Senyal de risc al llindar dels 15.000 EUR
        </h2>
        <p className="text-gray-600 mb-5">
          Monitoritzem explícitament el percentatge de contractes menors
          adjudicats entre 14.900 i 14.999,99 EUR (sense IVA).
        </p>

        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">Lectura ràpida</p>
          <p className="mt-1 text-sm text-red-800">
            {riskBandPct !== null
              ? `${riskBandPct.toFixed(2)}% dels contractes menors (500-14.999,99 EUR) cauen dins la franja 14.900-14.999,99 EUR (${formatNumber(riskBandCount)} contractes${
                  oneInN ? `, aproximadament 1 de cada ${oneInN}` : ""
                }).`
              : "No hi ha dades suficients per calcular aquest indicador."}
          </p>
          <p className="mt-1 text-xs text-red-700">
            Aquesta concentració és un indicador de risc i no és, per si sola,
            una prova de fraccionament o irregularitat.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 lg:max-w-6xl lg:mx-auto">
          <StatCard
            title="Menors analitzats"
            value={formatNumber(totalMinorUnder15k)}
            subtitle="Contractes entre 500 i 14.999,99 EUR"
          />
          <StatCard
            title="Franja 14.900-14.999,99"
            value={formatNumber(riskBandCount)}
            subtitle="Nombre de contractes en la franja monitoritzada"
          />
          <StatCard
            title="Import a la franja"
            value={formatCurrency(riskBandAmount)}
            subtitle="Total adjudicat entre 14.900 i 14.999,99 EUR"
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <ThresholdChartLazy data={thresholdData} />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          El gràfic mostra la distribució en trams de 500 EUR. La franja
          monitoritzada (14.900-14.999,99 EUR) és una part del darrer tram
          14.500-15.000 EUR.
        </p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            {expectedRiskBandCount !== null && expectedRiskBandAmount !== null
              ? `Si la cua seguís una forma suau de tipus exponencial (sense acumulació al llindar), esperaríem aproximadament ${formatNumber(Math.round(expectedRiskBandCount))} contractes a la franja 14.900-14.999,99 EUR (entorn de ${formatCompactNumber(expectedRiskBandAmount)}). Observem ${formatNumber(riskBandCount)} contractes per ${formatCompactNumber(riskBandAmount)}. Això són ${formatNumber(Math.round(Math.max(0, excessRiskBandCount || 0)))} contractes i ${formatCompactNumber(Math.max(0, excessRiskBandAmount || 0))} per sobre de l'esperat.`
              : `La concentració al tram 14.900-14.999,99 EUR es manté com a senyal de risc, però no hi ha prou estabilitat estadística per estimar un valor esperat robust.`}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Interpretació prudent: és un indicador de possible menor competència
            mitjana en l&apos;adjudicació, no una prova automàtica de frau ni
            d&apos;irregularitat en cada contracte.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Organismes i empreses més presents en la franja 14.900-14.999,99
        </h2>
        <p className="text-gray-600 mb-5">
          Transparència per prioritzar revisió pública: aquests rànquings
          mostren volum en la franja de risc, no culpabilitat.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-x-auto">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Top organismes</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Organisme</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Contractes</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 whitespace-nowrap w-32">
                    Import
                  </th>
                </tr>
              </thead>
              <tbody>
                {topRiskOrgans.map((row, idx) => (
                  <tr key={`${row.name}-${idx}`} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-gray-400">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/contractes?nom_organ=${encodeURIComponent(row.name)}&amountMin=14900&amountMax=14999.99&procediment=${encodeURIComponent("Contracte menor")}`}
                        className="hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-right">{formatNumber(row.num_contracts)}</td>
                    <td className="py-3 px-4 text-right font-mono whitespace-nowrap w-32">
                      {formatCompactNumber(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-x-auto">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Top empreses</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Empresa</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Contractes</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Import</th>
                </tr>
              </thead>
              <tbody>
                {topRiskCompanies.map((row, idx) => (
                  <tr
                    key={`${row.identificacio_adjudicatari}-${idx}`}
                    className="border-b border-gray-100"
                  >
                    <td className="py-3 px-4 text-gray-400">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/contractes?search=${encodeURIComponent(row.denominacio_adjudicatari)}&amountMin=14900&amountMax=14999.99&procediment=${encodeURIComponent("Contracte menor")}`}
                        className="hover:underline"
                      >
                        {row.denominacio_adjudicatari}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-right">{formatNumber(row.num_contracts)}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      {formatCompactNumber(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          2) Pes dels contractes menors sobre el total
        </h2>
        <p className="text-gray-600 mb-5">
          Si el pes dels menors creix, hi ha menys contractació competitiva
          relativa. Aquesta sèrie ajuda a seguir aquest canvi en el temps.
        </p>
        <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm text-gray-700">
            Mostrem només anys complets (fins al {lastCompleteYear}).{" "}
            {hiddenFutureYears.length > 0
              ? `S'han ocultat ${hiddenFutureYears.length} observacions amb any ${currentYear} o posterior perquè poden ser parcials o contenir dates futures.`
              : `No hi ha observacions posteriors a ${lastCompleteYear}.`}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            L&apos;històric anterior a 2020 és limitat (especialment en
            contractes menors). Per interpretar tendència, prioritzem sobretot
            els darrers 3 anys.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total contractes"
            value={formatNumber(totals.totalContracts)}
            subtitle={`Tots els procediments (>=500 EUR), anys complets fins ${lastCompleteYear}`}
          />
          <StatCard
            title="Contractes menors"
            value={formatNumber(totals.minorContracts)}
            subtitle={`Procediment: Contracte menor, anys complets fins ${lastCompleteYear}`}
          />
          <StatCard
            title="% menors (número)"
            value={
              overallMinorContractsShare !== null
                ? `${overallMinorContractsShare.toFixed(1)}%`
                : "—"
            }
            subtitle="Pes sobre el total de contractes"
          />
          <StatCard
            title="% menors (import)"
            value={
              overallMinorAmountShare !== null ? `${overallMinorAmountShare.toFixed(1)}%` : "—"
            }
            subtitle="Pes sobre l'import total adjudicat"
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <MinorShareTrendChartLazy data={minorShareYearlyComplete} />
        </div>

        <p className="text-xs text-gray-500 mt-2">
          {latestYear
            ? `Darrera observació: ${latestYear.year}. El pes dels menors en nombre és del ${latestYear.minor_contracts_share.toFixed(1)}%${
                deltaLatestPct !== null
                  ? ` (${deltaLatestPct >= 0 ? "+" : ""}${deltaLatestPct.toFixed(1)} punts respecte ${previousYear?.year}).`
                  : "."
              }`
            : "No hi ha prou dades anuals per mostrar tendència."}
        </p>
      </section>
    </div>
  );
}
