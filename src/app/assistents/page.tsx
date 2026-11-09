import type { Metadata } from "next";
import Link from "next/link";
import ClaudeMark from "@/components/brand/ClaudeMark";
import PageHeader from "@/components/layout/PageHeader";
import CopyButton from "@/components/ui/CopyButton";
import { CLAUDE_CONNECTOR_URL, SITE_URL } from "@/config/constants";

const MCP_URL = `${SITE_URL}/api/mcp`;
const CLAUDE_CODE_CMD = `claude mcp add --transport http contractes ${MCP_URL}`;
const CODEX_CMD = `codex mcp add contractes --url ${MCP_URL}`;
const GENERIC_CONFIG = JSON.stringify({ mcpServers: { contractes: { url: MCP_URL } } }, null, 2);
const CURSOR_INSTALL = `cursor://anysphere.cursor-deeplink/mcp/install?name=contractes&config=${encodeURIComponent(
  Buffer.from(JSON.stringify({ url: MCP_URL })).toString("base64")
)}`;
const VSCODE_INSTALL = `vscode:mcp/install?${encodeURIComponent(
  JSON.stringify({ name: "contractes", type: "http", url: MCP_URL })
)}`;

const EXAMPLES = [
  "Quins contractes públics han guanyat les empreses de Joan Laporta mentre les administrava?",
  "Qui són els propietaris i administradors de les empreses que més cobren de l'Ajuntament de Girona des de 2023?",
  "Quines empreses guanyen més contractes de neteja a Catalunya aquest any, i a quin grup pertanyen?",
];

export const metadata: Metadata = {
  title: "Connecta el teu assistent d'IA",
  description:
    "Pregunta a Claude, ChatGPT, Codex o Cursor pels contractes públics de Catalunya i qui controla les empreses que els guanyen. Servidor MCP gratuït i obert de contractes.cat.",
  alternates: { canonical: "/assistents" },
};

function CodeLine({ code, label }: { code: string; label: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-gray-900 p-3">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre text-sm text-gray-100">{code}</code>
      <CopyButton text={code} label={label} />
    </div>
  );
}

function Client({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-gray-200 py-6">
      <h2 className="mb-3 font-display text-xl font-semibold text-gray-900">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

export default function AssistantsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="Connecta el teu assistent d'IA" eyebrow="Claude · ChatGPT · Codex · Cursor" className="mb-6">
        <p>
          Fes preguntes en llenguatge natural sobre contractes públics a Catalunya i sobre qui controla les empreses que
          els guanyen. L&apos;assistent consulta les dades de contractes.cat i cita les pàgines d&apos;on surt cada xifra.
        </p>
      </PageHeader>

      <div className="mb-8 rounded-lg border border-accent/30 bg-accent-soft p-4">
        <p className="mb-2 text-sm font-medium text-gray-900">Adreça del servidor MCP (gratuït, sense registre)</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-white px-3 py-2 text-sm text-gray-900">
            {MCP_URL}
          </code>
          <CopyButton text={MCP_URL} label="mcp-url" />
        </div>
      </div>

      <section className="mb-2">
        <h2 className="mb-3 font-display text-xl font-semibold text-gray-900">Què pots preguntar</h2>
        <ul className="space-y-2 text-[15px] text-gray-700">
          {EXAMPLES.map((q) => (
            <li key={q} className="border-l-2 border-accent pl-3 italic">
              {q}
            </li>
          ))}
        </ul>
      </section>

      <Client title="Claude (web, escriptori i mòbil)">
        <a
          href={CLAUDE_CONNECTOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800"
        >
          <ClaudeMark className="h-4 w-4" />
          Afegeix contractes.cat a Claude
        </a>
        <p>
          Et porta al directori de connectors de Claude: prem <strong>Connecta</strong> i ja el tens a totes les teves
          converses (web, escriptori i mòbil). En una conversa nova, activa el connector i fes la pregunta.
        </p>
        <details className="text-sm text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-700">Instal·lació manual</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Obre <strong>Configuració → Connectors</strong> a claude.ai.
            </li>
            <li>
              Tria <strong>Afegeix un connector personalitzat</strong>, posa-hi el nom <em>contractes.cat</em> i
              l&apos;adreça del servidor de dalt.
            </li>
          </ol>
        </details>
      </Client>

      <Client title="ChatGPT">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            A <strong>Configuració → Aplicacions i connectors → Configuració avançada</strong>, activa el{" "}
            <strong>mode de desenvolupador</strong>.
          </li>
          <li>
            Crea un connector nou amb l&apos;adreça del servidor de dalt i sense autenticació.
          </li>
          <li>En una conversa, afegeix el connector des del menú «+» i fes la pregunta.</li>
        </ol>
        <p className="text-sm text-gray-500">
          Els connectors personalitzats depenen del teu pla de ChatGPT, i els noms dels menús poden canviar.
        </p>
      </Client>

      <Client title="Claude Code">
        <CodeLine code={CLAUDE_CODE_CMD} label="claude-code" />
      </Client>

      <Client title="Codex">
        <CodeLine code={CODEX_CMD} label="codex" />
      </Client>

      <Client title="Cursor i VS Code">
        <div className="flex flex-wrap gap-2">
          <a
            href={CURSOR_INSTALL}
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Instal·la a Cursor
          </a>
          <a
            href={VSCODE_INSTALL}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            Instal·la a VS Code
          </a>
        </div>
      </Client>

      <Client title="Altres clients MCP">
        <p>Qualsevol client compatible amb MCP per HTTP (Streamable HTTP) accepta aquesta configuració:</p>
        <CodeLine code={GENERIC_CONFIG} label="generic-config" />
      </Client>

      <Client title="Sense instal·lar res">
        <p>
          També pots demanar a qualsevol assistent amb cerca web que consulti contractes.cat, per exemple: «Busca a
          contractes.cat quins contractes han guanyat les empreses de…». Les instruccions per a agents són a{" "}
          <a href="/llms.txt" className="text-accent hover:underline">
            llms.txt
          </a>
          , i hi ha una{" "}
          <Link href="/cli" className="text-accent hover:underline">
            CLI i una API JSON
          </Link>{" "}
          per a desenvolupadors.
        </p>
      </Client>

      <section className="border-t border-gray-200 pt-6 text-sm text-gray-500">
        <p>
          Les dades són públiques i el servidor és només de lectura: no cal cap compte.
          contractes.cat és un projecte independent, no oficial; comprova les xifres importants a la pàgina enllaçada
          per l&apos;assistent.
        </p>
      </section>
    </div>
  );
}
