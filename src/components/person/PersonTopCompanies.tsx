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
  /** Companies with contracts while in charge, beyond the ones shown. */
  moreCount: number;
}

/**
 * The companies behind a person's contract totals, as the next click after the
 * opening answer. Amounts exclude VAT, like the rest of the person page.
 */
export default function PersonTopCompanies({ companies, moreCount }: Props) {
  if (companies.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Empreses amb més contractes durant el càrrec
      </h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {companies.map((company) => (
          <li key={company.href}>
            <Link
              href={company.href}
              className="group flex h-full flex-col justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-accent"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-medium text-gray-900 group-hover:underline">{company.name}</span>
                <span aria-hidden className="text-accent">→</span>
              </span>
              <span className="mt-1 text-sm text-gray-600">
                {company.contracts === 1 ? "1 contracte" : `${formatNumber(company.contracts)} contractes`} ·{" "}
                {formatCompactEuros(company.amount)} sense IVA
              </span>
              <span className={`mt-0.5 text-xs ${company.current ? "text-emerald-700" : "text-gray-500"}`}>
                {company.current ? "Càrrec vigent" : "Càrrec històric"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {moreCount > 0 ? (
        <a href="#empreses" className="mt-2 inline-block text-sm text-accent hover:underline">
          {moreCount === 1 ? "1 empresa més" : `${formatNumber(moreCount)} empreses més`} ↓
        </a>
      ) : null}
    </div>
  );
}
