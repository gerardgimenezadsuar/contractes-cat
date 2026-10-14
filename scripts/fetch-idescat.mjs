#!/usr/bin/env node
/**
 * Rebuilds src/data/municipis.json from Idescat's "El municipi en xifres" API.
 *
 *   node scripts/fetch-idescat.mjs
 *
 * One request lists every municipality (947) and one request per municipality
 * returns the handful of indicators the site shows. Run it once a year, after
 * Idescat publishes the new population census (usually February); the file is
 * committed so the app never calls Idescat at runtime.
 *
 * Reuse of Idescat data requires attribution ("Font: Idescat"), which the
 * pages carry. See https://www.idescat.cat/dev/api/ for the terms of use.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = "https://api.idescat.cat/emex/v1";
// Field ids of the indicators we keep (see INDICATORS in src/lib/idescat.ts).
const FIELDS = ["f171", "f262", "f3", "f7", "f385", "f242"];
const CONCURRENCY = 6;
const OUT = path.resolve(process.cwd(), "src/data/municipis.json");

async function getJson(url, attempt = 1) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    if (attempt < 4 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return getJson(url, attempt + 1);
    }
    throw new Error(`${res.status} ${url}`);
  }
  return res.json();
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function readField(out, field, tableYear) {
  if (!field?.id) return;
  // "v" holds municipality, comarca and Catalonia values separated by commas;
  // "_" marks a value Idescat does not publish for that territory.
  const [first] = String(field.v ?? "").split(",");
  const value = first === "_" || first === "" ? null : Number(first);
  out[field.id] = {
    value: Number.isFinite(value) ? value : null,
    year: String(field.r ?? tableYear ?? "").replace(/\s*\(p\)$/, "") || null,
  };
}

/**
 * Flattens an emex "dades" payload into { fieldId: { value, year } }. With the
 * `i=` parameter the fields come flat under fitxes.indicadors.i; without it
 * they sit in the full fitxes.gg.g[].tt.t[].ff.f[] tree.
 */
export function parseEmex(payload) {
  const out = {};
  for (const field of asArray(payload?.fitxes?.indicadors?.i)) readField(out, field);
  for (const group of asArray(payload?.fitxes?.gg?.g)) {
    for (const table of asArray(group?.tt?.t)) {
      for (const field of asArray(table?.ff?.f)) readField(out, field, table?.r);
    }
  }
  return out;
}

export function toRecord(node, fields) {
  const pick = (id) => fields[id]?.value ?? null;
  return {
    id: node.id,
    ine: node.id.slice(0, 5),
    name: node.content,
    comarca: node.comarca,
    population: pick("f171"),
    populationYear: fields.f171?.year || null,
    density: pick("f262"),
    pibPerCapita: pick("f3"),
    pibYear: fields.f3?.year || null,
    rfdbPerCapita: pick("f7"),
    rfdbYear: fields.f7?.year || null,
    ist: pick("f385"),
    istYear: fields.f385?.year || null,
    atur: pick("f242"),
    aturYear: fields.f242?.year || null,
  };
}

async function main() {
  const nodes = await getJson(`${BASE}/nodes.json?lang=ca`);
  const municipalities = [];
  for (const comarca of asArray(nodes?.fitxes?.v?.v)) {
    for (const mun of asArray(comarca?.v)) {
      if (mun?.scheme === "mun") municipalities.push({ ...mun, comarca: comarca.content });
    }
  }
  console.log(`${municipalities.length} municipis`);

  const records = [];
  let next = 0;
  async function worker() {
    while (next < municipalities.length) {
      const node = municipalities[next++];
      const url = `${BASE}/dades.json?id=${node.id}&i=${FIELDS.join(",")}&lang=ca`;
      const fields = parseEmex(await getJson(url));
      records.push(toRecord(node, fields));
      if (records.length % 100 === 0) console.log(`${records.length} fets`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  records.sort((a, b) => a.ine.localeCompare(b.ine));

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify({ source: "Idescat, El municipi en xifres", fetchedAt: new Date().toISOString().slice(0, 10), municipalities: records }, null, 1) + "\n"
  );
  console.log(`escrit ${OUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
