import type { Indicator, Tone } from "@/lib/indicators";

const TONE_CLASSES: Record<Tone, string> = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  neutral: "bg-accent-soft text-gray-700",
};

export function IndicatorCard({ indicator }: { indicator: Indicator }) {
  return (
    <article className="grid content-start gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-3.5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">{indicator.label}</h3>
      <p className="font-display text-3xl font-semibold leading-none text-gray-900 tabular-nums">
        {indicator.value}
        {indicator.qualifier ? (
          <span className="ml-1.5 font-sans text-sm font-normal text-gray-500">{indicator.qualifier}</span>
        ) : null}
      </p>
      <p className="text-sm text-gray-700">{indicator.sentence}</p>
      {indicator.comparison ? (
        <span className={`w-fit rounded px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[indicator.comparison.tone]}`}>
          {indicator.comparison.label}
        </span>
      ) : null}
      {indicator.source ? <p className="text-xs text-gray-500">{indicator.source}</p> : null}
    </article>
  );
}

export function IndicatorGrid({ indicators, columns = 3 }: { indicators: Indicator[]; columns?: 2 | 3 }) {
  if (indicators.length === 0) return null;
  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${columns === 3 ? "xl:grid-cols-3" : ""}`}>
      {indicators.map((indicator) => (
        <IndicatorCard key={indicator.key} indicator={indicator} />
      ))}
    </div>
  );
}
