"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface Props {
  year: number;
}

export default function YearFilterChip({ year }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleClear = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("year");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

  return (
    <span className="group animate-filter-chip-in inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M3 5h18l-7 8v5l-4 2v-7L3 5z"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {year}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleClear();
        }}
        aria-label={`Elimina filtre d'any ${year}`}
        className="ml-0 inline-flex h-4 w-0 cursor-pointer items-center justify-center overflow-hidden rounded-full text-blue-700 opacity-0 transition-all group-hover:ml-0.5 group-hover:w-4 group-hover:opacity-100 group-focus-within:ml-0.5 group-focus-within:w-4 group-focus-within:opacity-100 focus:ml-0.5 focus:w-4 focus:opacity-100 focus:outline-none"
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M6 6l12 12M18 6l-12 12" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
}
