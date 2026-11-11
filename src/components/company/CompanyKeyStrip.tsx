import Link from "next/link";
import { formatCompactEuros } from "@/lib/indicators";
import { formatPersonDisplayName } from "@/lib/person-utils";
import { cleanEntityName, type KeyPerson } from "@/lib/seo/entity-summary";
import { formatNumber } from "@/lib/utils";

interface TopClient {
  nom_organ: string;
  total: string;
  num_contracts: string;
}

interface Props {
  /** Current owners and administrators, already ordered (see companyKeyPeople). */
  people: KeyPerson[];
  /** Fallback when BORME has nobody in charge (UTEs, foundations, public bodies...). */
  topClients: TopClient[];
  contractsCount: number;
}

const DESKTOP_SIZE = 3;
/** Fewer, shorter cards on phones, so the contracts list stays close. */
const MOBILE_SIZE = 2;

const cardClass =
  "group flex h-full flex-col justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 transition-colors hover:border-accent sm:px-4 sm:py-3";

interface Card {
  href: string;
  title: string;
  detail: string;
}

function personCard(person: KeyPerson): Card {
  return {
    href: `/persones/${encodeURIComponent(person.personName)}`,
    title: formatPersonDisplayName(person.personName),
    detail: person.sinceYear ? `${person.title} · des de ${person.sinceYear}` : person.title,
  };
}

function clientCard(client: TopClient): Card {
  const contracts = parseInt(client.num_contracts, 10) || 0;
  return {
    href: `/organismes/${encodeURIComponent(client.nom_organ)}`,
    title: cleanEntityName(client.nom_organ),
    detail: `${contracts === 1 ? "1 contracte" : `${formatNumber(contracts)} contractes`} · ${formatCompactEuros(parseFloat(client.total) || 0)}`,
  };
}

/**
 * The next click after the opening summary: who controls the company (the
 * angle only contractes.cat has), or its main public clients when BORME has
 * nobody. Same layout as the person-page strip that doubled clicks there.
 */
export default function CompanyKeyStrip({ people, topClients, contractsCount }: Props) {
  const usePeople = people.length > 0;
  const all = usePeople ? people.map(personCard) : topClients.map(clientCard);
  if (all.length === 0) return null;
  const cards = all.slice(0, DESKTOP_SIZE);
  const moreCount = all.length - cards.length;
  const mobileMore = all.length - Math.min(all.length, MOBILE_SIZE);
  const moreHref = usePeople ? "#administradors" : "#organismes";
  const moreLabel = (n: number) =>
    usePeople ? (n === 1 ? "1 persona més" : `${formatNumber(n)} persones més`) : n === 1 ? "1 organisme més" : `${formatNumber(n)} organismes més`;

  return (
    <div className="mt-5 max-w-5xl">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">
        {usePeople ? "Qui la controla segons el BORME" : "Principals clients públics"}
      </h2>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-2">
        {cards.map((card, i) => (
          <li key={card.href} className={i >= MOBILE_SIZE ? "hidden sm:block" : undefined}>
            <Link href={card.href} className={cardClass}>
              <span className="flex items-start justify-between gap-2">
                <span className="truncate font-medium text-gray-900 group-hover:underline sm:whitespace-normal">{card.title}</span>
                <span aria-hidden className="text-accent">
                  →
                </span>
              </span>
              <span className="mt-0.5 text-xs text-gray-600 sm:mt-1 sm:text-sm">{card.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm sm:hidden">
        {contractsCount > 0 ? (
          <a href="#contractes" className="font-medium text-accent hover:underline">
            {contractsCount === 1 ? "Veure el contracte" : `Veure els ${formatNumber(contractsCount)} contractes`} ↓
          </a>
        ) : null}
        {mobileMore > 0 ? (
          <a href={moreHref} className="text-accent hover:underline">
            {moreLabel(mobileMore)} ↓
          </a>
        ) : null}
      </div>
      {moreCount > 0 ? (
        <a href={moreHref} className="mt-2 hidden text-sm text-accent hover:underline sm:inline-block">
          {moreLabel(moreCount)} ↓
        </a>
      ) : null}
    </div>
  );
}
