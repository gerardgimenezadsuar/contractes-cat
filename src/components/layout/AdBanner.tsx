"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";

const LICITABOT_URL =
  "https://licitabot.net/?utm_source=contractes.cat&utm_medium=banner&utm_campaign=site_promo&utm_content=home_top";

export default function AdBanner() {
  return (
    <aside
      aria-label="Anunci patrocinat"
      className="border-b border-amber-200 bg-amber-50"
    >
      <div className="max-w-7xl mx-auto px-3 py-1 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs leading-tight">
        <span className="shrink-0 rounded-sm border border-amber-300 bg-white px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-700">
          Anunci
        </span>
        <Link
          href={LICITABOT_URL}
          target="_blank"
          rel="noopener noreferrer sponsored"
          prefetch={false}
          onClick={() =>
            track("ad_click", { ad: "licitabot", placement: "home_top" })
          }
          className="group inline-flex items-center gap-1 text-amber-900 hover:text-amber-950"
        >
          <span className="font-semibold">Licitabot</span>
          <span className="text-amber-800/90">· assistent IA per a licitacions</span>
          <span className="ml-0.5 inline-flex items-center font-medium underline-offset-2 group-hover:underline">
            Prova-ho
            <svg
              className="ml-0.5 h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 0 1 0-1.06L10.94 10 7.21 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.24a.75.75 0 0 1 0 1.06l-4.25 4.24a.75.75 0 0 1-1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </Link>
      </div>
    </aside>
  );
}
