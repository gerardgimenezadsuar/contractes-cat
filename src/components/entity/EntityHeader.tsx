import Link from "next/link";
import type { ReactNode } from "react";

export interface HeaderChip {
  label: string;
  value: string;
  mono?: boolean;
}

export interface KeyFigure {
  label: string;
  value: string;
  /** Smaller text after the value, e.g. a unit. */
  unit?: string;
  note?: string;
}

interface Props {
  backHref: string;
  backLabel: string;
  eyebrow: ReactNode;
  title: string;
  chips?: HeaderChip[];
  figures: KeyFigure[];
  actions?: ReactNode;
}

/**
 * Header strip shared by organ and company pages: breadcrumb, eyebrow line,
 * title, identifier chips and the four figures a visitor wants first.
 */
export default function EntityHeader({ backHref, backLabel, eyebrow, title, chips = [], figures, actions }: Props) {
  return (
    <header className="grid gap-4 pt-6 pb-2">
      <Link href={backHref} className="text-sm text-gray-500 hover:text-gray-900 w-fit">
        &larr; {backLabel}
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{eyebrow}</p>
          <h1 className="font-display text-3xl font-semibold leading-tight text-gray-900 md:text-4xl [text-wrap:balance]">
            {title}
          </h1>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li
              key={`${chip.label}-${chip.value}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-500"
            >
              {chip.label}
              <span className={`font-medium text-gray-900 ${chip.mono ? "font-mono" : ""}`}>{chip.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-gray-200 bg-white md:grid-cols-4">
        {figures.map((figure, index) => (
          <div
            key={figure.label}
            className={`min-w-0 px-4 py-3 ${index % 2 === 1 ? "border-l border-gray-200" : ""} ${
              index >= 2 ? "border-t border-gray-200 md:border-t-0 md:border-l" : ""
            }`}
          >
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">{figure.label}</dt>
            <dd className="mt-0.5 font-display text-2xl font-semibold leading-tight text-gray-900 tabular-nums">
              {figure.value}
              {figure.unit ? <span className="ml-1 font-sans text-sm font-normal text-gray-500">{figure.unit}</span> : null}
            </dd>
            {figure.note ? <dd className="mt-0.5 text-xs text-gray-500">{figure.note}</dd> : null}
          </div>
        ))}
      </dl>
    </header>
  );
}
