// Sync job for the contractes.cat search index.
//
// Each invocation performs ONE step of a sync run (one Socrata page or the
// finalize step) and returns, so it stays well inside the Edge Function
// limits (150 s wall clock, 2 s CPU on the free plan). pg_cron calls it every
// two minutes; a full refresh therefore takes roughly 30-60 minutes and runs
// at most once per SYNC_MIN_INTERVAL_HOURS. State lives in search_sync_runs.
//
// Stages: companies -> companies_cy -> organs -> organs_cy -> finalize -> done
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SOCRATA_BASE_URL = "https://analisi.transparenciacatalunya.cat/resource/ybgg-dgi6.json";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SOCRATA_APP_TOKEN = Deno.env.get("SOCRATA_APP_TOKEN") ?? "";
const PAGE_SIZE = 10000;
const SYNC_MIN_INTERVAL_HOURS = 20;
const MAX_CONSECUTIVE_ERRORS = 8;

// Same row filters as src/lib/api.ts (fetchCompanies / fetchOrgans).
const COMPANY_WHERE =
  "import_adjudicacio_amb_iva not like '%||%' AND import_adjudicacio_amb_iva IS NOT NULL AND denominacio_adjudicatari IS NOT NULL AND identificacio_adjudicatari IS NOT NULL";
const ORGAN_WHERE =
  "import_adjudicacio_amb_iva not like '%||%' AND import_adjudicacio_amb_iva IS NOT NULL AND nom_organ IS NOT NULL";

type Stage = "companies" | "companies_cy" | "organs" | "organs_cy" | "finalize" | "done";

interface SyncRun {
  id: number;
  status: string;
  stage: Stage;
  page: number;
  consecutive_errors: number;
  started_at: string;
  finished_at: string | null;
  stats: Record<string, unknown>;
}

const restHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function rest<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { ...restHeaders };
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`PostgREST ${res.status} on ${path}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** Calls an RPC with the Socrata JSON array spliced in as raw text (no re-serialising of megabytes). */
async function rpcWithRows(fn: string, runId: number, rowsJson: string): Promise<{ input: number; written: number }> {
  return rest<{ input: number; written: number }>(`rpc/${fn}`, {
    method: "POST",
    body: `{"p_run_id":${runId},"p_rows":${rowsJson}}`,
  });
}

async function fetchSocrataPage(params: Record<string, string>): Promise<string> {
  const url = new URL(SOCRATA_BASE_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const headers: Record<string, string> = {};
  if (SOCRATA_APP_TOKEN) headers["X-App-Token"] = SOCRATA_APP_TOKEN;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(110_000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Socrata ${res.status}: ${text.slice(0, 300)}`);
  if (!text.startsWith("[")) throw new Error(`Socrata returned non-array body: ${text.slice(0, 100)}`);
  return text;
}

function currentYear(): number {
  return new Date().getFullYear();
}

function pageQuery(stage: Stage, page: number): Record<string, string> {
  const offset = String(page * PAGE_SIZE);
  const limit = String(PAGE_SIZE);
  const year = currentYear();
  switch (stage) {
    case "companies":
      return {
        $select:
          "identificacio_adjudicatari, denominacio_adjudicatari, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
        $where: COMPANY_WHERE,
        $group: "identificacio_adjudicatari, denominacio_adjudicatari",
        $order: "identificacio_adjudicatari, denominacio_adjudicatari",
        $limit: limit,
        $offset: offset,
      };
    case "companies_cy":
      return {
        $select:
          "identificacio_adjudicatari, denominacio_adjudicatari, sum(import_adjudicacio_amb_iva::number) as total_current_year",
        $where: `${COMPANY_WHERE} AND data_adjudicacio_contracte IS NOT NULL AND date_extract_y(data_adjudicacio_contracte)=${year}`,
        $group: "identificacio_adjudicatari, denominacio_adjudicatari",
        $order: "identificacio_adjudicatari, denominacio_adjudicatari",
        $limit: limit,
        $offset: offset,
      };
    case "organs":
      return {
        $select: "nom_organ, sum(import_adjudicacio_amb_iva::number) as total, count(*) as num_contracts",
        $where: ORGAN_WHERE,
        $group: "nom_organ",
        $order: "nom_organ",
        $limit: limit,
        $offset: offset,
      };
    case "organs_cy":
      return {
        $select: "nom_organ, sum(import_adjudicacio_amb_iva::number) as total_current_year",
        $where: `${ORGAN_WHERE} AND data_adjudicacio_contracte IS NOT NULL AND date_extract_y(data_adjudicacio_contracte)=${year}`,
        $group: "nom_organ",
        $order: "nom_organ",
        $limit: limit,
        $offset: offset,
      };
    default:
      throw new Error(`No page query for stage ${stage}`);
  }
}

const INGEST_FN: Record<string, string> = {
  companies: "ingest_company_groups",
  companies_cy: "ingest_company_current_year",
  organs: "ingest_organ_groups",
  organs_cy: "ingest_organ_current_year",
};

const NEXT_STAGE: Record<string, Stage> = {
  companies: "companies_cy",
  companies_cy: "organs",
  organs: "organs_cy",
  organs_cy: "finalize",
};

async function loadRuns(): Promise<{ running: SyncRun | null; lastCompleted: SyncRun | null }> {
  const running = await rest<SyncRun[]>(
    "search_sync_runs?status=eq.running&order=id.desc&limit=1"
  );
  const completed = await rest<SyncRun[]>(
    "search_sync_runs?status=eq.completed&order=id.desc&limit=1"
  );
  return { running: running[0] ?? null, lastCompleted: completed[0] ?? null };
}

async function updateRun(id: number, patch: Record<string, unknown>): Promise<void> {
  await rest(`search_sync_runs?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    prefer: "return=minimal",
  });
}

async function createRun(): Promise<SyncRun> {
  const rows = await rest<SyncRun[]>("search_sync_runs", {
    method: "POST",
    body: JSON.stringify({ status: "running", stage: "companies", page: 0 }),
    prefer: "return=representation",
  });
  return rows[0];
}

async function step(run: SyncRun): Promise<Record<string, unknown>> {
  if (run.stage === "finalize") {
    const stats = await rest<Record<string, unknown>>("rpc/finalize_search_sync", {
      method: "POST",
      body: JSON.stringify({ p_run_id: run.id }),
    });
    return { run: run.id, stage: "finalize", done: true, stats };
  }

  const rowsJson = await fetchSocrataPage(pageQuery(run.stage, run.page));
  const result = await rpcWithRows(INGEST_FN[run.stage], run.id, rowsJson);
  const pageFull = result.input >= PAGE_SIZE;
  const statKey = `${run.stage}_rows`;
  const stats = {
    ...run.stats,
    [statKey]: Number(run.stats[statKey] ?? 0) + result.input,
  };
  const nextStage: Stage = pageFull ? run.stage : NEXT_STAGE[run.stage];
  await updateRun(run.id, {
    stage: nextStage,
    page: pageFull ? run.page + 1 : 0,
    consecutive_errors: 0,
    stats,
    error: null,
  });
  return { run: run.id, stage: run.stage, page: run.page, rows: result.input, next: nextStage };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }
  const expectedToken = await rest<string>("rpc/search_sync_token", { method: "POST", body: "{}" });
  if (!expectedToken || req.headers.get("x-sync-token") !== expectedToken) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { force?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const { running, lastCompleted } = await loadRuns();
  let run = running;
  if (!run) {
    const hoursSinceLast = lastCompleted?.finished_at
      ? (Date.now() - new Date(lastCompleted.finished_at).getTime()) / 3_600_000
      : Infinity;
    if (!body.force && hoursSinceLast < SYNC_MIN_INTERVAL_HOURS) {
      return Response.json({ idle: true, lastCompleted: lastCompleted?.finished_at, hoursSinceLast });
    }
    run = await createRun();
  }

  try {
    const result = await step(run);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errors = run.consecutive_errors + 1;
    await updateRun(run.id, {
      consecutive_errors: errors,
      error: message,
      ...(errors >= MAX_CONSECUTIVE_ERRORS ? { status: "failed", finished_at: new Date().toISOString() } : {}),
    });
    console.error(`sync step failed (run ${run.id}, stage ${run.stage}, page ${run.page}):`, message);
    return Response.json({ run: run.id, stage: run.stage, page: run.page, error: message, consecutive_errors: errors }, { status: 500 });
  }
});
