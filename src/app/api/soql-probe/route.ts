// TEMPORARY probe route — not for merge.
import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { SOCRATA_BASE_URL, CLEAN_AMOUNT_SENSE_FILTER } from "@/config/constants";
import { fetchThresholdDistribution } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const X = "import_adjudicacio_sense::number";
const MINOR = `procediment='Contracte menor' AND ${CLEAN_AMOUNT_SENSE_FILTER} AND import_adjudicacio_sense IS NOT NULL AND ${X} >= 500 AND ${X} < 15000`;

const REPL: [string, string][] = [
  [".", ""], [",", ""], ["-", ""], [" ", ""], ["/", ""], ["''", ""], ["’", ""], ["·", ""],
  ["À", "A"], ["Á", "A"], ["È", "E"], ["É", "E"], ["Í", "I"], ["Ï", "I"], ["Ò", "O"], ["Ó", "O"],
  ["Ú", "U"], ["Ü", "U"], ["Ç", "C"], ["Ñ", "N"],
];
function mine(field: string) {
  let e = `upper(${field})`;
  for (const c of [".", ",", "-", " ", "/", "''", "’", "·"]) e = `replace(${e},'${c}','')`;
  return `replace(replace(${e},'Ç','C'),'Ñ','N')`;
}
function norm(field: string) {
  let e = `upper(${field})`;
  for (const [a, b] of REPL) e = `replace(${e},'${a}','${b}')`;
  return e;
}

async function run(label: string, params: Record<string, string>) {
  const url = new URL(SOCRATA_BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    return { label, status: res.status, ms: Date.now() - t0, urlLen: url.toString().length, body: text.slice(0, 1500) };
  } catch (e) {
    return { label, ms: Date.now() - t0, error: String(e) };
  }
}

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("t") !== "k3m8w1") return new NextResponse("no", { status: 404 });
  const caseArgs: string[] = [];
  for (let s = 1000; s <= 14500; s += 500) caseArgs.push(`${X} < ${s}, ${s - 500}`);
  caseArgs.push(`true, 14500`);
  const y = "date_extract_y(data_adjudicacio_contracte)=2024";

  const t0 = Date.now();
  const baseline = await fetchThresholdDistribution().catch((e) => String(e));
  const baselineMs = Date.now() - t0;

  const F3 = ["denominacio", "denominacio_adjudicatari", "identificacio_adjudicatari"];
  const results = await Promise.all([
    run("MINE 3 fields no year", { $select: "count(*) as total", $where: F3.map((f) => `${mine(f)} like '%ENLL_M_N_TP_BL_C%'`).join(" OR ") }),
    run("MINE 2024 públic", { $select: "count(*) as total", $where: `${y} AND ${mine("denominacio")} like '%ENLL_M_N_TP_BL_C%'` }),
    run("MINE fira ocupacio 2026", { $select: "count(*) as total", $where: `date_extract_y(data_adjudicacio_contracte)=2026 AND ${mine("denominacio")} like '%F_R_D_L_C_P_C__%'` }),
    run("bucket case()", { $select: `case(${caseArgs.join(", ")}) as bucket, count(*) as total`, $where: MINOR, $group: "bucket", $order: "bucket", $limit: "100" }),
    run("bucket signed_magnitude_linear", { $select: `signed_magnitude_linear(${X}, 500) as b, count(*) as total`, $where: MINOR, $group: "b", $order: "b", $limit: "100" }),
    run("upper accents", { $select: "upper('éàçñïü l·l ’') as u", $limit: "1" }),
    run("search exact públic", { $select: "count(*) as total", $where: `${y} AND upper(denominacio) like upper('%enllumenat públic%')` }),
    run("search old-norm public", { $select: "count(*) as total", $where: `${y} AND upper(replace(replace(replace(replace(replace(denominacio,'.',''),',',''),'-',''),' ',''),'/','')) like '%ENLLUMENATPUBLIC%'` }),
    run("search new-norm public", { $select: "count(*) as total", $where: `${y} AND ${norm("denominacio")} like '%ENLLUMENATPUBLIC%'` }),
    run("search new-norm fira ocupacio 2026", { $select: "count(*) as total", $where: `date_extract_y(data_adjudicacio_contracte)=2026 AND ${norm("denominacio")} like '%FIRADELOCUPACIO%'` }),
    run("search new-norm 3 fields no year", { $select: "count(*) as total", $where: ["denominacio", "denominacio_adjudicatari", "identificacio_adjudicatari"].map((f) => `${norm(f)} like '%ENLLUMENATPUBLIC%'`).join(" OR ") }),
    run("search old-norm 3 fields no year", { $select: "count(*) as total", $where: ["denominacio", "denominacio_adjudicatari", "identificacio_adjudicatari"].map((f) => `upper(replace(replace(replace(replace(replace(${f},'.',''),',',''),'-',''),' ',''),'/','')) like '%ENLLUMENATPUBLIC%'`).join(" OR ") }),
    run("junk company ids", { $select: "identificacio_adjudicatari, count(*) as n", $where: "identificacio_adjudicatari IS NOT NULL AND length(identificacio_adjudicatari) < 5", $group: "identificacio_adjudicatari", $order: "n DESC", $limit: "40" }),
  ]);

  let turso: unknown = "no turso";
  const tu = process.env.TURSO_URL, tt = process.env.TURSO_TOKEN || process.env.TURSO_AUTH_TOKEN;
  if (tu && tt) {
    try {
      const c = createClient({ url: tu, authToken: tt });
      const q = async (sql: string) => (await c.execute(sql)).rows;
      turso = {
        total: await q("SELECT COUNT(*) n FROM person_summary"),
        boletin: await q("SELECT COUNT(*) n FROM person_summary WHERE person_name LIKE '%BOLET%N OFICIAL%' OR person_name LIKE '%REGISTRO MERCANTIL%'"),
        boletinSample: await q("SELECT person_name FROM person_summary WHERE person_name LIKE '%BOLET%N OFICIAL%' OR person_name LIKE '%REGISTRO MERCANTIL%' LIMIT 8"),
        legalEntity: await q("SELECT COUNT(*) n FROM person_summary WHERE person_name LIKE '% SL' OR person_name LIKE '% SA' OR person_name LIKE '% SLU' OR person_name LIKE '% SAU' OR person_name LIKE '% SLP' OR person_name LIKE '% SCCL'"),
        shortOrOdd: await q("SELECT person_name FROM person_summary WHERE length(person_name) < 6 OR person_name GLOB '*[0-9]*' LIMIT 15"),
        cols: await q("SELECT * FROM person_summary LIMIT 1"),
      };
    } catch (e) { turso = String(e); }
  }

  const envPresence = Object.fromEntries(
    Object.keys(process.env)
      .filter((k) => /SOCRATA|APP_TOKEN|TURSO/i.test(k))
      .map((k) => [k, Boolean(process.env[k])])
  );
  return NextResponse.json({ envPresence, baselineMs, baseline, results, turso });
}
