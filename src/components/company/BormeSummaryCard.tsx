import type { BormeAdminSpan } from "@/lib/borme";

const ACTIVE_POSITION_ROLES = new Set([
  "ADMINISTRADOR",
  "ORGANO_GOBIERNO",
  "APODERADO",
  "LIQUIDADOR",
]);
const OWNERSHIP_ROLES = new Set(["SOCIO_UNICO", "SOCIO", "ACCIONISTA_UNICO"]);
const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: "Administrador/a",
  APODERADO: "Apoderat/da",
  SOCIO_UNICO: "Soci únic",
  SOCIO: "Soci",
  ACCIONISTA_UNICO: "Accionista únic",
  ORGANO_GOBIERNO: "Òrgan de govern",
  LIQUIDADOR: "Liquidador/a",
};

interface Props {
  spans: BormeAdminSpan[];
  matchedName: string;
  compact?: boolean;
}

interface ActiveEntry {
  name: string;
  title: string;
  isApoderado: boolean;
  dateStart: string;
  dateEnd: string | null;
  sourcePdf: string | null;
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatBormeDate(d: string | null | undefined): string {
  if (!d || d.length !== 8) return "—";
  return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
}

function normalizeRoleTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.replace(/\s+/g, " ").replace(/\.+$/g, "").trim();
  return v ? toTitleCase(v) : null;
}

function extractInlineTitleAndName(rawName: string): { cleanedName: string; inlineTitle: string | null } {
  const normalized = rawName.replace(/\s+/g, " ").trim();
  const titleMatch = normalized.match(
    /(presidente|vicepresidente|secretario|vicesecretario|tesorero|consejero delegado|administrador(?:a)?(?: unico| única| solidario| solidaria| mancomunado| mancomunada)?|apoderado(?:a)?|liquidador(?:a)?)\s*:/i
  );
  if (!titleMatch || titleMatch.index == null) {
    return { cleanedName: normalized, inlineTitle: null };
  }
  const head = normalized.slice(0, titleMatch.index).trim();
  const inlineTitle = toTitleCase(titleMatch[1]);
  return {
    cleanedName: head || normalized,
    inlineTitle,
  };
}

function pickCurrentByRole(spans: BormeAdminSpan[], roleSet: Set<string>): ActiveEntry[] {
  const byPersonAndTitle = new Map<string, ActiveEntry>();
  for (const span of spans) {
    if (span.date_end) continue;
    if (!roleSet.has(span.relation_type)) continue;

    const parsed = extractInlineTitleAndName(span.person_name);
    const roleTitle = ROLE_LABELS[span.relation_type] ?? span.relation_type;
    const effectiveTitle = normalizeRoleTitle(span.role_title_raw) || parsed.inlineTitle || roleTitle;
    const personKey = parsed.cleanedName.toUpperCase();
    const key = `${personKey}||${effectiveTitle.toUpperCase()}`;
    const current = byPersonAndTitle.get(key);

    if (!current || span.date_start > current.dateStart) {
      byPersonAndTitle.set(key, {
        name: toTitleCase(parsed.cleanedName),
        title: effectiveTitle,
        isApoderado: span.relation_type === "APODERADO",
        dateStart: span.date_start,
        dateEnd: span.date_end,
        sourcePdf: span.source_pdf,
      });
    }
  }
  return Array.from(byPersonAndTitle.values()).sort((a, b) => {
    if (a.isApoderado !== b.isApoderado) return a.isApoderado ? 1 : -1;
    if (a.dateStart !== b.dateStart) return b.dateStart.localeCompare(a.dateStart);
    return a.name.localeCompare(b.name);
  });
}

function getLatestStartDate(spans: BormeAdminSpan[]): string {
  let latest: string | null = null;
  for (const span of spans) {
    if (!latest || span.date_start > latest) latest = span.date_start;
  }
  return formatBormeDate(latest);
}

function ActiveAppointmentsList({
  people,
  defaultLimit,
}: {
  people: ActiveEntry[];
  defaultLimit?: number;
}) {
  const visiblePeople = defaultLimit ? people.slice(0, defaultLimit) : people;
  const hiddenPeople = defaultLimit ? people.slice(defaultLimit) : [];

  return (
    <div className="space-y-2">
      {visiblePeople.map((person) => (
        <div key={`${person.name}-${person.title}-${person.dateStart}`} className="flex items-start justify-between gap-3">
          <div>
            {person.sourcePdf ? (
              <a
                href={person.sourcePdf}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-900 hover:underline"
              >
                {person.name}
              </a>
            ) : (
              <span className="text-gray-900">{person.name}</span>
            )}
            <p className="text-xs text-gray-500">{person.title}</p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-gray-500">
            {formatBormeDate(person.dateStart)}
            {person.dateEnd ? ` → ${formatBormeDate(person.dateEnd)}` : " → actual"}
          </span>
        </div>
      ))}
      {hiddenPeople.length > 0 && (
        <details className="pt-1">
          <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-900">
            Veure {hiddenPeople.length} càrrec{hiddenPeople.length === 1 ? "" : "s"} més
          </summary>
          <div className="mt-2 space-y-2">
            {hiddenPeople.map((person) => (
              <div key={`${person.name}-${person.title}-${person.dateStart}`} className="flex items-start justify-between gap-3">
                <div>
                  {person.sourcePdf ? (
                    <a
                      href={person.sourcePdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-900 hover:underline"
                    >
                      {person.name}
                    </a>
                  ) : (
                    <span className="text-gray-900">{person.name}</span>
                  )}
                  <p className="text-xs text-gray-500">{person.title}</p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-gray-500">
                  {formatBormeDate(person.dateStart)}
                  {person.dateEnd ? ` → ${formatBormeDate(person.dateEnd)}` : " → actual"}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default function BormeSummaryCard({ spans, matchedName, compact = false }: Props) {
  const currentPositions = pickCurrentByRole(spans, ACTIVE_POSITION_ROLES);
  const currentOwners = pickCurrentByRole(spans, OWNERSHIP_ROLES);

  const blocks = [
    { label: "Càrrecs actius", people: currentPositions },
    { label: "Propietat declarada", people: currentOwners },
  ].filter((block) => block.people.length > 0);

  if (blocks.length === 0) return null;

  return (
    <div className={`bg-white rounded-lg border border-gray-100 shadow-sm ${compact ? "p-4" : "p-6"}`}>
      <h2 className="text-2xl font-bold text-gray-900">Governança i propietat</h2>
      <p className="text-sm text-gray-500 mt-1">
        Nom al registre: <span className="font-medium text-gray-700">{matchedName}</span>
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Dades extretes del Registre Mercantil (2009-act.).{" "}
        <span
          className="underline decoration-dotted cursor-help"
          title="Les coincidències es fan per nom perquè BORME no publica NIF en aquests registres, i poden contenir errors."
        >
          Poden contenir errors d&apos;extracció i coincidència.
        </span>
      </p>

      <div className="mt-4 space-y-3">
        {blocks.map((block) => (
          <div key={block.label} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{block.label}</p>
            <div className="mt-1">
              <ActiveAppointmentsList
                people={block.people}
                defaultLimit={block.label === "Càrrecs actius" ? 10 : undefined}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Darrera actualització:{" "}
        <span className="font-medium text-gray-700">{getLatestStartDate(spans)}</span>
      </p>
    </div>
  );
}
