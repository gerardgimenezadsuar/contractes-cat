import type { Contract } from "@/lib/types";
import { formatCurrency, formatDate, getBestAvailableContractDate, getPublicationUrl } from "@/lib/utils";

interface Props {
  contracts: Contract[];
}

export default function OrganRecentContracts({ contracts }: Props) {
  const lastAwardDate = getBestAvailableContractDate(
    contracts[0]?.data_adjudicacio_contracte,
    contracts[0]?.data_formalitzacio_contracte,
    contracts[0]?.data_publicacio_anunci
  ).date;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-2.5 text-xs text-gray-500">
        Darrera data de referència: <span className="font-medium text-gray-700">{formatDate(lastAwardDate)}</span>
      </div>
      <ul className="divide-y divide-gray-100">
        {contracts.map((contract, idx) => {
          const bestDate = getBestAvailableContractDate(
            contract.data_adjudicacio_contracte,
            contract.data_formalitzacio_contracte,
            contract.data_publicacio_anunci
          );
          const publicationUrl = getPublicationUrl(contract.enllac_publicacio);
          const name = contract.denominacio_adjudicatari || "—";
          return (
            <li
              key={`${contract.codi_expedient}-${idx}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm"
            >
              {publicationUrl ? (
                <a
                  href={publicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={name}
                  className="line-clamp-2 font-medium text-gray-900 hover:underline"
                >
                  {name}
                </a>
              ) : (
                <span title={name} className="line-clamp-2 font-medium text-gray-900">
                  {name}
                </span>
              )}
              <span className="row-span-2 self-center text-right font-medium text-gray-900 tabular-nums">
                {contract.import_adjudicacio_sense ? formatCurrency(contract.import_adjudicacio_sense) : "—"}
              </span>
              <span className="text-xs text-gray-500">
                {[contract.procediment, formatDate(bestDate.date)].filter(Boolean).join(" · ")}
              </span>
            </li>
          );
        })}
        {contracts.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-gray-500">No hi ha contractes recents.</li>
        ) : null}
      </ul>
    </div>
  );
}
