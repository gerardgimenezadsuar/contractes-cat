import Link from "next/link";
import type { MaskedAwardeeCluster } from "@/lib/masked-awardee";
import { buildCompanyHref } from "@/lib/company-identity";
import { formatNumber } from "@/lib/utils";

const MAX_OTHERS = 8;

interface Props {
  cluster: MaskedAwardeeCluster;
  others: MaskedAwardeeCluster[];
}

/**
 * Explains that the awardee's id is an anonymised DNI shared with other
 * people, how this page groups it, and links to the others.
 */
export default function MaskedIdentityNotice({ cluster, others }: Props) {
  const spellings = new Set(cluster.members.map((m) => m.name.trim().replace(/\s+/g, " ").toUpperCase())).size;
  const shown = others.slice(0, MAX_OTHERS);

  return (
    <aside className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p>
        <span className="font-medium">Identificador anonimitzat.</span> El portal només publica 4 xifres del DNI
        (<span className="font-mono">{cluster.digits}</span>), i diverses persones les poden compartir. Aquí agrupem
        els contractes amb aquestes xifres i un nom coincident
        {spellings > 1 ? ` (${formatNumber(spellings)} variants del nom)` : ""}, sense barrejar-los amb altres
        adjudicataris.
      </p>
      {shown.length > 0 ? (
        <p className="mt-2">
          Altres adjudicataris amb les mateixes xifres:{" "}
          {shown.map((other, index) => (
            <span key={`${other.id}-${other.name}`}>
              {index > 0 ? ", " : ""}
              <Link href={buildCompanyHref(other.id, other.name)} className="text-accent hover:underline">
                {other.name.replace(/\s+/g, " ")}
              </Link>{" "}
              <span className="text-amber-800">({formatNumber(other.contracts)})</span>
            </span>
          ))}
          {others.length > shown.length ? ` i ${formatNumber(others.length - shown.length)} més` : ""}.
        </p>
      ) : null}
    </aside>
  );
}
