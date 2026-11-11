import Link from "next/link";
import { CHATGPT_PLUGIN_URL, CLAUDE_CONNECTOR_URL } from "@/config/constants";
import AssistantMarks from "@/components/brand/AssistantMarks";
import ChatGPTMark from "@/components/brand/ChatGPTMark";
import ClaudeMark from "@/components/brand/ClaudeMark";
import TrackedLinks from "@/components/entity/TrackedLinks";

const BUTTON =
  "inline-flex min-h-10 items-center gap-2 rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800";

/** Home promo for the official ChatGPT plugin and Claude connector (one-click install from each directory). */
export default function ConnectAssistantsBanner() {
  return (
    <TrackedLinks
      as="section"
      from="home/claude-banner"
      className="mx-auto max-w-7xl px-4 pt-6"
    >
      <div className="flex flex-col gap-4 rounded-xl border border-accent/30 bg-accent-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <AssistantMarks size="lg" />
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-gray-900">
              Connecta ChatGPT o Claude a contractes.cat
            </p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              Pregunta en llenguatge natural quins contractes ha guanyat una
              empresa i qui la controla. Gratuït, només de lectura i sense
              registre.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <a href={CHATGPT_PLUGIN_URL} target="_blank" rel="noopener noreferrer" className={BUTTON}>
            <ChatGPTMark className="h-4 w-4" />
            ChatGPT
          </a>
          <a href={CLAUDE_CONNECTOR_URL} target="_blank" rel="noopener noreferrer" className={BUTTON}>
            <ClaudeMark className="h-4 w-4" />
            Claude
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
