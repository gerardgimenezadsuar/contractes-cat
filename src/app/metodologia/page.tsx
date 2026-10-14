import type { Metadata } from "next";
import Link from "next/link";
import { COMPETITION_SINCE_YEAR } from "@/lib/api";
import { IDESCAT_FETCHED_AT } from "@/lib/idescat";

export const metadata: Metadata = {
  title: "Metodologia dels indicadors",
  description:
    "Com es calculen la despesa per habitant, les ofertes per licitació, la rebaixa sobre el pressupost, el pes dels contractes menors i la concentració de proveïdors a contractes.cat.",
  alternates: { canonical: "/metodologia" },
};

const SECTIONS = [
  {
    id: "per-habitant",
    title: "Despesa per habitant",
    body: [
      "Import adjudicat per l'organisme durant un any natural, IVA inclòs, dividit per la població del municipi segons el cens anual de població de l'Idescat (a 1 de gener). Es mostra l'últim any complet, mai l'any en curs, perquè una xifra parcial llegiria com una caiguda.",
      "L'organisme s'associa al municipi pel codi INE que el mateix organisme publica a cada contracte (camp codi_ine10 del dataset). Només té sentit per als ajuntaments; els consells comarcals, les diputacions i la Generalitat no tenen una població de referència comparable.",
    ],
  },
  {
    id: "ofertes",
    title: "Ofertes per licitació i licitacions amb una sola oferta",
    body: [
      `La competència només es pot mesurar on hi pot haver més d'una oferta i el nombre d'ofertes consta al dataset: procediments obert, obert simplificat i obert simplificat abreujat, adjudicats des del ${COMPETITION_SINCE_YEAR}, amb el camp d'ofertes rebudes informat i un pressupost de licitació superior a zero. Els contractes menors, els negociats i les adjudicacions directes queden fora.`,
      "El camp d'ofertes consta en aproximadament el 58 % dels procediments oberts del dataset, de manera que els indicadors descriuen aquest subconjunt. La mitjana d'ofertes és la mitjana aritmètica; la proporció amb una sola oferta compta les licitacions amb exactament una oferta sobre el total del subconjunt.",
    ],
  },
  {
    id: "rebaixa",
    title: "Rebaixa sobre el pressupost",
    body: [
      "Un menys el quocient entre la suma dels imports adjudicats sense IVA i la suma dels pressupostos de licitació sense IVA, sobre el mateix subconjunt de procediments oberts. Els contractes adjudicats per sobre del seu pressupost (modificacions, lots agregats o errors de publicació) s'exclouen del càlcul.",
      "Una rebaixa baixa pot indicar poca competència, però també pressupostos ajustats; cal llegir-la al costat del nombre d'ofertes.",
    ],
  },
  {
    id: "menors",
    title: "Pes dels contractes menors",
    body: [
      "Proporció de l'import i del nombre de contractes amb procediment «Contracte menor» sobre tots els contractes de l'organisme en l'últim any complet. Les franges properes al llindar dels 15.000 € s'analitzen a la pàgina d'anàlisi.",
    ],
  },
  {
    id: "concentracio",
    title: "Concentració de proveïdors",
    body: [
      "Suma de l'import adjudicat als cinc primers adjudicataris dividida per l'import total adjudicat per l'organisme des de 2023. Es limita a aquest període perquè alguns organismes tenen expedients agregats antics amb imports extraordinaris que distorsionarien qualsevol proporció.",
    ],
  },
  {
    id: "comparacio",
    title: "Comparació amb Catalunya",
    body: [
      "La referència «Catalunya» és el mateix indicador calculat sobre tots els organismes del dataset amb els mateixos filtres. La diferència es marca en verd o en àmbar només quan supera el 10 % del valor de referència; per sota es considera equivalent.",
    ],
  },
  {
    id: "fonts",
    title: "Fonts i límits",
    body: [
      "Contractació: dataset «Contractació del sector públic de la Generalitat de Catalunya i entitats» publicat al portal de dades obertes de la Generalitat, que inclou els contractes publicats a la Plataforma de serveis de contractació pública per tots els ens adherits. Els imports d'alguns registres antics contenen valors agregats de diversos lots; s'exclouen quan no es poden interpretar.",
      `Context municipal: Idescat, «El municipi en xifres» (població, renda familiar disponible bruta, PIB, índex socioeconòmic territorial i atur registrat). Fitxer actualitzat el ${IDESCAT_FETCHED_AT}; es regenera un cop l'any. El PIB i la renda municipals només es publiquen per als municipis de més de 1.000 i 5.000 habitants respectivament.`,
    ],
  },
];

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Metodologia</p>
      <h1 className="font-display text-3xl font-semibold leading-tight text-gray-900 md:text-4xl [text-wrap:balance]">
        Com es calculen els indicadors
      </h1>
      <p className="mt-3 max-w-prose text-gray-700">
        Les pàgines d&apos;organismes i d&apos;empreses resumeixen la contractació amb uns pocs indicadors. Aquí
        hi ha què mesura cadascun, amb quines dades i amb quines limitacions.
      </p>
      <nav aria-label="Indicadors" className="mt-6 flex flex-wrap gap-2 text-sm">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700 hover:border-gray-400">
            {section.title}
          </a>
        ))}
      </nav>
      <div className="mt-8 grid gap-8">
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-28">
            <h2 className="font-display text-xl font-semibold text-gray-900">{section.title}</h2>
            {section.body.map((paragraph, idx) => (
              <p key={idx} className="mt-2 max-w-prose text-gray-700">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm text-gray-500">
        Trobes un error o vols proposar un indicador? Obre una incidència al{" "}
        <Link href="/about" className="text-accent hover:underline">
          repositori del projecte
        </Link>
        .
      </p>
    </div>
  );
}
