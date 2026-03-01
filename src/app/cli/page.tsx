import type { Metadata } from "next";
import { SITE_NAME } from "@/config/constants";

export const metadata: Metadata = {
  title: "CLI oficial",
  description:
    "Instal·lació i ús de la CLI de contractes.cat per consultar contractació pública de Catalunya.",
};

export default function CliPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-3">
        CLI de {SITE_NAME}
      </h1>
      <p className="text-gray-700 mb-6">
        Interfície de línia d&apos;ordres per consultar dades públiques de contractació.
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Instal·lació</h2>
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm">
          <code>npm install -g @gerardgimenezadsuar/contractes-cli</code>
        </pre>
        <p className="text-gray-600 mt-3">
          També es pot executar sense instal·lar:
        </p>
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm mt-2">
          <code>npx @gerardgimenezadsuar/contractes-cli help</code>
        </pre>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Comandes principals</h2>
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm">
          <code>{`contractes search-contracts --search "neteja" --year 2025
contractes search-companies --search "ferrovial"
contractes search-organs --search "ajuntament" --limit 25
contractes organ-top-companies --organ "Ajuntament de Barcelona" --limit 10
contractes person-contracts --name "Nom Cognom"
contractes attribution`}</code>
        </pre>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Configuració</h2>
        <p className="text-gray-700 mb-3">
          Per apuntar a una altra instància API:
        </p>
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm">
          <code>CONTRACTES_API_BASE=http://localhost:3000 contractes search-contracts --search salut</code>
        </pre>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-3">Atribució de dades</h2>
        <p className="text-gray-700">
          Font original: Departament d&apos;Economia i Hisenda (dataset `ybgg-dgi6`)
          a Transparència Catalunya. Consulta llicències i condicions d&apos;ús a:
          {" "}
          <a
            href="https://administraciodigital.gencat.cat/ca/dades/dades-obertes/informacio-practica/llicencies/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            administraciodigital.gencat.cat
          </a>
          .
        </p>
      </section>
    </div>
  );
}
