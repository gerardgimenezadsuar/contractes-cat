import Link from "next/link";
import type { ReactNode } from "react";
import KeyFigures, { type KeyFigure } from "@/components/entity/KeyFigures";

export type { KeyFigure };

export interface HeaderChip {
  label: string;
  value: string;
  mono?: boolean;
  /** Makes the chip a link, e.g. to the company's group. */
  href?: string;
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

const chipClass = "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs text-gray-500";

/**
 * Header strip shared by organ, company and person pages: breadcrumb, eyebrow
 * line, title, identifier chips and the four figures a visitor wants first.
 */
export default function EntityHeader({ backHref, backLabel, eyebrow, title, chips = [], figures, actions }: Props) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)] gap-4 pt-6 pb-2">
      <Link href={backHref} className="text-sm text-gray-500 hover:text-gray-900 w-fit">
        &larr; {backLabel}
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{eyebrow}</p>
          <h1 className="font-display text-3xl font-semibold leading-tight text-gray-900 md:text-4xl [overflow-wrap:anywhere] [text-wrap:balance]">
            {title}
          </h1>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const value = (
              <span title={chip.value} className={`min-w-0 truncate font-medium ${chip.href ? "text-accent" : "text-gray-900"} ${chip.mono ? "font-mono" : ""}`}>
                {chip.value}
              </span>
            );
            return (
              <li key={`${chip.label}-${chip.value}`} className="max-w-full">
                {chip.href ? (
                  <Link href={chip.href} className={`${chipClass} border-accent/30 hover:border-accent`}>
                    {chip.label}
                    {value}
                    <span aria-hidden className="text-accent">
                      &rarr;
                    </span>
                  </Link>
                ) : (
                  <span className={`${chipClass} border-gray-200`}>
                    {chip.label}
                    {value}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {figures.length > 0 ? <KeyFigures figures={figures} /> : null}
    </header>
  );
}
