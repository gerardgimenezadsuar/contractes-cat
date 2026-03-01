#!/usr/bin/env node

const BASE_URL = process.env.CONTRACTES_API_BASE || "https://www.contractes.cat";
const VERSION = "0.1.0";

const SOURCE_ATTRIBUTION = {
  dataset_id: "ybgg-dgi6",
  dataset_name:
    "Contractacio publica a Catalunya: publicacions a la Plataforma de serveis de contractacio publica",
  publisher: "Departament d'Economia i Hisenda",
  source_url:
    "https://analisi.transparenciacatalunya.cat/Sector-P-blic/Contractaci-del-sector-p-blic-de-la-Generalitat-d/ybgg-dgi6",
  license: "See terms of use / Open data license",
  license_url:
    "https://administraciodigital.gencat.cat/ca/dades/dades-obertes/informacio-practica/llicencies/"
};

const HELP = `contractes ${VERSION}

CLI for contractes.cat public contract data.

Usage:
  contractes <command> [options]

Commands:
  search-contracts       Search contracts
  search-companies       Search awardee companies
  search-organs          Search contracting organs
  organ-top-companies    Top companies for one organ
  person-contracts       Contracts linked to a person
  attribution            Print source attribution metadata
  help                   Show help
  version                Show version

Global options:
  --base-url <url>       API base URL (default: ${BASE_URL})
  --raw                  Print raw response (no pretty formatting)

Examples:
  contractes search-contracts --search "neteja" --year 2025 --page 1
  contractes search-contracts --nif B12345678 --sort amount-desc
  contractes search-companies --search "ferrovial" --page 1
  contractes search-organs --search "ajuntament" --limit 25
  contractes organ-top-companies --organ "Ajuntament de Barcelona" --limit 10
  contractes person-contracts --name "Nom Cognom" --date-from 2024-01-01 --date-to 2025-12-31
`;

function parseArgs(argv) {
  const out = { _: [], flags: {} };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;

    if (!token.startsWith("--")) {
      out._.push(token);
      continue;
    }

    const eqIndex = token.indexOf("=");
    if (eqIndex > -1) {
      const key = token.slice(2, eqIndex);
      const value = token.slice(eqIndex + 1);
      out.flags[key] = value;
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out.flags[key] = next;
      i += 1;
    } else {
      out.flags[key] = true;
    }
  }

  return out;
}

function readBaseUrl(flags) {
  return (typeof flags["base-url"] === "string" && flags["base-url"]) || BASE_URL;
}

function readRawMode(flags) {
  return flags.raw === true;
}

function pickFlags(flags, map) {
  const params = new URLSearchParams();
  for (const [flagName, queryName] of map) {
    const value = flags[flagName];
    if (typeof value === "string" && value.trim()) {
      params.set(queryName, value.trim());
    }
  }
  return params;
}

function printJson(data) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function exitWithError(message, details) {
  process.stderr.write(`Error: ${message}\n`);
  if (details) {
    process.stderr.write(`${details}\n`);
  }
  process.exit(1);
}

async function requestJson(url, raw) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    const text = await response.text();
    exitWithError(`Request failed (${response.status})`, text);
  }

  const data = await response.json();
  if (raw) {
    process.stdout.write(`${JSON.stringify(data)}\n`);
    return;
  }
  printJson(data);
}

async function run() {
  const parsed = parseArgs(process.argv.slice(2));
  const command = parsed._[0];
  const flags = parsed.flags;
  const baseUrl = readBaseUrl(flags).replace(/\/+$/, "");
  const raw = readRawMode(flags);

  if (!command || command === "help" || flags.help === true) {
    process.stdout.write(HELP);
    return;
  }

  if (command === "version") {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  if (command === "attribution") {
    printJson(SOURCE_ATTRIBUTION);
    return;
  }

  if (command === "search-contracts") {
    const params = pickFlags(flags, [
      ["search", "search"],
      ["year", "year"],
      ["tipus-contracte", "tipus_contracte"],
      ["procediment", "procediment"],
      ["amount-min", "amountMin"],
      ["amount-max", "amountMax"],
      ["nom-organ", "nom_organ"],
      ["nif", "nif"],
      ["awardee-name", "awardee_name"],
      ["sort", "sort"],
      ["page", "page"]
    ]);
    await requestJson(`${baseUrl}/api/contractes?${params.toString()}`, raw);
    return;
  }

  if (command === "search-companies") {
    const params = pickFlags(flags, [
      ["search", "search"],
      ["cpv", "cpv"],
      ["page", "page"],
      ["include-total", "includeTotal"]
    ]);
    await requestJson(`${baseUrl}/api/empreses?${params.toString()}`, raw);
    return;
  }

  if (command === "search-organs") {
    const params = pickFlags(flags, [
      ["search", "search"],
      ["page", "page"],
      ["limit", "limit"],
      ["include-total", "includeTotal"],
      ["include-current-year", "includeCurrentYear"]
    ]);
    await requestJson(`${baseUrl}/api/organismes?${params.toString()}`, raw);
    return;
  }

  if (command === "organ-top-companies") {
    const params = pickFlags(flags, [
      ["organ", "organ"],
      ["limit", "limit"]
    ]);
    if (!params.get("organ")) {
      exitWithError("Missing --organ for organ-top-companies");
    }
    await requestJson(`${baseUrl}/api/organismes/top-empreses?${params.toString()}`, raw);
    return;
  }

  if (command === "person-contracts") {
    const name = flags.name;
    if (typeof name !== "string" || !name.trim()) {
      exitWithError("Missing --name for person-contracts");
    }
    const encodedName = encodeURIComponent(name.trim());
    const params = pickFlags(flags, [
      ["sort", "sort"],
      ["page", "page"],
      ["nom-organ", "nom_organ"],
      ["date-from", "date_from"],
      ["date-to", "date_to"],
      ["nif-windows", "nif_windows"],
      ["nifs", "nifs"]
    ]);
    await requestJson(
      `${baseUrl}/api/persones/${encodedName}/contractes?${params.toString()}`,
      raw
    );
    return;
  }

  exitWithError(
    `Unknown command: ${command}`,
    "Run `contractes help` to list available commands."
  );
}

run().catch((error) => {
  exitWithError("Unhandled error", error instanceof Error ? error.stack : String(error));
});
