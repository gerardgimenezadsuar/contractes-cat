import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, GITHUB_URL, CREATOR_NAME, CREATOR_URL } from "@/config/constants";

export const metadata: Metadata = {
  title: "Avís legal i privacitat",
  description:
    "Informació legal, privacitat i ús d'analítica de contractes.cat.",
};

export default function LegalPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Avís legal i privacitat
      </h1>

      <section className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-lg font-semibold text-amber-900 mb-2">Resum curt</h2>
        <p className="text-sm text-amber-900">
          {SITE_NAME} és un projecte independent. No fem perfilat personal ni
          publicitat dirigida. Només utilitzem analítica agregada per entendre
          l'ús general del web.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Responsable del web</h2>
        <p className="text-gray-700 mb-3">
          Aquest web és un projecte independent i no oficial. El seu objectiu és
          facilitar la transparència sobre la contractació pública a Catalunya a
          partir de dades obertes.
        </p>
        <p className="text-gray-700">
          Responsable del tractament:{" "}
          <a
            href={CREATOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {CREATOR_NAME}
          </a>
          , com a titular del projecte {SITE_NAME}.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Quines dades tractem</h2>
        <p className="text-gray-700 mb-3">
          No demanem registre, no recollim noms, correus electrònics ni altres
          dades identificatives mitjançant formularis propis.
        </p>
        <p className="text-gray-700">
          Tractem únicament dades tècniques mínimes de navegació necessàries per
          operar el servei i mesurar-ne l'ús de forma agregada. Tampoc venem
          dades ni les cedim per a finalitats comercials.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Finalitats i base jurídica
        </h2>
        <p className="text-gray-700 mb-3">
          Finalitats del tractament:
        </p>
        <ul className="list-disc list-inside text-gray-700 space-y-1 mb-3">
          <li>Operació tècnica, seguretat i prevenció d'abús.</li>
          <li>Mesura agregada d'ús i rendiment per millorar el servei.</li>
        </ul>
        <p className="text-gray-700 mb-3">
          Base jurídica principal: interès legítim del responsable (article
          6.1.f RGPD) per mantenir, assegurar i millorar el servei.
        </p>
        <p className="text-gray-700">
          En matèria de cookies/tecnologies similars, apliquem criteri estricte
          de minimització i transparència conforme la LSSI i la Guia de cookies
          de l'AEPD.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Analítica d'ús (Vercel Analytics)
        </h2>
        <p className="text-gray-700 mb-3">
          Utilitzem Vercel Analytics per obtenir mètriques agregades d'ús
          (per exemple, visites de pàgina i rendiment general), amb finalitat
          exclusivament estadística i de millora tècnica del servei.
        </p>
        <p className="text-gray-700 mb-3">
          Segons la configuració actual del projecte, no fem perfilat d'usuari
          ni intentem identificar persones de manera individual.
        </p>
        <p className="text-gray-700">
          Si en el futur s'afegeixen tecnologies de seguiment que exigeixin
          consentiment previ, s'implementarà el mecanisme corresponent abans
          d'activar-les.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Encarregats del tractament i transferències internacionals
        </h2>
        <p className="text-gray-700 mb-3">
          El servei pot utilitzar proveïdors tècnics (encarregats del
          tractament), incloent Vercel per hosting i analítica.
        </p>
        <p className="text-gray-700 mb-3">
          Quan correspongui, les transferències internacionals de dades es
          basaran en garanties adequades previstes al RGPD (com clàusules
          contractuals tipus) segons la documentació del proveïdor.
        </p>
        <a
          href="https://vercel.com/legal/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Política de privacitat de Vercel
        </a>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Conservació de dades
        </h2>
        <p className="text-gray-700">
          Conservem les dades tècniques durant el temps necessari per operar i
          protegir el servei, i les dades analítiques en format agregat mentre
          siguin útils per seguiment d'ús i millora del producte.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Drets de les persones usuàries
        </h2>
        <p className="text-gray-700 mb-3">
          Pots exercir, quan sigui aplicable, els drets d'accés,
          rectificació, supressió, oposició, limitació i portabilitat.
        </p>
        <p className="text-gray-700">
          També tens dret a presentar reclamació davant l'autoritat de
          control competent (AEPD).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Canvis en aquesta política</h2>
        <p className="text-gray-700">
          Aquesta pàgina es revisarà si canvia el funcionament del web, els
          proveïdors o la normativa aplicable. Data d'última actualització:
          9 de febrer de 2026.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">Contacte i incidències</h2>
        <p className="text-gray-700 mb-3">
          Si detectes algun problema legal o de privacitat, obre una issue a{" "}
          <a
            href={`${GITHUB_URL}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            GitHub
          </a>
          .
        </p>
        <p className="text-gray-700">
          Pots ampliar context sobre el projecte a{" "}
          <Link href="/about" className="text-blue-600 hover:underline">
            la pàgina Sobre
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
