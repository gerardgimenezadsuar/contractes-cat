import Link from "next/link";

const LICITABOT_URL =
  "https://licitabot.net/?utm_source=contractes.cat&utm_medium=banner&utm_campaign=site_promo&utm_content=top_banner";

export default function AdBanner() {
  return (
    <aside
      aria-label="Anunci patrocinat"
      className="border-b border-amber-200 bg-gradient-to-r from-amber-50 via-amber-50 to-orange-50"
    >
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-center gap-2 text-xs sm:text-sm">
        <span className="hidden sm:inline-flex shrink-0 items-center rounded-sm border border-amber-300 bg-white px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-700">
          Anunci
        </span>
        <Link
          href={LICITABOT_URL}
          target="_blank"
          rel="noopener noreferrer sponsored"
          prefetch={false}
          className="group inline-flex items-center gap-1.5 text-amber-900 hover:text-amber-950"
        >
          <span className="font-semibold">Licitabot</span>
          <span className="hidden sm:inline text-amber-800/80">·</span>
          <span className="text-amber-800/90">
            <span className="sm:hidden">Assistent IA per a licitacions</span>
            <span className="hidden sm:inline">
              Assistent d&apos;IA per a licitacions públiques
            </span>
          </span>
          <span className="ml-1 inline-flex items-center gap-0.5 font-medium underline-offset-2 group-hover:underline">
            Prova-ho
            <svg
              className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
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
