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
            <ul className="space-y-1 text-sm">
              <li>
                <a
                  href={SOCRATA_DATASET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Font de dades (Transparència)
                </a>
              </li>
              <li>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-900"
                >
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
        </div>
      </div>
    </footer>
  );
}
