"use client";

import { useSearchParams } from "next/navigation";
import PersonContractsExplorer from "@/components/person/PersonContractsExplorer";
import { formatCompactNumber, formatNumber } from "@/lib/utils";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NIF = /^[A-Z0-9]{8,12}$/;

interface Props {
  personName: string;
  defaultNifs: string[];
  totalContracts: number;
  totalAmount: number;
}

/**
 * Reads the contract filters (date_from, date_to, nifs, nif_windows, nom_organ) from the URL
 * on the client, so the person page itself never touches searchParams and can be ISR-cached.
 */
export default function PersonContractsSection({
  personName,
  defaultNifs,
  totalContracts,
  totalAmount,
}: Props) {
  const searchParams = useSearchParams();

  const rawDateFrom = searchParams.get("date_from") || "";
  const rawDateTo = searchParams.get("date_to") || "";
  const dateFrom = ISO_DATE.test(rawDateFrom) ? rawDateFrom : "";
  const dateTo = ISO_DATE.test(rawDateTo) ? rawDateTo : "";
  const nomOrgan = (searchParams.get("nom_organ") || "").trim().slice(0, 160);
  const scopedNifs = (searchParams.get("nifs") || "")
    .split(",")
    .map((nif) => nif.trim().toUpperCase())
    .filter((nif) => NIF.test(nif));
  const nifs = scopedNifs.length > 0 ? Array.from(new Set(scopedNifs)) : defaultNifs;
  const nifWindows = (searchParams.get("nif_windows") || "").trim();

  const scopeKey = [personName, nomOrgan, dateFrom, dateTo, nifWindows, nifs.join(",")].join("|");

  return (
    <PersonContractsExplorer
      key={scopeKey}
      personName={personName}
      personNifs={nifs}
      initialContracts={[]}
      initialTotalContracts={totalContracts}
      initialTotalAmount={totalAmount}
      hasNifTargets={nifs.length > 0}
      initialOrganFilter={nomOrgan}
      initialDateFrom={dateFrom}
      initialDateTo={dateTo}
      initialNifWindows={nifWindows}
    />
  );
}

export function PersonContractsSectionFallback({
  totalContracts,
  totalAmount,
}: Pick<Props, "totalContracts" | "totalAmount">) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-2xl font-bold text-gray-900">
        Contractes vinculats ({formatNumber(totalContracts)})
      </h2>
      <p className="text-sm text-gray-500">Import total: {formatCompactNumber(totalAmount)}</p>
    </div>
  );
}
