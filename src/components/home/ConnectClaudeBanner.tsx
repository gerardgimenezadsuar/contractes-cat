import Link from "next/link";
import { CLAUDE_CONNECTOR_URL } from "@/config/constants";
import ClaudeMark from "@/components/brand/ClaudeMark";
import TrackedLinks from "@/components/entity/TrackedLinks";

/** Home promo for the Claude connector (one-click install via the Claude directory). */
export default function ConnectClaudeBanner() {
  return (
    <TrackedLinks
      as="section"
      from="home/claude-banner"
      className="mx-auto max-w-7xl px-4 pt-6"
    >
      <div className="flex flex-col gap-4 rounded-xl border border-accent/30 bg-accent-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white">
            <ClaudeMark className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-gray-900">
              Connecta Claude a contractes.cat
            </p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              Pregunta en llenguatge natural quins contractes ha guanyat una
              empresa i qui la controla. Gratuït, només de lectura i sense
              registre.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <a
            href={CLAUDE_CONNECTOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800"
          >
            <ClaudeMark className="h-4 w-4" />
            Afegeix-lo a Claude
          </a>
          <Link
            href="/assistents"
            className="text-sm font-medium text-accent hover:underline"
          >
            Altres assistents &rarr;
          </Link>
        </div>
      </div>
    </TrackedLinks>
  );
}
