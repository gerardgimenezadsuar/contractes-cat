import Link from "next/link";
import type { ThresholdBucket } from "@/lib/types";
import { ThresholdChartLazy } from "@/components/charts/LazyCharts";
import { formatNumber } from "@/lib/utils";

/** Below this many minor contracts the histogram is noise. */
export const MIN_MINOR_CONTRACTS = 100;
/** The last 500 EUR before the 15,000 EUR limit for minor service and supply contracts. */
const LAST_BAND_START = 14500;

interface Props {
  organ: ThresholdBucket[];
  catalonia: ThresholdBucket[];
}

function lastBandShare(buckets: ThresholdBucket[]): { share: number; inBand: number; total: number } {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const inBand = buckets.filter((b) => b.range_start >= LAST_BAND_START).reduce((sum, b) => sum + b.count, 0);
  return { share: total > 0 ? inBand / total : 0, inBand, total };
}

function pct(v: number): string {
  return `${(v * 100).toLocaleString("ca-ES", { maximumFractionDigits: 1 })} %`;
}

export function organThresholdTotal(buckets: ThresholdBucket[]): number {
  return buckets.reduce((sum, b) => sum + b.count, 0);
}

/**
 * Minor contracts of one public body by amount, up to the 15,000 EUR limit,
 * with the share in the last 500 EUR compared with all of Catalonia. A pile-up
 * just below the limit can point to contracts split to avoid a tender, but it
 * also has ordinary explanations, so the text describes and does not judge.
 */
export default function OrganThresholdBlock({ organ, catalonia }: Props) {
  const own = lastBandShare(organ);
  if (own.total < MIN_MINOR_CONTRACTS) return null;
  const base = lastBandShare(catalonia);
  const ratio = base.share > 0 ? own.share / base.share : null;
  const above = ratio !== null && ratio >= 1.5;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-gray-900">Contractes menors a prop del límit</h2>
        <Link href="/analisi" className="shrink-0 text-sm text-accent hover:underline">
          Anàlisi a Catalunya
        </Link>
      </div>
      <p className="mb-3 max-w-4xl text-sm text-gray-600">
        {formatNumber(own.inBand)} dels {formatNumber(own.total)} contractes menors de menys de 15.000 € (sense IVA) d&apos;aquest
        organisme, el <strong className="font-semibold text-gray-900">{pct(own.share)}</strong>, són entre 14.500 i 15.000 €. A
        tot Catalunya és el {pct(base.share)}
        {ratio !== null && above ? (
          <>
            : <strong className="font-semibold text-gray-900">{ratio.toLocaleString("ca-ES", { maximumFractionDigits: 1 })} vegades més</strong>
          </>
        ) : null}
        . Una acumulació just per sota del límit pot indicar contractes fraccionats per evitar una licitació, però també té
        explicacions habituals, com tarifes o pressupostos ajustats al màxim permès.
      </p>
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <ThresholdChartLazy data={organ} />
      </div>
    </div>
  );
}
