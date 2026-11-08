import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { formatNumber } from "@/lib/utils";
import { formatPersonDisplayName } from "@/lib/person-utils";
import { cleanEntityName, type Controller } from "@/lib/seo/entity-summary";

interface Props {
  name: string;
  nif: string | null;
  numContracts: number;
  amountLabel: string;
  firstYear: number | null;
  lastYear: number | null;
  topOrgans: string[];
  lastAwardDate: string | null;
  owners: Controller[];
  admins: Controller[];
  relatedCount: number;
}

const MAX_PEOPLE = 4;

/** "A", "A i B", "A, B i C" for React nodes. */
function joinNodes(nodes: ReactNode[]): ReactNode {
  return nodes.map((node, i) => (
    <Fragment key={i}>
      {i > 0 ? (i === nodes.length - 1 ? " i " : ", ") : null}
      {node}
    </Fragment>
  ));
}

function PersonLink({ person }: { person: Controller }) {
  return (
    <Link href={`/persones/${encodeURIComponent(person.personName)}`} className="font-medium text-gray-900 hover:underline">
      {formatPersonDisplayName(person.personName)}
    </Link>
  );
}

function peopleList(people: Controller[]): ReactNode {
  const shown = people.slice(0, MAX_PEOPLE).map((person) => <PersonLink key={person.personName} person={person} />);
  const rest = people.length - shown.length;
  return joinNodes(rest > 0 ? [...shown, rest === 1 ? "1 persona més" : `${rest} persones més`] : shown);
}

/**
 * Plain-language summary under the company header: the text search engines and
 * AI answer engines quote. Pairs the contracts with who controls the company,
 * which is what only contractes.cat combines.
 */
export default function CompanySummary(props: Props) {
  const name = cleanEntityName(props.name);
  const years =
    props.firstYear && props.lastYear
      ? props.firstYear === props.lastYear
        ? ` el ${props.firstYear}`
        : ` entre ${props.firstYear} i ${props.lastYear}`
      : "";
  const contracts = props.numContracts === 1 ? "1 contracte públic" : `${formatNumber(props.numContracts)} contractes públics`;
  const hasControllers = props.owners.length + props.admins.length > 0;

  return (
    <div className="mt-6 max-w-4xl space-y-2 text-[15px] leading-relaxed text-gray-700">
      <p>
        <strong className="font-semibold text-gray-900">{name}</strong>
        {props.nif ? ` (NIF ${props.nif})` : ""} ha guanyat {contracts} a Catalunya{years}, per un import total de{" "}
        {props.amountLabel} (IVA inclòs).
        {props.topOrgans.length > 0 ? (
          <>
            {" "}
            {props.topOrgans.length === 1 ? "El seu principal client és " : "Els seus principals clients són "}
            {joinNodes(
              props.topOrgans.map((organ) => (
                <Link key={organ} href={`/organismes/${encodeURIComponent(organ)}`} className="text-gray-900 hover:underline">
                  {cleanEntityName(organ)}
                </Link>
              ))
            )}
            .
          </>
        ) : null}
        {props.lastAwardDate ? ` La darrera adjudicació és del ${props.lastAwardDate}.` : null}
      </p>
      {hasControllers || props.relatedCount > 0 ? (
        <p>
          {hasControllers ? (
            <>
              Segons el BORME,{" "}
              {props.owners.length > 0 ? (
                <>
                  {props.owners.length === 1 ? "n'és soci únic " : "en són socis únics "}
                  {peopleList(props.owners)}
                  {props.admins.length > 0 ? " i " : "."}
                </>
              ) : null}
              {props.admins.length > 0 ? (
                <>
                  {props.admins.length === 1 ? "l'administra " : "l'administren "}
                  {peopleList(props.admins)}.
                </>
              ) : null}{" "}
            </>
          ) : null}
          {props.relatedCount > 0 ? (
            <>
              Comparteix propietaris o administradors amb{" "}
              <a href="#relacionades" className="text-gray-900 underline decoration-dotted hover:decoration-solid">
                {props.relatedCount === 1 ? "1 altra empresa" : `${formatNumber(props.relatedCount)} empreses més`}
              </a>
              .
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
