// Minimal Socrata (SODA) stand-in for local smoke tests and CI.
//
// It does not understand SoQL. It inspects `$select`, `$group`, `$where`,
// `$limit` and `$offset` just enough to answer with rows of the right shape:
// aggregate queries get synthetic aggregate rows, everything else gets rows
// from a deterministic contract fixture. Start with:
//   node tests/mock-socrata/server.mjs [port]
// and point the app at it with SOCRATA_ORIGIN_OVERRIDE=http://127.0.0.1:<port>.

import { createServer } from "node:http";

const PORT = Number(process.argv[2] || process.env.MOCK_SOCRATA_PORT || 4545);

const ORGANS = [
  "Ajuntament de Barcelona",
  "Ajuntament de Girona",
  "Ajuntament de Vic",
  "Departament de Salut",
  "Departament d'Educació",
  "Consorci Sanitari de Terrassa",
  "Diputació de Lleida",
  "Institut Català de la Salut",
  "Ajuntament de Tarragona",
  "Agència Catalana de l'Aigua",
];
const COMPANIES = [
  ["A08000001", "EMPRESA MOCK U SL"],
  ["B08000002", "CONSTRUCCIONS DEMO SA"],
  ["A08000003", "SERVEIS NETEJA PROVA SL"],
  ["B08000004", "TECNOLOGIA FICTICIA SLU"],
  ["A08000005", "OBRES I CAMINS EXEMPLE SA"],
  ["B08000006", "CONSULTORIA MOSTRA SL"],
  ["A08000007", "SUBMINISTRAMENTS ASSAIG SA"],
  ["B08000008", "ENERGIA PILOT SL"],
  ["A08000009", "MANTENIMENT TIPUS SLU"],
  ["B08000010", "TRANSPORTS PATRÓ SA"],
];
const PROCEDURES = ["Contracte menor", "Obert", "Obert simplificat", "Negociat sense publicitat", "Restringit"];
const TYPES = ["Serveis", "Subministraments", "Obres", "Concessió de serveis"];
const CPVS = ["45000000-7", "72000000-5", "90000000-7", "33000000-0", "79000000-4", "60000000-8", "50000000-5", "71000000-8", "85000000-9", "30000000-9"];

function pad(n, width) {
  return String(n).padStart(width, "0");
}

function contractFixture(i) {
  const [nif, name] = COMPANIES[i % COMPANIES.length];
  const year = 2025 - (i % 6);
  const month = 1 + (i % 12);
  const day = 1 + (i % 27);
  const date = `${year}-${pad(month, 2)}-${pad(day, 2)}T00:00:00.000`;
  const isUte = i % 9 === 4;
  const amount = 1000 + ((i * 7919) % 300000);
  return {
    codi_expedient: `EXP-${year}-${pad(i, 4)}`,
    denominacio: `Contracte de mostra número ${i} per a serveis de manteniment i suport`,
    objecte_contracte: `Objecte del contracte ${i}`,
    tipus_contracte: TYPES[i % TYPES.length],
    procediment: PROCEDURES[i % PROCEDURES.length],
    fase_publicacio: "Adjudicació",
    nom_organ: ORGANS[i % ORGANS.length],
    nom_departament_ens: ORGANS[i % ORGANS.length],
    nom_ambit: "Administració local",
    identificacio_adjudicatari: isUte ? `${nif}||${COMPANIES[(i + 1) % COMPANIES.length][0]}` : nif,
    denominacio_adjudicatari: isUte ? `${name}||${COMPANIES[(i + 1) % COMPANIES.length][1]}` : name,
    import_adjudicacio_sense: String(amount),
    import_adjudicacio_amb_iva: String(Math.round(amount * 1.21)),
    data_adjudicacio_contracte: date,
    data_formalitzacio_contracte: date,
    data_publicacio_anunci: date,
    ofertes_rebudes: 1 + (i % 5),
    codi_cpv: CPVS[i % CPVS.length],
    lloc_execucio: "Barcelona",
    durada_contracte: "12 mesos",
    numero_lot: "",
    descripcio_lot: "",
    pressupost_licitacio_sense: amount * 1.1,
    pressupost_licitacio_amb: amount * 1.1 * 1.21,
    valor_estimat_contracte: amount * 1.2,
    resultat: "Adjudicat",
    enllac_publicacio: { url: `https://contractaciopublica.example/exp/${i}` },
    es_agregada: "No",
  };
}

const CONTRACTS = Array.from({ length: 240 }, (_, i) => contractFixture(i));

function splitTopLevel(expr) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of expr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function outputColumns(select) {
  return splitTopLevel(select).map((part) => {
    const alias = part.match(/\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/i);
    if (alias) return alias[1];
    return part.trim();
  });
}

function extractEquality(where, field) {
  if (!where) return null;
  const re = new RegExp(`${field}\\)?\\s*=\\s*(?:upper\\()?'((?:[^']|'')*)'`, "i");
  const m = where.match(re);
  return m ? m[1].replace(/''/g, "'") : null;
}

function valueFor(column, i, where) {
  const c = column.toLowerCase();
  if (c === "year") return String(2015 + i);
  if (c === "bucket") return String(i * 500);
  if (c.includes("date")) return `2025-0${1 + (i % 9)}-15T00:00:00.000`;
  if (c === "identificacio_adjudicatari") {
    return extractEquality(where, "identificacio_adjudicatari") || COMPANIES[i % COMPANIES.length][0];
  }
  if (c === "denominacio_adjudicatari") {
    return extractEquality(where, "denominacio_adjudicatari") || COMPANIES[i % COMPANIES.length][1];
  }
  if (c === "nom_organ") return extractEquality(where, "nom_organ") || ORGANS[i % ORGANS.length];
  if (c === "procediment") return PROCEDURES[i % PROCEDURES.length];
  if (c === "tipus_contracte") return TYPES[i % TYPES.length];
  if (c === "codi_cpv") return CPVS[i % CPVS.length];
  if (c.includes("amount") || c === "total_current_year") return String(5_000_000 - i * 350_000 + 0.5);
  if (c.includes("contracts") || c === "total" || c === "n" || c.includes("count") || c.includes("unique")) {
    return String(Math.max(1, 12_000 - i * 900));
  }
  // Electes dataset
  if (c === "codi_ens") return "0801930008";
  if (c === "nom_complert") return "Ajuntament de Barcelona";
  if (c === "carrec") return i === 0 ? "Alcalde/essa" : "Regidor/a";
  if (c === "nom_regidor") return `PERSONA MOCK ${i}`;
  if (c === "data_nomenament") return "2023-06-17T00:00:00.000";
  if (c === "partit") return "Partit de Mostra";
  return `mock_${c}_${i}`;
}

function isAggregate(select) {
  return /\b(count|sum|avg|max|min|signed_magnitude_linear)\s*\(/i.test(select);
}

function answer(query) {
  const select = query.get("$select");
  const group = query.get("$group");
  const where = query.get("$where") || "";
  const limit = Math.min(Number(query.get("$limit") || 1000), 1000);
  const offset = Number(query.get("$offset") || 0);

  if (!select || (!group && !isAggregate(select))) {
    // Row query: contracts (or electes rows when asked for electes columns)
    const cols = select ? outputColumns(select) : null;
    if (cols && cols.some((c) => ["codi_ens", "nom_regidor", "nom_complert"].includes(c))) {
      return Array.from({ length: Math.min(limit, 6) }, (_, i) =>
        Object.fromEntries(cols.map((c) => [c, valueFor(c, i, where)]))
      );
    }
    let rows = CONTRACTS;
    const nif = extractEquality(where, "identificacio_adjudicatari");
    if (nif) rows = rows.filter((r) => r.identificacio_adjudicatari.includes(nif));
    const organ = extractEquality(where, "nom_organ");
    if (organ) rows = rows.filter((r) => r.nom_organ.toUpperCase() === organ.toUpperCase());
    const organLike = where.match(/nom_organ\)\s*like\s*upper\('%((?:[^']|'')*)%'\)/i);
    if (organLike) {
      const needle = organLike[1].replace(/''/g, "'").toUpperCase();
      rows = rows.filter((r) => r.nom_organ.toUpperCase().includes(needle));
    }
    const page = rows.slice(offset, offset + limit);
    if (!cols) return page;
    return page.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? valueFor(c, 0, where)])));
  }

  const cols = outputColumns(select);
  const rowCount = group ? Math.min(limit, 10) : 1;
  return Array.from({ length: rowCount }, (_, i) =>
    Object.fromEntries(cols.map((c) => [c, valueFor(c, i + offset, where)]))
  );
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  if (process.env.MOCK_SOCRATA_LOG) {
    console.log(`[mock] ${url.searchParams.get("$where") || "(no where)"}`);
  }
  let body;
  try {
    body = JSON.stringify(answer(url.searchParams));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(error) }));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock socrata listening on http://127.0.0.1:${PORT}`);
});
