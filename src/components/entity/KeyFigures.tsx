export interface KeyFigure {
  label: string;
  value: string;
  /** Smaller text after the value, e.g. a unit. */
  unit?: string;
  note?: string;
}

/**
 * The row of headline figures used by the home page and the entity headers:
 * one bordered strip split by hairlines, two columns on phones and four from md.
 */
export default function KeyFigures({ figures, className = "" }: { figures: KeyFigure[]; className?: string }) {
  return (
    <dl className={`grid grid-cols-2 overflow-hidden rounded-lg border border-gray-200 bg-white md:grid-cols-4 ${className}`}>
      {figures.map((figure, index) => (
        <div
          key={figure.label}
          className={`min-w-0 px-4 py-3 ${index % 2 === 1 ? "border-l border-gray-200" : ""} ${
            index >= 2 ? "border-t border-gray-200 md:border-t-0 md:border-l" : ""
          }`}
        >
          <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">{figure.label}</dt>
          <dd className="mt-0.5 font-display text-xl font-semibold sm:text-2xl leading-tight text-gray-900 tabular-nums">
            {figure.value}
            {figure.unit ? <span className="ml-1 font-sans text-sm font-normal text-gray-500">{figure.unit}</span> : null}
          </dd>
          {figure.note ? <dd className="mt-0.5 text-xs text-gray-500">{figure.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
