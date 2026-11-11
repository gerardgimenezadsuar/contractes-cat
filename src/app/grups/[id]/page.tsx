import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import EntityHeader, { type KeyFigure } from "@/components/entity/EntityHeader";
import SharePageButton from "@/components/ui/SharePageButton";
import { fetchAwardeeTotalsByNifs, type AwardeeTotals } from "@/lib/api";
import { loadCompanyGroup, type CompanyGroupMember } from "@/lib/borme";
import { buildCompanyHref } from "@/lib/company-identity";
import { displayCompanyName } from "@/lib/company-names";
import { formatCompactEuros } from "@/lib/indicators";
import { formatNumber } from "@/lib/utils";

export const revalidate = 21600;

export async function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ id: string }>;
}

const getGroup = cache(async (rawId: string) => {
  const id = Number.parseInt(rawId, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return loadCompanyGroup(id);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getGroup(id);
  if (!data) return { title: "Grup empresarial" };
  const name = displayCompanyName(data.group.rootName, false);
  const title = `Grup ${name}`;
  const description = `${formatNumber(data.group.size)} empreses del grup ${name} segons el BORME, amb ${formatCompactEuros(
    data.group.totalAmount
  )} en contractes públics a Catalunya.`;
  const path = `/grups/${data.group.groupId}`;
  // og:image comes from ./opengraph-image.tsx.
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

function year(d: string | null): string {
  return d && d.length >= 4 ? d.slice(0, 4) : "";
}

/** Members in tree order (depth-first from each root), so indentation reads as a hierarchy. */
function treeOrder(members: CompanyGroupMember[]): CompanyGroupMember[] {
  const children = new Map<number | null, CompanyGroupMember[]>();
  for (const m of members) {
    const key = m.parentId;
    if (!children.has(key)) children.set(key, []);
    children.get(key)!.push(m);
  }
  for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name, "ca"));
  const out: CompanyGroupMember[] = [];
  const seen = new Set<number>();
  const visit = (m: CompanyGroupMember) => {
    if (seen.has(m.companyId)) return;
    seen.add(m.companyId);
    out.push(m);
    for (const child of children.get(m.companyId) ?? []) visit(child);
  };
  for (const root of children.get(null) ?? []) visit(root);
  for (const m of members) visit(m); // anything left (defensive)
  return out;
}

function MemberRow({ member, totals }: { member: CompanyGroupMember; totals?: AwardeeTotals }) {
  const name = displayCompanyName(member.name, member.hasMatchedName);
  const indent = Math.min(member.depth, 6);
  return (
    <li className="flex flex-col gap-1 border-b border-gray-100 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0" style={{ paddingLeft: `${indent * 1.25}rem` }}>
        <div className="flex items-start gap-2">
          {member.depth > 0 ? <span aria-hidden className="text-gray-300">└</span> : null}
          <div className="min-w-0">
            {member.nif && totals ? (
              <Link href={buildCompanyHref(member.nif, name)} className="break-words text-sm font-semibold text-gray-900 hover:underline">
                {name}
              </Link>
            ) : (
              <span className="break-words text-sm font-semibold text-gray-900">{name}</span>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {member.depth === 0 ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">Capçalera</span> : null}
              {member.nif ? <span className="font-mono">{member.nif}</span> : null}
              {member.parentId != null && member.since ? (
                <span>
                  filial des de {year(member.since)}
                  {member.sourcePdf ? (
                    <>
                      {" "}
                      <a href={member.sourcePdf} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        BORME
                      </a>
                    </>
                  ) : null}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="shrink-0 text-sm sm:text-right" style={{ paddingLeft: `${indent * 1.25}rem` }}>
        {totals ? (
          <>
            <span className="font-medium text-gray-900">{formatCompactEuros(totals.total)}</span>
            <span className="ml-2 text-xs text-gray-500">{formatNumber(totals.numContracts)} contractes</span>
          </>
        ) : (
          <span className="text-xs text-gray-400">Sense contractes públics</span>
        )}
      </div>
    </li>
  );
}

export default async function GroupPage({ params }: Props) {
  const { id } = await params;
  const data = await getGroup(id);
  if (!data) notFound();
  const { group, members } = data;

  const totals = await fetchAwardeeTotalsByNifs(members.flatMap((m) => (m.nif ? [m.nif] : []))).catch(
    () => new Map<string, AwardeeTotals>()
  );
  const ordered = treeOrder(members);
  const name = displayCompanyName(group.rootName, false);

  const figures: KeyFigure[] = [
    { label: "Total adjudicat", value: formatCompactEuros(group.totalAmount), note: "IVA inclòs, empreses del grup" },
    { label: "Contractes", value: formatNumber(group.numContracts), note: "de totes les empreses del grup" },
    { label: "Empreses del grup", value: formatNumber(group.size), note: "segons el BORME" },
    { label: "Amb contractes públics", value: formatNumber(group.numContractors), note: "empreses adjudicatàries" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8">
      <EntityHeader
        backHref="/grups"
        backLabel="Tornar a grups empresarials"
        eyebrow="Grup empresarial (BORME)"
        title={name}
        figures={figures}
        actions={<SharePageButton className="shrink-0" />}
      />

      <section className="pt-8">
        <h2 className="mb-3 font-display text-xl font-semibold text-gray-900">Empreses del grup</h2>
        <ul className="rounded-lg border border-gray-200 bg-white">
          {ordered.map((m) => (
            <MemberRow key={m.companyId} member={m} totals={m.nif ? totals.get(m.nif.toUpperCase()) : undefined} />
          ))}
        </ul>
        <p className="mt-2 text-xs text-gray-500">
          Grup reconstruït a partir del BORME: una empresa forma part del grup quan una altra n&apos;és la sòcia única
          segons la darrera inscripció publicada. El BORME no publica els socis de les societats amb més d&apos;un soci,
          de manera que el grup real pot ser més gran. No s&apos;hi inclouen empreses que venen societats ja constituïdes
          ni proveïdors de serveis corporatius.
        </p>
      </section>
    </div>
  );
}
