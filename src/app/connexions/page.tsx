import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import ConnectionForm from "@/components/company/ConnectionForm";
import { findCompanyPath, type CompanyLinkEvidence, type PathNode, type PathStep } from "@/lib/borme";
import { formatSpanPeriod, formatSpanRole, isEntityName } from "@/lib/borme-format";
import { buildCompanyHref } from "@/lib/company-identity";
import { displayCompanyName, formatBormeCompanyName } from "@/lib/company-names";
import { formatPersonDisplayName } from "@/lib/person-utils";

interface Props {
  searchParams: Promise<{ a?: string; b?: string; an?: string; bn?: string }>;
}

const NIF_RE = /^[A-Z0-9]{8,10}$/;

// A search can expand a few hundred companies per hop: cache each pair for a
// day (the graph changes at most once a day). Failures throw so they are not cached.
const cachedFindPath = unstable_cache(
  async (a: string, b: string) => {
    const result = await findCompanyPath(a, b);
    if (result === null) throw new Error("BORME data unavailable");
    return result;
  },
  ["company-path-v1"],
  { revalidate: 86400 }
);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { a, b } = await searchParams;
  return {
    title: "Com estan connectades dues empreses?",
    description:
      "Troba la cadena de propietaris i administradors (BORME) que connecta dues empreses adjudicatàries de contractes públics a Catalunya.",
    alternates: { canonical: "/connexions" },
    // Individual comparisons are not useful search results.
    robots: a || b ? { index: false, follow: true } : undefined,
  };
}

function NodeCard({ node }: { node: PathNode }) {
  const name = displayCompanyName(node.name, node.hasMatchedName);
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      {node.nif ? (
        <Link href={buildCompanyHref(node.nif, name)} className="font-semibold text-gray-900 hover:underline">
          {name}
        </Link>
      ) : (
        <span className="font-semibold text-gray-900">{name}</span>
      )}
      {node.nif ? <span className="ml-2 font-mono text-xs text-gray-500">{node.nif}</span> : (
        <span className="ml-2 text-xs text-gray-500">sense contractes públics</span>
      )}
    </div>
  );
}

function Officer({ name }: { name: string }) {
  if (isEntityName(name)) return <strong className="font-medium">{formatBormeCompanyName(name)}</strong>;
  return (
    <Link href={`/persones/${encodeURIComponent(name)}`} className="font-medium text-gray-900 hover:underline">
      {formatPersonDisplayName(name)}
    </Link>
  );
}

function Pdf({ href }: { href: string | null }) {
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
      BORME
    </a>
  ) : null;
}

function StepEvidence({ step, ev }: { step: PathStep; ev: CompanyLinkEvidence }) {
  const from = displayCompanyName(step.from.name, step.from.hasMatchedName);
  const to = displayCompanyName(step.to.name, step.to.hasMatchedName);
  if (step.relation === "SHARED_ADMIN" && ev.relatedSpan) {
    return (
      <li>
        <Officer name={ev.officer} />: {formatSpanRole(ev.span)} a {from} ({formatSpanPeriod(ev.span)} <Pdf href={ev.span.sourcePdf} />)
        {" "}i {formatSpanRole(ev.relatedSpan)} a {to} ({formatSpanPeriod(ev.relatedSpan)} <Pdf href={ev.relatedSpan.sourcePdf} />)
      </li>
    );
  }
  // PARENT: `to` holds a role in `from`; SUBSIDIARY: `from` holds a role in `to`.
  const [holder, held] = step.relation === "PARENT" ? [to, from] : [from, to];
  return (
    <li>
      {holder} és {formatSpanRole(ev.span)} de {held} ({formatSpanPeriod(ev.span)} <Pdf href={ev.span.sourcePdf} />)
    </li>
  );
}

function stepTitle(step: PathStep): string {
  if (step.relation === "PARENT") return "n'és la matriu o l'administra";
  if (step.relation === "SUBSIDIARY") return "n'és filial o l'administra";
  return "comparteixen soci únic o administrador";
}

export default async function ConnectionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const a = (params.a || "").trim().toUpperCase();
  const b = (params.b || "").trim().toUpperCase();
  const valid = NIF_RE.test(a) && NIF_RE.test(b) && a !== b;
  const result = valid ? await cachedFindPath(a, b).catch(() => null) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-semibold text-gray-900">Com estan connectades?</h1>
      <p className="mt-2 text-gray-600">
        Tria dues empreses i et mostrem la cadena més curta de socis únics i administradors que les uneix segons el
        BORME, amb l&apos;enllaç a cada publicació. Fins a {4} salts.
      </p>

      <div className="mt-6">
        <ConnectionForm
          key={`${a}-${b}`}
          initialA={a ? { nif: a, name: params.an || a } : null}
          initialB={b ? { nif: b, name: params.bn || b } : null}
        />
      </div>

      {valid && result === null ? (
        <p className="mt-6 text-gray-600">Ara mateix no es poden consultar les dades del BORME. Torna-ho a provar més tard.</p>
      ) : null}

      {result && !result.found ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-700">
          No hem trobat cap connexió entre aquestes dues empreses
          {result.truncated ? " en 4 salts o menys" : ""} a partir dels socis únics i administradors publicats al BORME.
        </div>
      ) : null}

      {result && result.found ? (
        <section className="mt-8">
          <h2 className="mb-4 font-display text-xl font-semibold text-gray-900">
            Connectades en {result.steps.length} {result.steps.length === 1 ? "salt" : "salts"}
          </h2>
          <ol className="space-y-0">
            <li>
              <NodeCard node={result.steps[0].from} />
            </li>
            {result.steps.map((step, i) => (
              <li key={i}>
                <div className="ml-5 border-l-2 border-dashed border-gray-300 py-3 pl-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{stepTitle(step)}</p>
                  <ul className="mt-1 space-y-1 text-sm text-gray-700">
                    {step.evidence.slice(0, 3).map((ev, j) => (
                      <StepEvidence key={j} step={step} ev={ev} />
                    ))}
                  </ul>
                </div>
                <NodeCard node={step.to} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="mt-8 text-xs text-gray-500">
        Connexions deduïdes del BORME a partir del soci únic i dels administradors (inclosos presidents i consellers
        delegats). No s&apos;hi inclouen apoderats, secretaris ni administradors professionals que apareixen a més de 20
        empreses. El BORME no publica el DNI: la coincidència és per nom, i dues persones amb el mateix nom poden ser
        diferents. Una connexió no implica cap irregularitat.
      </p>
    </div>
  );
}
