import type { BormeAdminSpan } from "@/lib/borme";
import { toTitleCase } from "@/lib/person-utils";

const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR:    "Administrador/a",
  APODERADO:        "Apoderat/da",
  SOCIO_UNICO:      "Soci únic",
  SOCIO:            "Soci",
  ACCIONISTA_UNICO: "Accionista únic",
  ORGANO_GOBIERNO:  "Òrgan de govern",
  LIQUIDADOR:       "Liquidador/a",
};

function formatBormeDate(d: string | null | undefined): string {
  if (!d || d.length !== 8) return "—";
  return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
}

interface Props {
  spans: BormeAdminSpan[];
  matchedName: string;
  embedded?: boolean;
}

const MAX_CLOSED = 20;
const GOVERNANCE_ROLES = new Set(["ADMINISTRADOR", "ORGANO_GOBIERNO"]);
const OWNERSHIP_ROLES = new Set(["SOCIO_UNICO", "SOCIO", "ACCIONISTA_UNICO"]);

export default function AdminHistoryTable({ spans, matchedName, embedded = false }: Props) {
  const governance = spans.filter((s) => GOVERNANCE_ROLES.has(s.relation_type));
  const ownership = spans.filter((s) => OWNERSHIP_ROLES.has(s.relation_type));

  return (
    <section id="borme-detall" className={embedded ? "" : "mb-12"}>
      {!embedded && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Administradors i propietat (BORME)
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Nom al registre:{" "}
            <span className="font-medium text-gray-700">{matchedName}</span>
            {" · "}
            Font: Boletín Oficial del Registro Mercantil (2016–2025)
          </p>
        </>
      )}

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[560px] w-full table-auto text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 font-medium text-gray-500">Persona</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-500 whitespace-nowrap">Càrrec</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-500 whitespace-nowrap">Des de</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-500 whitespace-nowrap">Fins a</th>
                <th className="text-left py-2.5 px-4 font-medium text-gray-500">Font</th>
              </tr>
            </thead>
            <tbody>
              {renderGroupedRows("Governança", governance)}
              {renderGroupedRows("Propietat", ownership)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function renderGroupedRows(groupLabel: string, rows: BormeAdminSpan[]) {
  if (rows.length === 0) return null;
  const active = rows.filter((s) => !s.date_end);
  const allClosed = rows.filter((s) => s.date_end);
  const closed = allClosed.slice(0, MAX_CLOSED);
  const hiddenCount = allClosed.length - closed.length;

  return (
    <>
      <tr>
        <td colSpan={5} className="px-4 py-1.5 bg-gray-50 text-xs text-gray-500 font-medium uppercase tracking-wide">
          {groupLabel}
        </td>
      </tr>
      {active.map((s, i) => (
        <AdminRow key={`${groupLabel}-a-${i}`} span={s} isActive />
      ))}
      {closed.length > 0 && (
        <tr>
          <td colSpan={5} className="px-4 py-1.5 bg-gray-50 text-xs text-gray-400 font-medium uppercase tracking-wide">
            Cessats
          </td>
        </tr>
      )}
      {closed.map((s, i) => (
        <AdminRow key={`${groupLabel}-c-${i}`} span={s} isActive={false} />
      ))}
      {hiddenCount > 0 && (
        <tr>
          <td colSpan={5} className="px-4 py-2.5 text-xs text-gray-400 text-center">
            +{hiddenCount} cessats addicionals no mostrats
          </td>
        </tr>
      )}
    </>
  );
}

function AdminRow({ span, isActive }: { span: BormeAdminSpan; isActive: boolean }) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="py-2.5 px-4 text-gray-900 font-medium">
        {toTitleCase(span.person_name)}
        {isActive && (
          <span className="ml-2 inline-block text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-700 rounded px-1.5 py-0.5">
            Actiu
          </span>
        )}
      </td>
      <td className="py-2.5 px-4 text-gray-700 whitespace-nowrap">
        {ROLE_LABELS[span.relation_type] ?? span.relation_type}
      </td>
      <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap tabular-nums">
        {formatBormeDate(span.date_start)}
      </td>
      <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap tabular-nums">
        {span.date_end ? formatBormeDate(span.date_end) : "—"}
      </td>
      <td className="py-2.5 px-4">
        {span.source_pdf ? (
          <a
            href={span.source_pdf}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-xs"
          >
            BORME
          </a>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

