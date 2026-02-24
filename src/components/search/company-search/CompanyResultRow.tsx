import Link from "next/link";
import type { CompanyAggregation } from "@/lib/types";
import { formatCompactNumber, formatNumber } from "@/lib/utils";
import ResultTypeBadge from "@/components/search/company-search/ResultTypeBadge";

const resultRowClassName =
  "flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0";

interface Props {
  result: CompanyAggregation;
  showTypeBadge: boolean;
  onSelect: () => void;
}

export default function CompanyResultRow({ result, showTypeBadge, onSelect }: Props) {
  return (
    <Link
      href={`/empreses/${encodeURIComponent(result.identificacio_adjudicatari)}`}
      onClick={onSelect}
      className={resultRowClassName}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {showTypeBadge && <ResultTypeBadge kind="empresa" />}
          <p className="text-sm font-medium text-gray-900 truncate">
            {result.denominacio_adjudicatari}
          </p>
        </div>
        <p className="text-xs text-gray-500 font-mono">
          {result.identificacio_adjudicatari}
        </p>
      </div>
      <div className="ml-4 text-right shrink-0">
        <p className="text-sm font-medium text-gray-900">
          {formatCompactNumber(result.total)}
        </p>
        <p className="text-xs text-gray-500">
          {formatNumber(result.num_contracts)} contractes
        </p>
      </div>
    </Link>
  );
}
