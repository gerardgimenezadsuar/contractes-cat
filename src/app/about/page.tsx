import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, GITHUB_URL, SOCRATA_DATASET_URL, CREATOR_NAME, CREATOR_URL } from "@/config/constants";
import SharePageButton from "@/components/ui/SharePageButton";

export const metadata: Metadata = {
  title: "Sobre el projecte",
  description:
    "Informació sobre contractes.cat, les dades, la metodologia i l'avís legal.",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">
          Sobre {SITE_NAME}
        </h1>
        <SharePageButton className="shrink-0" />
      </div>

      {/* Disclaimer */}
      <section className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold text-amber-900 mb-2">
          Avís important
        </h2>
        <p className="text-amber-800">
          <strong>Aquesta no és una web oficial del govern.</strong> {SITE_NAME}{" "}
          és un projecte independent i de codi obert que utilitza dades
          públiques per facilitar l&apos;anàlisi de la contractació pública a
          Catalunya. No tenim cap vinculació amb la Generalitat de Catalunya ni
          amb cap administració pública.
        </p>
      </section>

      {/* About */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Què és {SITE_NAME}?
        </h2>
        <p className="text-gray-600 mb-4">
          {SITE_NAME} és una plataforma d&apos;anàlisi de dades obertes que
          permet als ciutadans explorar i entendre com es gasten els diners
          públics en contractació a Catalunya. El nostre objectiu és fer
          accessible i comprensible la informació sobre contractes públics que
          ja és pública però sovint difícil de navegar.
        </p>
        <p className="text-gray-600">
          Creiem que la transparència és fonamental per a una democràcia sana.
          Aquesta eina permet a qualsevol persona veure quines empreses reben
          els contractes públics, per quins imports i amb quins procediments.
        </p>
      </section>

      {/* Data source */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Font de dades
        </h2>
        <p className="text-gray-600 mb-4">
          Totes les dades provenen del conjunt de dades{" "}
          <a
            href={SOCRATA_DATASET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            &quot;Contractació pública a Catalunya: publicacions a la Plataforma de
            serveis de contractació pública&quot;
          </a>{" "}
          publicat pel Departament d&apos;Economia i Hisenda de la Generalitat
          de Catalunya a la plataforma de Transparència de Catalunya.
        </p>
        <p className="text-gray-600 mb-4">
          El conjunt de dades conté les publicacions de l&apos;activitat
          contractual dels òrgans de contractació que publiquen a la Plataforma
          de serveis de contractació pública de Catalunya. <strong>Pot no incloure la
          totalitat dels contractes públics de Catalunya</strong>, ja que no totes
          les administracions i entitats públiques publiquen els seus contractes
          en aquesta plataforma.
        </p>
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-900 mb-2">Detalls tècnics:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>API: Socrata Open Data (SODA)</li>
            <li>Actualització: Les dades s&apos;actualitzen periòdicament a la font</li>
            <li>Memòria cau: Les dades es refresquen aproximadament cada 6 hores</li>
            <li>
              Un petit nombre de registres (~0,3%) amb dades inconsistents
              s&apos;exclouen dels càlculs agregats
            </li>
          </ul>
        </div>
      </section>

      {/* Methodology */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Metodologia
        </h2>
        <p className="text-gray-600 mb-4">
          Les agregacions (imports totals, mitjanes, etc.) es calculen
          directament a la base de dades mitjançant consultes SoQL, excloent
          registres amb dades d&apos;import corruptes. Els imports sense IVA i
          amb IVA es mostren tal com estan publicats a la font original.
        </p>
        <p className="text-gray-600">
          L&apos;anàlisi del llindar de contractes menors es basa en el límit
          legal de 15.000 EUR (sense IVA) per a contractes de serveis i
          subministraments. La distribució mostra la concentració de contractes
          en rangs de 500 EUR per identificar possibles patrons.
        </p>
      </section>

      {/* Privacy and legal */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Privacitat i avís legal
        </h2>
        <p className="text-gray-600 mb-4">
          Utilitzem analítica agregada per entendre l&apos;ús general del web i
          millorar-lo tècnicament. No fem perfilat personal ni publicitat
          dirigida.
        </p>
        <p className="text-gray-600">
          Pots consultar el detall complet a{" "}
          <Link href="/legal" className="text-blue-600 hover:underline">
            l&apos;avís legal i política de privacitat
          </Link>
          .
        </p>
      </section>

      {/* Creator */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Qui som
        </h2>
        <p className="text-gray-600 mb-4">
          {SITE_NAME} ha estat creat i publicat com a codi obert per{" "}
          <a
            href={CREATOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-medium"
          >
            {CREATOR_NAME}
          </a>
          , una empresa d&apos;enginyeria d&apos;intel&middot;lig&egrave;ncia
          artificial amb seu a Barcelona, Catalunya. Creiem en l&apos;ús de la
          tecnologia per millorar la transparència i l&apos;accés a la
          informació pública.
        </p>
      </section>

      {/* Open source */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Codi obert
        </h2>
        <p className="text-gray-600 mb-4">
          {SITE_NAME} és un projecte de codi obert. Tot el codi font està
          disponible a GitHub perquè qualsevol persona pugui auditar-lo,
          contribuir-hi o crear-ne una versió pròpia.
        </p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          Veure a GitHub
        </a>
      </section>

      {/* Contact */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Contacte
        </h2>
        <p className="text-gray-600">
          Si tens suggeriments, has trobat un error o vols contribuir al
          projecte, pots obrir una{" "}
          <a
            href={`${GITHUB_URL}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            issue a GitHub
          </a>
          .
        </p>
      </section>
    </div>
  );
}
