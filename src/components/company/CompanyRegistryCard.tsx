import type { CompanyRegistry, CompanyRegistryEvent, CompanyRegistryStatus } from "@/lib/borme";
import type React from "react";
import { formatDate } from "@/lib/utils";

interface Props {
  registry: CompanyRegistry;
}

export const REGISTRY_STATUS_LABELS: Record<CompanyRegistryStatus, string> = {
  ACTIVA: "Activa",
  EN_LIQUIDACION: "En liquidació",
  EN_CONCURSO: "En concurs de creditors",
  CONVENI: "Conveni de creditors aprovat",
  EXTINGIDA: "Extingida",
  ABSORBIDA: "Absorbida en una fusió",
  HOJA_CERRADA: "Full registral tancat",
};

const STATUS_NOTES: Partial<Record<CompanyRegistryStatus, string>> = {
  EN_LIQUIDACION: "La societat ha acordat la dissolució i està liquidant el patrimoni.",
  CONVENI:
    "El jutjat va aprovar un conveni amb els creditors, que posa fi als efectes del concurs mentre es compleix. No consta encara que s'hagi complert.",
  EXTINGIDA: "La societat ja no existeix: el Registre Mercantil n'ha inscrit l'extinció.",
  ABSORBIDA: "La dissolució es va fer per fusió o escissió amb una altra societat.",
  HOJA_CERRADA:
    "Tancament provisional del full: Hisenda ha donat la societat de baixa de l'índex d'entitats o n'ha revocat el NIF. No pot inscriure actes nous.",
};

/** An insolvency with no published act for this long may have ended unnoticed (or moved out of Catalonia). */
const STALE_CONCURSO_YEARS = 6;

function isStaleConcurso(registry: Pick<CompanyRegistry, "status" | "concursoLastDate">): boolean {
  if (registry.status !== "EN_CONCURSO" || !registry.concursoLastDate) return false;
  const years = yearsSince(registry.concursoLastDate);
  return years != null && years >= STALE_CONCURSO_YEARS;
}

/** Header chip tone for a non-active status (see EntityHeader). */
export function registryStatusTone(
  registry: Pick<CompanyRegistry, "status" | "concursoLastDate">
): "warning" | "danger" | null {
  const { status } = registry;
  if (status === "ACTIVA") return null;
  if (status === "EN_LIQUIDACION" || status === "ABSORBIDA" || status === "CONVENI" || isStaleConcurso(registry)) return "warning";
  return "danger";
}

/** Short header label: dated facts only, never a bare claim for an old procedure. */
export function registryStatusChip(registry: CompanyRegistry): string {
  const label = REGISTRY_STATUS_LABELS[registry.status];
  if (registry.status === "EN_CONCURSO" && registry.concursoSince) {
    return isStaleConcurso(registry)
      ? `Concurs declarat el ${formatDate(registry.concursoSince)}`
      : `${label} (des del ${formatDate(registry.concursoSince)})`;
  }
  return registry.statusDate ? `${label} (${formatDate(registry.statusDate)})` : label;
}

const ACT_LABELS: Record<string, string> = {
  CONSTITUCION: "Constitució",
  CAMBIO_DOMICILIO: "Canvi de domicili social",
  AMPLIACION_CAPITAL: "Ampliació de capital",
  REDUCCION_CAPITAL: "Reducció de capital",
  REDUCCION_Y_AMPLIACION_CAPITAL: "Reducció i ampliació de capital",
  AMPLIACION_CAPITAL_SIN_EJECUTAR: "Acord d'ampliació de capital",
  DESEMBOLSO_DIVIDENDOS: "Desemborsament de capital pendent",
  CAMBIO_OBJETO: "Canvi d'objecte social",
  AMPLIACION_OBJETO: "Ampliació de l'objecte social",
  CAMBIO_DENOMINACION: "Canvi de nom",
  DISOLUCION: "Dissolució",
  EXTINCION: "Extinció",
  REACTIVACION: "Reactivació",
  FUSION_ABSORCION: "Fusió per absorció",
  FUSION_UNION: "Fusió",
  ESCISION_PARCIAL: "Escissió parcial",
  ESCISION_TOTAL: "Escissió total",
  SEGREGACION: "Segregació",
  CESION_GLOBAL: "Cessió global d'actiu i passiu",
  TRANSFORMACION: "Canvi de forma jurídica",
  DECLARACION_UNIPERSONALIDAD: "Declaració d'unipersonalitat",
  PERDIDA_UNIPERSONALIDAD: "Deixa de ser unipersonal",
  SOCIEDAD_UNIPERSONAL: "Canvi de soci únic",
  SITUACION_CONCURSAL: "Situació concursal",
  EMISION_OBLIGACIONES: "Emissió d'obligacions",
  PRIMERA_INSCRIPCION: "Primera inscripció",
  PRIMERA_SUCURSAL: "Primera sucursal",
  APERTURA_SUCURSAL: "Obertura de sucursal",
  CIERRE_SUCURSAL: "Tancament de sucursal",
  SUCURSAL: "Sucursal",
  REAPERTURA_HOJA: "Reobertura del full registral",
  CIERRE_HOJA_BAJA_IAE: "Full tancat: baixa a l'índex d'entitats",
  CIERRE_HOJA_NIF: "Full tancat: NIF revocat",
  CIERRE_HOJA_OTRO: "Tancament provisional del full",
  CREDITO_INCOBRABLE: "Crèdit incobrable",
  DEPOSITO_LIBROS: "Dipòsit de llibres",
  SOCIOS_PROFESIONALES: "Socis professionals",
  PAGINA_WEB: "Pàgina web",
  EMPRESARIO_INDIVIDUAL: "Empresari individual",
  DECLARACION: "Declaració",
};

/** BORME insolvency resolutions (folded upper case) -> Catalan. First match wins. */
const CONCURSO_RESOLUTIONS: Array<[string, string]> = [
  ["INCUMPLIMIENTO DE CONVENIO", "Incompliment del conveni"],
  ["CUMPLIMIENTO DE CONVENIO", "Conveni complert"],
  ["CONCLUSION DEL CONCURSO", "Conclusió del concurs"],
  ["CESE DE LAS LIMITACIONES", "Fi de les limitacions a l'administració"],
  ["ARCHIVO DE LAS ACTUACIONES", "Arxiu de les actuacions"],
  ["APROBACION DEL CONVENIO", "Aprovació del conveni amb els creditors"],
  ["APERTURA DE LA FASE DE CONVENIO", "Obertura de la fase de conveni"],
  ["PLAN DE LIQUIDACION", "Pla de liquidació"],
  ["FASE DE LIQUIDACION", "Obertura de la fase de liquidació"],
  ["REAPERTURA", "Reobertura del concurs"],
  ["DECLARACION DE CONCURSO", "Declaració de concurs"],
  ["DECLARACION DEL CONCURSO", "Declaració de concurs"],
  ["INTERVENCION O SUSPENSION", "Intervenció de les facultats d'administració"],
  ["NOMBRAMIENTO DE ADMINISTRADORES", "Nomenament de l'administració concursal"],
  ["REVOCACION DE ADMINISTRADORES", "Canvi de l'administració concursal"],
  ["CALIFICACION DEL CONCURSO CULPABLE", "Concurs qualificat de culpable"],
  ["CALIFICACION DEL CONCURSO FORTUITO", "Concurs qualificat de fortuït"],
  ["SECCION DE CALIFICACION", "Obertura de la secció de qualificació"],
  ["ACUMULACION", "Acumulació de concursos"],
];

function concursoLabel(fields: Record<string, unknown>): string {
  const res = (text(fields, "resolution") ?? text(fields, "text") ?? "")
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toUpperCase();
  return CONCURSO_RESOLUTIONS.find(([needle]) => res.includes(needle))?.[1] ?? "Resolució judicial";
}

const STATUS_CLASS: Record<CompanyRegistryStatus, string> = {
  ACTIVA: "text-accent",
  EN_LIQUIDACION: "text-amber-700",
  ABSORBIDA: "text-amber-700",
  EN_CONCURSO: "text-red-700",
  CONVENI: "text-amber-700",
  EXTINGIDA: "text-red-700",
  HOJA_CERRADA: "text-red-700",
};

const euros = new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

/** "CL BRETON DE LOS HERREROS NUM.27 (BARCELONA)" → "Cl Breton De Los Herreros Num.27 (Barcelona)", accent-safe. */
function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s(/'"\-.·])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function sentenceCase(value: string): string {
  const lower = value.toLowerCase().trim();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function provinceLabel(province: string): string {
  return titleCase(province);
}

function yearsSince(yyyymmdd: string): number | null {
  if (!/^\d{8}$/.test(yyyymmdd)) return null;
  const start = new Date(Number(yyyymmdd.slice(0, 4)), Number(yyyymmdd.slice(4, 6)) - 1, Number(yyyymmdd.slice(6, 8)));
  const years = (Date.now() - start.getTime()) / (365.25 * 24 * 3600 * 1000);
  return years >= 0 ? Math.floor(years) : null;
}

function text(fields: Record<string, unknown>, key: string): string | null {
  const v = fields[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(fields: Record<string, unknown>, key: string): number | null {
  const v = fields[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function eventDetail(ev: CompanyRegistryEvent): string | null {
  const f = ev.fields;
  switch (ev.actCode) {
    case "CONSTITUCION": {
      const parts = [];
      const capital = num(f, "capital");
      if (capital != null) parts.push(`capital de ${euros.format(capital)}`);
      const muni = text(f, "municipality");
      if (muni) parts.push(`a ${titleCase(muni)}`);
      return parts.length ? sentenceCase(parts.join(", ")) : null;
    }
    case "CAMBIO_DOMICILIO":
      return text(f, "address") ? titleCase(text(f, "address")!) : null;
    case "AMPLIACION_CAPITAL":
    case "REDUCCION_CAPITAL":
    case "REDUCCION_Y_AMPLIACION_CAPITAL":
    case "DESEMBOLSO_DIVIDENDOS": {
      const amount = num(f, "amount");
      const resulting = num(f, "resulting_capital");
      const parts = [];
      if (amount != null) parts.push(`${euros.format(amount)}`);
      if (resulting != null) parts.push(`capital resultant ${euros.format(resulting)}`);
      return parts.length ? parts.join(" · ") : null;
    }
    case "CAMBIO_DENOMINACION":
      return text(f, "new_name") ? `Nou nom: ${text(f, "new_name")}` : null;
    case "CAMBIO_OBJETO":
    case "AMPLIACION_OBJETO": {
      const obj = (f.object ?? {}) as Record<string, unknown>;
      const label = text(obj, "cnae_label");
      if (label) return `${text(obj, "cnae")} · ${sentenceCase(label)}`;
      const t = text(obj, "text");
      return t ? truncate(sentenceCase(t), 160) : null;
    }
    case "DISOLUCION":
      return text(f, "reason") ? truncate(sentenceCase(text(f, "reason")!), 160) : null;
    case "SITUACION_CONCURSAL": {
      const kind = concursoLabel(f);
      const court = text(f, "court");
      return court ? `${kind} · ${titleCase(court)}` : kind;
    }
    case "FUSION_ABSORCION":
    case "FUSION_UNION":
    case "ESCISION_PARCIAL":
    case "ESCISION_TOTAL":
    case "SEGREGACION":
    case "CESION_GLOBAL": {
      // Older builds kept "A S.L. B SL. C SL" as one entry: split after the legal form.
      const others = (Array.isArray(f.counterparties) ? (f.counterparties as string[]) : []).flatMap((name) =>
        name.split(/(?<=\b(?:SL|SA|SLU|SAU|SLP|S\.L|S\.A|S\.L\.U|S\.A\.U|B\.V|BV|GMBH|LTD|LIMITED|SRL|SAS))\.\s+/i)
      );
      return others.length ? `Amb ${others.slice(0, 3).join(", ")}${others.length > 3 ? "…" : ""}` : null;
    }
    case "TRANSFORMACION":
      return text(f, "new_form") ? truncate(text(f, "new_form")!, 160) : null;
    case "PAGINA_WEB":
      return text(f, "url");
    default: {
      const t = text(f, "text");
      return t ? truncate(sentenceCase(t), 160) : null;
    }
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function eventItem(ev: CompanyRegistryEvent, i: number) {
  const detail = eventDetail(ev);
  return (
    <li key={`${ev.date}-${ev.actCode}-${i}`} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 border-t border-gray-200 py-2 text-sm">
      <span className="tabular-nums text-gray-500">{formatDate(ev.date)}</span>
      <span className="min-w-0">
        {ev.sourcePdf ? (
          <a href={ev.sourcePdf} rel="nofollow noopener" target="_blank" className="font-medium text-gray-900 hover:text-accent hover:underline">
            {ACT_LABELS[ev.actCode]}
          </a>
        ) : (
          <span className="font-medium text-gray-900">{ACT_LABELS[ev.actCode]}</span>
        )}
        {detail ? <span className="block text-gray-600 [overflow-wrap:anywhere]">{detail}</span> : null}
      </span>
    </li>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-t border-gray-200 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="min-w-0 text-sm text-gray-900 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Acts shown before "Veure tots els actes"; the rest stay one click away. */
const VISIBLE_EVENTS = 6;
const MAX_EVENTS = 40;

/**
 * "Fitxa mercantil": what the Registre Mercantil says about the company beyond
 * its people — status, age, domicile, capital, activity and the latest acts,
 * each linked to its BORME publication.
 */
export default function CompanyRegistryCard({ registry }: Props) {
  const age = registry.constitutionDate ? yearsSince(registry.constitutionDate) : null;
  const stale = isStaleConcurso(registry);
  const statusNote =
    registry.status === "EN_CONCURSO"
      ? stale
        ? `Darrer acte concursal publicat el ${formatDate(registry.concursoLastDate ?? undefined)}. Pot haver conclòs sense que consti al BORME de Catalunya.`
        : `Procediment obert segons el darrer acte concursal publicat (${formatDate(registry.concursoLastDate ?? undefined)}).`
      : STATUS_NOTES[registry.status];
  const pastConcurso =
    registry.status !== "EN_CONCURSO" && registry.status !== "CONVENI" && registry.concursoKind === "CLOSED" && registry.concursoLastDate;
  const events = registry.events.filter((ev) => ACT_LABELS[ev.actCode]).slice(0, MAX_EVENTS);
  const website = registry.website ? (registry.website.startsWith("http") ? registry.website : `https://${registry.website}`) : null;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <dl className="border-b border-gray-200">
        <Row label="Estat">
          <span className={`font-medium ${stale ? "text-amber-700" : STATUS_CLASS[registry.status]}`}>
            {stale ? "Concurs de creditors declarat" : REGISTRY_STATUS_LABELS[registry.status]}
          </span>
          {registry.statusDate && registry.status !== "ACTIVA" ? (
            <span className="text-gray-600">
              {stale ? " el " : " des del "}
              {formatDate(registry.statusDate)}
            </span>
          ) : null}
          {statusNote ? <p className="mt-1 text-xs text-gray-600">{statusNote}</p> : null}
        </Row>
        {pastConcurso || registry.concursoCalificacion ? (
          <Row label="Concurs de creditors">
            {pastConcurso ? <>Concurs conclòs (darrer acte el {formatDate(registry.concursoLastDate ?? undefined)})</> : null}
            {registry.concursoCalificacion === "CULPABLE" ? (
              <p className={pastConcurso ? "mt-1 text-red-700" : "text-red-700"}>Qualificat de culpable pel jutjat</p>
            ) : registry.concursoCalificacion === "FORTUITO" ? (
              <p className={pastConcurso ? "mt-1 text-gray-700" : "text-gray-700"}>Qualificat de fortuït pel jutjat</p>
            ) : null}
          </Row>
        ) : null}
        <Row label="Constitució">
          {registry.constitutionDate ? (
            <>
              {formatDate(registry.constitutionDate)}
              {age != null ? <span className="text-gray-600"> · {age === 1 ? "1 any" : `${age} anys`}</span> : null}
            </>
          ) : (
            <span className="text-gray-600">Anterior al 2009 o inscrita fora de Catalunya</span>
          )}
        </Row>
        {registry.address ? (
          <Row label="Domicili social">
            {titleCase(registry.address)}
            {registry.addressDate ? <span className="text-gray-600"> · inscrit el {formatDate(registry.addressDate)}</span> : null}
          </Row>
        ) : null}
        {registry.capital != null ? (
          <Row label="Capital social">
            {euros.format(registry.capital)}
            {registry.capitalDate ? <span className="text-gray-600"> · darrer canvi el {formatDate(registry.capitalDate)}</span> : null}
          </Row>
        ) : null}
        {registry.cnae || registry.object ? (
          <Row label="Activitat">
            {registry.cnae && registry.cnaeLabel ? (
              <p>
                <span className="font-mono text-gray-600">CNAE {registry.cnae}</span> · {sentenceCase(registry.cnaeLabel)}
              </p>
            ) : null}
            {registry.object ? (
              <details className="group mt-0.5">
                <summary className="cursor-pointer list-none text-gray-700 [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">{truncate(sentenceCase(registry.object), 180)}</span>
                  <span className="hidden group-open:inline">{sentenceCase(registry.object)}</span>
                  {registry.object.length > 180 ? (
                    <span className="ml-1 text-accent group-open:hidden">Veure&apos;n més</span>
                  ) : null}
                </summary>
              </details>
            ) : null}
          </Row>
        ) : null}
        {registry.formerNames.length > 0 ? (
          <Row label={registry.formerNames.length === 1 ? "Nom anterior" : "Noms anteriors"}>
            {registry.formerNames.slice(0, 6).join(" · ")}
          </Row>
        ) : null}
        {website ? (
          <Row label="Web inscrita">
            <a href={website} rel="nofollow noopener" target="_blank" className="text-accent hover:underline">
              {registry.website}
            </a>
          </Row>
        ) : null}
        <Row label="Registre">
          Registre Mercantil de {provinceLabel(registry.province)}
          {registry.hoja ? <span className="text-gray-600"> · full {registry.hoja.replace(/^_-/, "")}</span> : null}
        </Row>
      </dl>

      {events.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Darrers actes inscrits</h3>
          <ol className="border-b border-gray-200">{events.slice(0, VISIBLE_EVENTS).map(eventItem)}</ol>
          {events.length > VISIBLE_EVENTS ? (
            <details className="group">
              <summary className="mt-2 cursor-pointer list-none text-sm text-accent hover:underline group-open:hidden [&::-webkit-details-marker]:hidden">
                Veure tots els actes ({events.length})
              </summary>
              <ol className="border-b border-gray-200">{events.slice(VISIBLE_EVENTS).map(eventItem)}</ol>
            </details>
          ) : null}
          <p className="mt-2 text-xs text-gray-500">
            Font: BORME, secció primera (actes inscrits), des del 2009. Cada acte enllaça a la publicació original.
          </p>
        </div>
      ) : null}
    </div>
  );
}
