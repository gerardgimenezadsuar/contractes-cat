import Link from "next/link";
import { isJunkPersonName, type BormeAdminSpan } from "@/lib/borme";
import { classifyControlRole, type ControlRole } from "@/lib/borme-roles";
import { formatPersonDisplayName, toTitleCase } from "@/lib/person-utils";
import { formatCompactEuros, type YearlyRow } from "@/lib/indicators";
import { formatNumber } from "@/lib/utils";

/** BORME starts in 2009; contracts in the portal from 2015. */
const FIRST_YEAR = 2009;
const VISIBLE_YEARS = 10;

interface ControlEvent {
  date: string; // YYYYMMDD
  kind: "in" | "out";
  personName: string;
  role: string;
  sourcePdf: string | null;
}

interface YearRow {
  year: number;
  total: number;
  contracts: number;
  events: ControlEvent[];
}

/** BORME abbreviations ("Adm. Unico", "Cons.Del.Man", ...) to plain Catalan. */
const ROLE_PATTERNS: Array<[RegExp, string]> = [
  [/adm.*unic/, "Administrador/a únic/a"],
  [/adm.*solid/, "Administrador/a solidari/ària"],
  [/adm.*manc/, "Administrador/a mancomunat/ada"],
  [/con.*del/, "Conseller/a delegat/ada"],
  [/cons.*ejec/, "Conseller/a executiu/iva"],
  [/vicepres/, "Vicepresident/a"],
  [/presid/, "President/a"],
  [/adm/, "Administrador/a"],
];

function roleLabel(control: ControlRole, roleTitleRaw: string | null): string {
  if (control === "OWNER") return "Soci únic";
  const key = (roleTitleRaw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (const [pattern, label] of ROLE_PATTERNS) if (pattern.test(key)) return label;
  const raw = (roleTitleRaw || "").replace(/\s+/g, " ").replace(/\.+$/g, "").trim();
  return raw ? toTitleCase(raw) : "Administrador/a";
}

/** Appointments and departures of owners and administrators (the roles that control the company). */
export function controlEvents(spans: BormeAdminSpan[]): ControlEvent[] {
  const seen = new Set<string>();
  const events: ControlEvent[] = [];
  const push = (event: ControlEvent) => {
    const key = `${event.kind}|${event.date}|${event.personName.toUpperCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    events.push(event);
  };
  for (const span of spans) {
    const control = classifyControlRole(span.relation_type, span.role_title_code);
    if (!control || isJunkPersonName(span.person_name)) continue;
    const role = roleLabel(control, span.role_title_raw);
    if (span.date_start?.length === 8) {
      push({ date: span.date_start, kind: "in", personName: span.person_name, role, sourcePdf: span.source_pdf });
    }
    if (span.date_end?.length === 8) {
      push({ date: span.date_end, kind: "out", personName: span.person_name, role, sourcePdf: null });
    }
  }
  return events.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Worth showing only when control changed while the company was winning
 * contracts (from a year before the first one): otherwise it repeats the
 * yearly chart.
 */
export function hasRelevantTimeline(yearly: YearlyRow[], spans: BormeAdminSpan[]): boolean {
  const years = yearly.filter((y) => y.contracts > 0).map((y) => y.year);
  if (years.length === 0) return false;
  const from = Math.min(...years) - 1;
  return controlEvents(spans).some((event) => parseInt(event.date.slice(0, 4), 10) >= from);
}

export function buildTimeline(yearly: YearlyRow[], spans: BormeAdminSpan[], currentYear: number): YearRow[] {
  const events = controlEvents(spans);
  const byYear = new Map<number, YearRow>();
  const row = (year: number) => {
    let r = byYear.get(year);
    if (!r) {
      r = { year, total: 0, contracts: 0, events: [] };
      byYear.set(year, r);
    }
    return r;
  };
  for (const y of yearly) {
    if (y.year < FIRST_YEAR || y.year > currentYear) continue;
    const r = row(y.year);
    r.total += y.total;
    r.contracts += y.contracts;
  }
  for (const event of events) {
    const year = parseInt(event.date.slice(0, 4), 10);
    if (year < FIRST_YEAR || year > currentYear) continue;
    row(year).events.push(event);
  }
  const years = [...byYear.keys()];
  if (years.length === 0) return [];
  // Fill the gaps so years without contracts or changes still show as empty.
  const first = Math.min(...years);
  const out: YearRow[] = [];
  for (let year = currentYear; year >= first; year--) out.push(byYear.get(year) ?? { year, total: 0, contracts: 0, events: [] });
  return out;
}

function formatShortDate(d: string): string {
  return `${d.slice(6, 8)}/${d.slice(4, 6)}`;
}

function EventLine({ event }: { event: ControlEvent }) {
  const isIn = event.kind === "in";
  return (
    <li className="flex items-baseline gap-2 text-sm">
      <span
        aria-hidden="true"
        className={`inline-block w-3 shrink-0 text-center text-xs font-bold ${isIn ? "text-emerald-700" : "text-gray-400"}`}
      >
        {isIn ? "+" : "−"}
      </span>
      <span className="min-w-0">
        <span className="tabular-nums text-gray-500">{formatShortDate(event.date)}</span>{" "}
        <span className="text-gray-500">{isIn ? "Entra" : "Surt"}</span>{" "}
        <Link href={`/persones/${encodeURIComponent(event.personName)}`} className="font-medium text-gray-900 hover:underline">
          {formatPersonDisplayName(event.personName)}
        </Link>{" "}
        <span className="text-gray-500">· {event.role}</span>
        {event.sourcePdf ? (
          <>
            {" · "}
            <a href={event.sourcePdf} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:underline">
              BORME
            </a>
          </>
        ) : null}
      </span>
    </li>
  );
}

function YearLine({ row, maxTotal }: { row: YearRow; maxTotal: number }) {
  const width = maxTotal > 0 ? Math.max(row.total > 0 ? 2 : 0, Math.round((row.total / maxTotal) * 100)) : 0;
  const hasChange = row.events.length > 0;
  return (
    <li className="grid grid-cols-[3.25rem_1fr] gap-x-3 border-t border-gray-100 py-3 first:border-t-0 sm:grid-cols-[3.5rem_minmax(0,2fr)_minmax(0,3fr)] sm:gap-x-4">
      <div className="font-display text-sm font-semibold tabular-nums text-gray-900">{row.year}</div>
      <div className="min-w-0">
        <div className="h-2.5 w-full rounded-full bg-gray-100" aria-hidden="true">
          <div className="h-2.5 rounded-full bg-accent" style={{ width: `${width}%` }} />
        </div>
        <p className="mt-1 text-xs tabular-nums text-gray-500">
          {row.contracts > 0
            ? `${formatCompactEuros(row.total)} · ${formatNumber(row.contracts)} ${row.contracts === 1 ? "contracte" : "contractes"}`
            : "Cap contracte"}
        </p>
      </div>
      <div className="col-start-2 mt-2 min-w-0 sm:col-start-3 sm:mt-0">
        {hasChange ? (
          <ul className="space-y-1">
            {row.events.map((event, i) => (
              <EventLine key={`${event.kind}-${event.date}-${event.personName}-${i}`} event={event} />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

interface Props {
  yearly: YearlyRow[];
  spans: BormeAdminSpan[];
  currentYear: number;
}

/**
 * Contracts won per year next to the changes in who owns or runs the company
 * (BORME). Puts side by side what only contractes.cat combines; it describes,
 * it does not judge.
 */
export default function ControlTimeline({ yearly, spans, currentYear }: Props) {
  if (!hasRelevantTimeline(yearly, spans)) return null;
  const rows = buildTimeline(yearly, spans, currentYear);
  const maxTotal = Math.max(...rows.map((row) => row.total));
  const visible = rows.slice(0, VISIBLE_YEARS);
  const hidden = rows.slice(VISIBLE_YEARS);

  return (
    <div>
      <div className="mb-3">
        <h2 className="font-display text-xl font-semibold text-gray-900">Cronologia: contractes i control</h2>
        <p className="mt-1 text-sm text-gray-500">
          Import adjudicat cada any al costat dels nomenaments i cessaments de socis únics i administradors publicats al
          BORME. Les coincidències amb el registre es fan per nom i poden contenir errors.
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-1">
        <ol>
          {visible.map((row) => (
            <YearLine key={row.year} row={row} maxTotal={maxTotal} />
          ))}
        </ol>
        {hidden.length > 0 ? (
          <details className="border-t border-gray-100 py-2">
            <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900">
              Veure {hidden.length} anys anteriors ({hidden[hidden.length - 1].year}–{hidden[0].year})
            </summary>
            <ol>
              {hidden.map((row) => (
                <YearLine key={row.year} row={row} maxTotal={maxTotal} />
              ))}
            </ol>
          </details>
        ) : null}
      </div>
    </div>
  );
}
