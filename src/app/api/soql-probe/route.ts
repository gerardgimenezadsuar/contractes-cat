// TEMPORARY probe route — not for merge.
import { NextResponse } from "next/server";
import { SOCRATA_BASE_URL, CLEAN_AMOUNT_FILTER } from "@/config/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BASE = `${CLEAN_AMOUNT_FILTER} AND import_adjudicacio_amb_iva IS NOT NULL AND denominacio_adjudicatari IS NOT NULL AND identificacio_adjudicatari IS NOT NULL`;
const MASKED = `${BASE} AND upper(identificacio_adjudicatari) like '%**%'`;

async function run(label: string, params: Record<string, string>) {
  const url = new URL(SOCRATA_BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    let rows: number | null = null;
    try { const j = JSON.parse(text); rows = Array.isArray(j) ? j.length : null; } catch {}
    return { label, status: res.status, ms: Date.now() - t0, bytes: text.length, rows, head: text.slice(0, 400) };
  } catch (e) {
    return { label, ms: Date.now() - t0, error: String(e) };
  }
}

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("t") !== "p7q2x9") return new NextResponse("no", { status: 404 });
  const results = await Promise.all([
    run("A distinct concat", { $select: "count(distinct identificacio_adjudicatari || '|' || denominacio_adjudicatari) as total", $where: MASKED }),
    run("B pipe query", { $query: `SELECT identificacio_adjudicatari, denominacio_adjudicatari WHERE ${MASKED} GROUP BY identificacio_adjudicatari, denominacio_adjudicatari |> SELECT count(*) as total` }),
    run("C distinct name only", { $select: "count(distinct denominacio_adjudicatari) as total", $where: MASKED }),
    run("D nonmasked distinct id", { $select: "count(distinct identificacio_adjudicatari) as total", $where: `${BASE} AND upper(identificacio_adjudicatari) not like '%**%'` }),
    run("E baseline enumeration p1", { $select: "identificacio_adjudicatari, denominacio_adjudicatari", $where: MASKED, $group: "identificacio_adjudicatari, denominacio_adjudicatari", $limit: "50000", $offset: "0" }),
    run("F baseline enumeration p2", { $select: "identificacio_adjudicatari, denominacio_adjudicatari", $where: MASKED, $group: "identificacio_adjudicatari, denominacio_adjudicatari", $limit: "50000", $offset: "50000" }),
    run("G total rows", { $select: "count(*) as total" }),
  ]);
  return NextResponse.json(results.map((r) => ("head" in r && r.bytes! > 400 ? { ...r, head: r.head!.slice(0, 120) } : r)));
}
