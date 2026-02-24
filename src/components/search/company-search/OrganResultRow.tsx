import Link from "next/link";
import type { OrganAggregation } from "@/lib/types";
import { formatCompactNumber, formatNumber } from "@/lib/utils";
import ResultTypeBadge from "@/components/search/company-search/ResultTypeBadge";

const resultRowClassName =
  "flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0";

interface Props {
  result: OrganAggregation;
  showTypeBadge: boolean;
  onSelect: () => void;
}

export default function OrganResultRow({ result, showTypeBadge, onSelect }: Props) {
  return (
    <Link
      href={`/organismes/${encodeURIComponent(result.nom_organ)}`}
      onClick={onSelect}
      className={resultRowClassName}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {showTypeBadge && <ResultTypeBadge kind="organisme" />}
          <p className="text-sm font-medium text-gray-900 truncate">
            {result.nom_organ}
          </p>
        </div>
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
