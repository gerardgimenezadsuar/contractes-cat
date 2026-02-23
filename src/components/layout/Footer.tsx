import Link from "next/link";
import { SITE_NAME, GITHUB_URL, SOCRATA_DATASET_URL, CREATOR_NAME, CREATOR_URL } from "@/config/constants";

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">{SITE_NAME}</h3>
            <p className="text-sm text-gray-600">
              Anàlisi independent de la contractació pública a Catalunya.
              Aquesta no és una web oficial del govern.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Navegació</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <Link href="/empreses" prefetch className="text-gray-600 hover:text-gray-900">
                  Empreses
                </Link>
              </li>
              <li>
                <Link href="/persones" prefetch className="text-gray-600 hover:text-gray-900">
                  Persones
                </Link>
              </li>
              <li>
                <Link href="/contractes" prefetch className="text-gray-600 hover:text-gray-900">
                  Contractes
                </Link>
              </li>
              <li>
                <Link href="/organismes" prefetch className="text-gray-600 hover:text-gray-900">
                  Organismes
                </Link>
              </li>
              <li>
                <Link href="/analisi" prefetch className="text-gray-600 hover:text-gray-900">
                  Anàlisi
                </Link>
              </li>
              <li>
                <Link href="/about" prefetch className="text-gray-600 hover:text-gray-900">
                  Sobre el projecte
                </Link>
              </li>
              <li>
                <Link href="/legal" prefetch className="text-gray-600 hover:text-gray-900">
                  Avís legal i privacitat
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Dades i codi</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={SOCRATA_DATASET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Font de dades (Transparència CAT)
                </a>
                <p className="text-xs text-gray-400 mt-0.5">Plataforma de Serveis de Contractació Pública</p>
              </li>
              <li>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
                  </svg>
                  Codi obert a GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-200 mt-8 pt-4 text-center text-xs text-gray-500 space-y-1">
          <p>
            Creat i publicat com a codi obert per{" "}
            <a
              href={CREATOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gray-700 hover:text-gray-900 underline"
            >
              {CREATOR_NAME}
            </a>
            , empresa d&apos;enginyeria d&apos;IA a Barcelona, Catalunya.
          </p>
          <p className="text-gray-400">
            Dades actualitzades periòdicament des de la Plataforma de Transparència · No és un web oficial del govern de Catalunya
          </p>
        </div>
      </div>
    </footer>
  );
}
