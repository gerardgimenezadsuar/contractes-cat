"use client";

import type { Contract } from "@/lib/types";
import { formatCurrencyFull, formatDate, getPublicationUrl } from "@/lib/utils";
import { CPV_DIVISIONS } from "@/config/constants";

interface Props {
  contracts: Contract[];
}

function extractCpvDivisions(cpvRaw?: string): string[] {
  if (!cpvRaw) return [];
  const codes = cpvRaw
    .split("||")
    .map((c) => c.trim())
    .filter(Boolean);

  const divisions = new Set<string>();
  for (const code of codes) {
    const match = code.match(/^(\d{2})/);
    if (match) divisions.add(match[1]);
  }

  return Array.from(divisions);
}

function getCpvLabel(cpvRaw?: string): string {
  const divisions = extractCpvDivisions(cpvRaw);
  if (divisions.length === 0) return "—";

  const primary = divisions[0];
  const primaryLabel = CPV_DIVISIONS[primary] || `Sector ${primary}`;
  if (divisions.length === 1) return primaryLabel;
  return `${primaryLabel} +${divisions.length - 1}`;
}

export default function OpenTendersTable({ contracts }: Props) {
  return (
    <>
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full min-w-[980px] table-auto text-sm" aria-label="Llistat de licitacions obertes">
          <caption className="sr-only">
            Resultats de licitacions obertes amb sector, tipus, pressupost, termini i òrgan.
          </caption>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Denominació</th>
              <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Sector (CPV)</th>
              <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Tipus</th>
              <th scope="col" className="text-right py-3 px-4 font-medium text-gray-500">Pressupost (sense IVA)</th>
              <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Termini ofertes</th>
              <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Òrgan</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c, idx) => {
              const publicationUrl = getPublicationUrl(c.enllac_publicacio);
              return (
                <tr key={`${c.codi_expedient}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50">
                  <th scope="row" className="py-3 px-4 text-left align-top">
                    {publicationUrl ? (
                      <a
                        href={publicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-sm"
                        aria-label={`Obre la licitació ${c.denominacio || c.codi_expedient || ""} a la plataforma original`}
                      >
                        {c.denominacio || "—"}
                      </a>
                    ) : (
                      <span className="text-gray-900">{c.denominacio || "—"}</span>
                    )}
                    <p className="mt-1 text-[11px] text-gray-500 whitespace-normal break-words">{c.codi_expedient || "—"}</p>
                  </th>
                  <td className="py-3 px-4 align-top">
                    <p className="whitespace-normal break-words">{getCpvLabel(c.codi_cpv)}</p>
                    <p className="mt-1 text-[11px] text-gray-500 whitespace-normal break-words">{c.codi_cpv || "—"}</p>
                  </td>
                  <td className="py-3 px-4 align-top">
                    <p className="whitespace-normal break-words">{c.tipus_contracte || "—"}</p>
                    <p className="mt-1 text-[11px] text-gray-500 whitespace-normal break-words">{c.procediment || "—"}</p>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-xs align-top">
                    {c.pressupost_licitacio_sense != null
                      ? formatCurrencyFull(c.pressupost_licitacio_sense)
                      : "—"}
                  </td>
                  <td className="py-3 px-4 text-xs whitespace-nowrap align-top">
                    {formatDate(c.termini_presentacio_ofertes)}
                  </td>
                  <td className="py-3 px-4 whitespace-normal break-words align-top">
                    {c.nom_organ || "—"}
                  </td>
                </tr>
              );
            })}
            {contracts.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No s&apos;han trobat licitacions obertes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden space-y-2 p-2">
        {contracts.map((c, idx) => {
          const publicationUrl = getPublicationUrl(c.enllac_publicacio);
          return (
            <article key={`m-${c.codi_expedient}-${idx}`} className="rounded-lg border border-gray-200 bg-white p-3">
              {publicationUrl ? (
                <a
                  href={publicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-gray-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-sm"
                  aria-label={`Obre la licitació ${c.denominacio || c.codi_expedient || ""} a la plataforma original`}
                >
                  {c.denominacio || "Sense denominació"}
                </a>
              ) : (
                <p className="text-sm font-semibold text-gray-900">{c.denominacio || "Sense denominació"}</p>
              )}
              <div className="mt-2 space-y-1 text-xs text-gray-600">
                <p><span className="font-medium">Sector:</span> {getCpvLabel(c.codi_cpv)}</p>
                <p><span className="font-medium">CPV:</span> {c.codi_cpv || "—"}</p>
                <p><span className="font-medium">Tipus:</span> {c.tipus_contracte || "—"}</p>
                <p><span className="font-medium">Procediment:</span> {c.procediment || "—"}</p>
                <p><span className="font-medium">Pressupost:</span> {c.pressupost_licitacio_sense != null
                    ? formatCurrencyFull(c.pressupost_licitacio_sense)
                    : "—"}</p>
                <p><span className="font-medium">Termini:</span> {formatDate(c.termini_presentacio_ofertes)}</p>
                <p><span className="font-medium">Òrgan:</span> {c.nom_organ || "—"}</p>
              </div>
            </article>
          );
        })}

        {contracts.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-6">
            No s&apos;han trobat licitacions obertes.
          </p>
        )}
      </div>
    </>
  );
}
