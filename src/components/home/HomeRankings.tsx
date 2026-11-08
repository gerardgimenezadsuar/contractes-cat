"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { trackEvent } from "@/lib/analytics";

export interface RankRow {
  name: string;
  href?: string;
  amount: number;
  amountLabel: string;
  /** Second figure, e.g. "1.204 contractes" or "6 empreses". */
  detail: string;
}

export interface RankTab {
  id: string;
  label: string;
  /** What the figures cover, e.g. "Import adjudicat 2024-2026, IVA inclòs". */
  period: string;
  rows: RankRow[];
  moreHref: string;
  moreLabel: string;
}

/**
 * One ranking with tabs instead of separate charts and tables. Every panel is
 * rendered (inactive ones hidden) so all the links are in the HTML for search
 * engines and work before hydration.
 */
export default function HomeRankings({ tabs }: { tabs: RankTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const baseId = useId();
  if (tabs.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-gray-900 sm:text-2xl">Qui concentra més contractes</h2>
        <div
          role="tablist"
          aria-label="Rànquing"
          className="-mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:px-0"
        >
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {tabs.map((tab) => {
              const selected = tab.id === active;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel-${tab.id}`}
                  onClick={() => {
                    setActive(tab.id);
                    trackEvent("home_ranking_tab", { tab: tab.id });
                  }}
                  className={`min-h-9 shrink-0 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                    selected ? "bg-white text-accent shadow-sm" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {tabs.map((tab) => {
        const max = Math.max(...tab.rows.map((r) => r.amount), 1);
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${baseId}-panel-${tab.id}`}
            aria-labelledby={`${baseId}-tab-${tab.id}`}
            hidden={tab.id !== active}
          >
            <ol className="border-t border-gray-900">
              {tab.rows.map((row, index) => {
                const name = row.href ? (
                  <Link href={row.href} className="font-medium text-gray-900 hover:text-accent hover:underline">
                    {row.name}
                  </Link>
                ) : (
                  <span className="font-medium text-gray-900">{row.name}</span>
                );
                return (
                  <li
                    key={`${tab.id}-${index}-${row.name}`}
                    className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-gray-200 py-2.5 text-sm md:grid-cols-[1.5rem_minmax(0,1fr)_9rem_6.5rem_7.5rem]"
                  >
                    <span className="font-mono text-xs text-gray-400 tabular-nums">{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate">{name}</span>
                      <span className="block text-xs text-gray-500 md:hidden">{row.detail}</span>
                    </span>
                    <span className="hidden h-1.5 rounded-full bg-accent-soft md:block" aria-hidden>
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (row.amount / max) * 100)}%` }} />
                    </span>
                    <span className="whitespace-nowrap text-right font-medium text-gray-900 tabular-nums">{row.amountLabel}</span>
                    <span className="hidden whitespace-nowrap text-right text-gray-500 tabular-nums md:block">{row.detail}</span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-xs text-gray-500">
              <span>{tab.period}</span>
              <Link href={tab.moreHref} className="text-sm font-medium text-accent hover:underline">
                {tab.moreLabel} &rarr;
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
