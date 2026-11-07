import Link from "next/link";
import type { CompanyLinkEvidence, CompanyLinkSpan, RelatedCompany } from "@/lib/borme";
import type { AwardeeTotals } from "@/lib/api";
import { buildCompanyHref } from "@/lib/company-identity";
import { formatCompactEuros } from "@/lib/indicators";
import { formatNumber } from "@/lib/utils";
import { formatPersonDisplayName, toTitleCase } from "@/lib/person-utils";

const VISIBLE_ROWS = 10;
const ENTITY_SUFFIX = /\b(SL|SA|SLU|SAU|SLP|SLL|SCCL|S\.?L\.?U?|S\.?A\.?U?|SOCIEDAD|SOCIETAT|AIE|FUNDACION|FUNDACIO|COOPERATIVA)\b\.?$/i;

interface Props {
  companyName: string;
  related: RelatedCompany[];
  totals: Map<string, AwardeeTotals>;
}

function isEntityName(name: string): boolean {
  return ENTITY_SUFFIX.test(name.trim());
}

const LEGAL_TOKENS = /\b(Sl|Sa|Slu|Sau|Slp|Sll|Sccl|Scp|Aie|Ute|S\.l|S\.a|S\.l\.u|S\.a\.u)\b\.?/g;

/** BORME names are uppercase: title-case them but keep legal forms (SL, SA…) uppercase. */
function formatBormeCompanyName(name: string): string {
  return toTitleCase(name).replace(LEGAL_TOKENS, (m) => m.toUpperCase());
}

function year(d: string | null): string {
  return d && d.length >= 4 ? d.slice(0, 4) : "";
}

function period(span: CompanyLinkSpan): string {
  const start = year(span.dateStart);
  if (!span.dateEnd) return start ? `des de ${start}` : "actual";
  const end = year(span.dateEnd);
  return start === end ? start : `${start}–${end}`;
}

function roleLabel(span: CompanyLinkSpan): string {
  if (span.roleClass === "OWNER") return "soci únic";
  const code = span.roleCode.toUpperCase();
  if (code.includes("VICEPRESID")) return "vicepresidència";
  if (code.includes("PRESIDEN")) return "presidència";
  if (code.includes("CONS_DEL") || code.includes("CONS_EJECUT")) return "conseller delegat";
  if (code.includes("SOLID")) return "adm. solidari";
  if (code.includes("CONJUNT") || code.includes("MANC")) return "adm. mancomunat";
  if (code.includes("UNICO")) return "adm. únic";
  return "administració";
}

function relationLabel(company: RelatedCompany): string {
  const labels: string[] = [];
  for (const type of company.linkTypes) {
    const ev = company.evidence.find((e) => e.linkType === type);
    if (type === "PARENT") labels.push(ev?.span.roleClass === "OWNER" ? "Matriu (n'és sòcia única)" : "L'administra");
    else if (type === "SUBSIDIARY") labels.push(ev?.span.roleClass === "OWNER" ? "Filial (n'és sòcia única)" : "N'és administradora");
    else {
      const bothOwners = company.evidence.some(
        (e) => e.linkType === "SHARED_ADMIN" && e.span.roleClass === "OWNER" && e.relatedSpan?.roleClass === "OWNER"
      );
      labels.push(bothOwners ? "Mateix soci únic" : "Administració compartida");
    }
  }
  return Array.from(new Set(labels)).join(" · ");
}

function OfficerName({ name }: { name: string }) {
  if (isEntityName(name)) return <span>{formatBormeCompanyName(name)}</span>;
  return (
    <Link href={`/persones/${encodeURIComponent(name)}`} className="text-gray-900 hover:underline">
      {formatPersonDisplayName(name)}
    </Link>
  );
}

function PdfLink({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
      BORME
    </a>
  );
}

function SpanText({ span }: { span: CompanyLinkSpan }) {
  return (
    <>
      {roleLabel(span)}, {period(span)}
      {span.sourcePdf ? (
        <>
          {" "}
          <PdfLink href={span.sourcePdf} />
        </>
      ) : null}
    </>
  );
}

function EvidenceLine({ ev, companyName }: { ev: CompanyLinkEvidence; companyName: string }) {
  if (ev.linkType === "SHARED_ADMIN" && ev.relatedSpan) {
    return (
      <li>
        <OfficerName name={ev.officer} /> · aquí: <SpanText span={ev.span} /> · allà: <SpanText span={ev.relatedSpan} />
      </li>
    );
  }
  // PARENT: the related company holds a role in this one; SUBSIDIARY: the reverse.
  return (
    <li>
      {ev.linkType === "PARENT" ? `Té ${roleLabel(ev.span)} de ${companyName}` : `${companyName} n'és ${roleLabel(ev.span)}`}{" "}
      ({period(ev.span)}
      {ev.span.sourcePdf ? (
        <>
          {" "}
          <PdfLink href={ev.span.sourcePdf} />
        </>
      ) : null}
      )
    </li>
  );
}

function RelatedRow({ company, totals, companyName }: { company: RelatedCompany; totals?: AwardeeTotals; companyName: string }) {
  const evidence = company.evidence.slice(0, 3);
  const displayName =
    company.hasMatchedName && company.name !== company.name.toUpperCase()
      ? company.name
      : formatBormeCompanyName(company.name);
  return (
    <li className="grid grid-cols-1 gap-2 border-b border-gray-100 px-4 py-3 last:border-b-0 md:grid-cols-12 md:gap-4">
      <div className="min-w-0 md:col-span-5">
        {company.nif && totals ? (
          <Link
            href={buildCompanyHref(company.nif, company.name)}
            className="break-words text-sm font-semibold text-gray-900 hover:underline"
          >
            {displayName}
          </Link>
        ) : (
          <span className="break-words text-sm font-semibold text-gray-900">{displayName}</span>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{relationLabel(company)}</span>
          {company.active ? (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">Vigent</span>
          ) : (
            <span className="rounded bg-gray-50 px-1.5 py-0.5 text-gray-500">Històric</span>
          )}
          {company.nif ? <span className="font-mono text-gray-500">{company.nif}</span> : null}
        </div>
      </div>
      <ul className="min-w-0 space-y-1 text-xs text-gray-600 md:col-span-5">
        {evidence.map((ev, i) => (
          <EvidenceLine key={`${ev.officer}-${i}`} ev={ev} companyName={companyName} />
        ))}
        {company.strength > evidence.length ? (
          <li className="text-gray-400">i {company.strength - evidence.length} coincidència(es) més</li>
        ) : null}
      </ul>
      <div className="text-sm md:col-span-2 md:text-right">
        {totals ? (
          <>
            <p className="font-medium text-gray-900">{formatCompactEuros(totals.total)}</p>
            <p className="text-xs text-gray-500">{formatNumber(totals.numContracts)} contractes</p>
          </>
        ) : (
          <p className="text-xs text-gray-400">Sense contractes públics</p>
        )}
      </div>
    </li>
  );
}

export default function RelatedCompaniesSection({ companyName, related, totals }: Props) {
  const rows = [...related].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const ta = a.nif ? totals.get(a.nif.toUpperCase())?.total ?? 0 : 0;
    const tb = b.nif ? totals.get(b.nif.toUpperCase())?.total ?? 0 : 0;
    if (ta !== tb) return tb - ta;
    return b.strength - a.strength;
  });
  const withContracts = rows.filter((r) => r.nif && totals.has(r.nif.toUpperCase()));
  const groupTotal = withContracts.reduce((sum, r) => sum + (totals.get(r.nif!.toUpperCase())?.total ?? 0), 0);
  const renderRow = (company: RelatedCompany) => (
    <RelatedRow
      key={company.relatedId}
      company={company}
      companyName={companyName}
      totals={company.nif ? totals.get(company.nif.toUpperCase()) : undefined}
    />
  );

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-gray-900">Empreses relacionades (BORME)</h2>
        <p className="text-sm text-gray-600">
          {formatNumber(rows.length)} empreses
          {withContracts.length > 0
            ? `, ${formatNumber(withContracts.length)} amb contractes públics (${formatCompactEuros(groupTotal)})`
            : ""}
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white">
        <ul>{rows.slice(0, VISIBLE_ROWS).map(renderRow)}</ul>
        {rows.length > VISIBLE_ROWS ? (
          <details className="border-t border-gray-100">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-accent hover:underline">
              Mostra les altres {formatNumber(rows.length - VISIBLE_ROWS)} empreses
            </summary>
            <ul>{rows.slice(VISIBLE_ROWS).map(renderRow)}</ul>
          </details>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Relacions deduïdes del BORME a partir del soci únic i dels administradors (inclosos presidents i consellers
        delegats). No s&apos;hi inclouen apoderats, secretaris, liquidadors ni administradors professionals que
        apareixen a més de 20 empreses. El BORME no publica el DNI: la coincidència és per nom, i dues persones amb el
        mateix nom poden ser diferents. Tampoc publica els socis de les societats amb més d&apos;un soci.
      </p>
    </section>
  );
}
