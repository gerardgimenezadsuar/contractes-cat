import Link from "next/link";
import { formatCompactEuros } from "@/lib/indicators";
import { formatNumber } from "@/lib/utils";

export interface TopCompany {
  href: string;
  name: string;
  current: boolean;
  contracts: number;
  amount: number;
}

interface Props {
  companies: TopCompany[];
  /** Companies with contracts while in charge, beyond the ones shown on desktop. */
  moreCount: number;
  /** Contracts while in charge, for the mobile jump link to the contracts list. */
  contractsCount: number;
}

/** Cards shown on phones: fewer and shorter, so the contracts list stays close. */
const MOBILE_SIZE = 2;

function moreLabel(count: number): string {
  return count === 1 ? "1 empresa més" : `${formatNumber(count)} empreses més`;
}

/**
 * The companies behind a person's contract totals, as the next click after the
 * opening answer. Amounts exclude VAT, like the rest of the person page.
 * Desktop: up to 3 full cards. Mobile: 2 compact rows (name + one stats line) and
 * a jump link to the contracts, which sit below the full company list.
 */
export default function PersonTopCompanies({ companies, moreCount, contractsCount }: Props) {
  if (companies.length === 0) return null;
  const hiddenOnMobile = Math.max(0, companies.length - MOBILE_SIZE);
  const mobileMore = moreCount + hiddenOnMobile;
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">
        Empreses amb més contractes durant el càrrec
      </h2>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-2">
        {companies.map((company, i) => (
          <li key={company.href} className={i >= MOBILE_SIZE ? "hidden sm:block" : undefined}>
            <Link
              href={company.href}
              className="group flex h-full flex-col justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 transition-colors hover:border-accent sm:px-4 sm:py-3"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="truncate font-medium text-gray-900 group-hover:underline sm:whitespace-normal">
                  {company.name}
                </span>
                <span aria-hidden className="text-accent">→</span>
              </span>
              <span className="mt-0.5 text-xs text-gray-600 sm:mt-1 sm:text-sm">
                {company.contracts === 1 ? "1 contracte" : `${formatNumber(company.contracts)} contractes`} ·{" "}
                {formatCompactEuros(company.amount)} sense IVA
                <span className={`sm:hidden ${company.current ? "text-emerald-700" : "text-gray-500"}`}>
                  {" "}
                  · {company.current ? "vigent" : "històric"}
                </span>
              </span>
              <span className={`mt-0.5 hidden text-xs sm:block ${company.current ? "text-emerald-700" : "text-gray-500"}`}>
                {company.current ? "Càrrec vigent" : "Càrrec històric"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm sm:hidden">
        {contractsCount > 0 ? (
          <a href="#contractes" className="font-medium text-accent hover:underline">
            {contractsCount === 1 ? "Veure el contracte" : `Veure els ${formatNumber(contractsCount)} contractes`} ↓
          </a>
        ) : null}
        {mobileMore > 0 ? (
          <a href="#empreses" className="text-accent hover:underline">
            {moreLabel(mobileMore)} ↓
          </a>
        ) : null}
      </div>
      {moreCount > 0 ? (
        <a href="#empreses" className="mt-2 hidden text-sm text-accent hover:underline sm:inline-block">
          {moreLabel(moreCount)} ↓
        </a>
      ) : null}
    </div>
  );
}
