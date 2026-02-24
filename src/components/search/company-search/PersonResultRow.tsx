import Link from "next/link";
import type { PersonSearchResult } from "@/lib/search";
import { formatCompactNumber, formatNumber } from "@/lib/utils";
import ResultTypeBadge from "@/components/search/company-search/ResultTypeBadge";

const resultRowClassName =
  "flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0";

interface Props {
  result: PersonSearchResult;
  showTypeBadge: boolean;
  onSelect: () => void;
}

export default function PersonResultRow({ result, showTypeBadge, onSelect }: Props) {
  return (
    <Link
      href={`/persones/${encodeURIComponent(result.person_name)}`}
      onClick={onSelect}
      className={resultRowClassName}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {showTypeBadge && <ResultTypeBadge kind="persona" />}
          <p className="text-sm font-medium text-gray-900 truncate">
            {result.person_name}
          </p>
        </div>
        <p className="text-xs text-gray-500">
          {formatNumber(result.num_companies)} empreses vinculades
        </p>
      </div>
      <div className="ml-4 text-right shrink-0">
        {typeof result.total === "number" && result.total > 0 && (
          <p className="text-xs font-medium text-gray-700">
            {formatCompactNumber(result.total)} EUR
          </p>
        )}
        <p className="text-xs text-gray-500">
          {formatNumber(result.active_spans)} càrrecs actius
        </p>
      </div>
    </Link>
  );
}
