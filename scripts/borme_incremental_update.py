#!/usr/bin/env python3
"""
Incremental BORME updater: fetch new BORME Section A days and apply them
directly to the admin-history database (Turso in production, or a local
SQLite copy for testing), without a full rebuild/reimport.

How it works
------------
  1. Reads the last processed BORME date from the `borme_meta` table.
  2. For each following day up to today, fetches the sumario + PDFs for the
     Catalan provinces and parses them (borme_parser.py via borme_bulk_extract.py)
     into people relations and company acts.
  3. Companies are identified by their registry sheet (province + hoja); a new
     name is stored as the company name and the old one kept in `aliases`.
  4. Spans are replayed with borme_build_spans.apply_filing, the same rule as the
     full rebuild (appointments open; resignations, revocations, official
     cancellations, extinction, a new sole shareholder close).
  5. Company acts go to `company_events` and the company's `company_profile`
     (status, domicile, capital, activity…) is recomputed.
  6. person_summary / FTS rows are refreshed for the affected people and
     `borme_meta.last_processed_date` advances -- all in ONE transaction per day.

Re-running a day is a no-op for companies whose `last_seen` is already >= that
day, so interrupted runs can simply be restarted.

Usage
-----
  # Production (reads TURSO_URL + TURSO_WRITE_TOKEN from env; falls back to TURSO_TOKEN):
  python3 scripts/borme_incremental_update.py

  # Test against a local SQLite copy instead of Turso:
  python3 scripts/borme_incremental_update.py --sqlite /path/to/admin.sqlite --start-date 2026-11-07

  # Parse + compute without writing anything:
  python3 scripts/borme_incremental_update.py --dry-run
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import sqlite3
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import requests

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

import borme_bulk_extract as bx  # noqa: E402
import borme_build_spans as bspans  # noqa: E402
import borme_build_sqlite as bsql  # noqa: E402

ROLES_TO_INCLUDE = {"ADMINISTRADOR", "APODERADO", "SOCIO_UNICO", "ORGANO_GOBIERNO", "LIQUIDADOR"}
PERSON_RELATIONS = bsql.PERSON_RELATIONS
META_KEY = "last_processed_date"
CHUNK = 400

DEFAULT_CACHE_DIR = REPO_DIR / "borme-dataset" / "data" / "borme_cache" / "pdf_text"
DEFAULT_ARCHIVE_DIR = REPO_DIR / "borme-dataset" / "data" / "v2"

RELATION_FIELDS = [
  "borme_date", "borme_item_id", "province", "company_name_borme", "company_hoja", "relation_type", "owner_name",
  "event_type", "role_title_raw", "role_title_code", "has_constitucion", "constitution_date",
  "start_operations_raw", "start_operations_yyyymmdd", "datos_registrales_raw", "registry_tomo",
  "registry_folio", "registry_hoja", "registry_inscripcion", "registry_date_yyyymmdd",
  "company_tax_id_candidates", "owner_tax_id_candidates", "source_pdf_url",
  "match_type", "matched_nif", "matched_name", "matched_contracts",
]


def log(msg: str) -> None:
  print(msg, flush=True)


# ---------------------------------------------------------------------------
# DB backends
# ---------------------------------------------------------------------------
Stmt = tuple[str, list[Any]]


class LocalDB:
  def __init__(self, path: str):
    self.con = sqlite3.connect(path)
    self.con.row_factory = sqlite3.Row

  def query(self, sql: str, args: list[Any] | None = None) -> list[dict]:
    return [dict(r) for r in self.con.execute(sql, args or [])]

  def transaction(self, stmts: list[Stmt]) -> None:
    with self.con:
      for sql, args in stmts:
        self.con.execute(sql, args)


class TursoDB:
  def __init__(self, url: str, token: str):
    self.url = url.rstrip("/").replace("libsql://", "https://") + "/v2/pipeline"
    self.headers = {"Authorization": f"Bearer {token}"}

  @staticmethod
  def _enc(v: Any) -> dict:
    if v is None:
      return {"type": "null"}
    if isinstance(v, bool):
      return {"type": "integer", "value": str(int(v))}
    if isinstance(v, int):
      return {"type": "integer", "value": str(v)}
    if isinstance(v, float):
      return {"type": "float", "value": v}
    return {"type": "text", "value": str(v)}

  @staticmethod
  def _dec(cell: dict) -> Any:
    t = cell.get("type")
    if t == "null":
      return None
    if t == "integer":
      return int(cell["value"])
    if t == "float":
      return float(cell["value"])
    return cell.get("value")

  def _post(self, requests_body: list[dict], retries: int = 6) -> list[dict]:
    payload = {"requests": requests_body + [{"type": "close"}]}
    for attempt in range(retries):
      try:
        r = requests.post(self.url, json=payload, headers=self.headers, timeout=120)
        if r.status_code >= 500 or r.status_code == 429:
          raise requests.HTTPError(f"HTTP {r.status_code}: {r.text[:300]}")
        r.raise_for_status()
        return r.json()["results"]
      except (requests.RequestException, ValueError) as exc:
        if attempt == retries - 1:
          raise
        wait = min(30, 2 ** attempt)
        log(f"[WARN] Turso request failed ({exc}); retrying in {wait}s")
        time.sleep(wait)
    raise RuntimeError("unreachable")

  def _stmt(self, sql: str, args: list[Any]) -> dict:
    return {"sql": sql, "args": [self._enc(a) for a in args]}

  def query(self, sql: str, args: list[Any] | None = None) -> list[dict]:
    res = self._post([{"type": "execute", "stmt": self._stmt(sql, args or [])}])[0]
    if res["type"] != "ok":
      raise RuntimeError(f"Turso query error: {res.get('error')}")
    result = res["response"]["result"]
    cols = [c["name"] for c in result["cols"]]
    return [{c: self._dec(v) for c, v in zip(cols, row)} for row in result["rows"]]

  def transaction(self, stmts: list[Stmt]) -> None:
    # Hrana batch: BEGIN, each step conditional on the previous, COMMIT,
    # and ROLLBACK if COMMIT did not succeed. Atomic on the server side.
    steps: list[dict] = [{"stmt": {"sql": "BEGIN"}}]
    for sql, args in stmts:
      steps.append({"condition": {"type": "ok", "step": len(steps) - 1}, "stmt": self._stmt(sql, args)})
    commit_idx = len(steps)
    steps.append({"condition": {"type": "ok", "step": commit_idx - 1}, "stmt": {"sql": "COMMIT"}})
    steps.append({
      "condition": {"type": "not", "cond": {"type": "ok", "step": commit_idx}},
      "stmt": {"sql": "ROLLBACK"},
    })
    res = self._post([{"type": "batch", "batch": {"steps": steps}}])[0]
    if res["type"] != "ok":
      raise RuntimeError(f"Turso batch error: {res.get('error')}")
    result = res["response"]["result"]
    errors = [(i, e) for i, e in enumerate(result.get("step_errors") or []) if e]
    step_results = result.get("step_results") or []
    if errors or commit_idx >= len(step_results) or step_results[commit_idx] is None:
      detail = errors[0] if errors else "COMMIT did not run"
      raise RuntimeError(f"Turso transaction rolled back: {detail}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def chunks(seq: list, n: int = CHUNK):
  for i in range(0, len(seq), n):
    yield seq[i:i + n]


def ensure_meta(db) -> None:
  db.transaction([("CREATE TABLE IF NOT EXISTS borme_meta (key TEXT PRIMARY KEY, value TEXT)", [])])


def get_last_processed(db) -> str | None:
  rows = db.query("SELECT value FROM borme_meta WHERE key = ?", [META_KEY])
  return rows[0]["value"] if rows else None


def fetch_sumario_or_none(date_yyyymmdd: str) -> dict | None:
  """Return the sumario payload, or None if BORME was not published that day."""
  url = bx.BORME_SUMARIO_URL.format(date=date_yyyymmdd)
  for attempt in range(5):
    try:
      r = requests.get(url, headers=bx.HEADERS, timeout=bx.TIMEOUT_SECONDS)
      if r.status_code == 404:
        return None
      r.raise_for_status()
      payload = r.json()
      if payload.get("status", {}).get("code") != "200":
        raise ValueError(f"BORME API status {payload.get('status')}")
      return payload
    except (requests.RequestException, ValueError) as exc:
      if attempt == 4:
        raise
      wait = 2 ** attempt * 3
      log(f"[WARN] sumario {date_yyyymmdd} failed ({exc}); retrying in {wait}s")
      time.sleep(wait)
  return None


def prefetch_pdf(item: bx.SectionItem, cache_dir: Path) -> None:
  """Download + cache PDF text, raising on failure (process_item would swallow it)."""
  for attempt in range(5):
    try:
      bx.load_or_fetch_pdf_text(item, cache_dir)
      return
    except Exception as exc:  # noqa: BLE001
      if attempt == 4:
        raise RuntimeError(f"PDF {item.item_id} failed: {exc}") from exc
      time.sleep(2 ** attempt * 3)


def parse_day(day: str, provinces: set[str], cache_dir: Path, workers: int) -> tuple[list[dict], list[dict]] | None:
  """Return (relation rows, company act rows) for a day, or None if no BORME that day."""
  payload = fetch_sumario_or_none(day)
  if payload is None:
    return None
  items = bx.extract_section_a_items(payload, provinces, day)
  with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
    list(ex.map(lambda it: prefetch_pdf(it, cache_dir), items))

  rows: list[dict] = []
  acts: list[dict] = []
  seen: set[tuple] = set()
  for item in items:  # keep sumario order for deterministic filing order
    item_rows, item_acts, _stats = bx.process_item(item, cache_dir)
    for row in item_rows:
      key = (row["borme_date"], row["borme_item_id"], row.get("company_hoja", ""), row["company_name_borme"],
             row["relation_type"], row["event_type"], row["role_title_code"], row["owner_name"])
      if key in seen:
        continue
      seen.add(key)
      rows.append(row)
    acts.extend(item_acts)
  log(f"[INFO] {day}: {len(items)} PDFs, {len(rows)} relations, {len(acts)} acts")
  return rows, acts


def archive_rows(archive_dir: Path, day: str, rows: list[dict], acts: list[dict]) -> None:
  """Write the day's raw relations + acts next to the yearly CSVs of borme_reparse_cache.py
  so a full rebuild without the PDF cache can still pick them up."""
  out_dir = archive_dir / f"bulk_{day[:4]}"
  out_dir.mkdir(parents=True, exist_ok=True)
  for name, fields, data in (("relations", RELATION_FIELDS, rows), ("company_events", bx.COMPANY_EVENT_FIELDS, acts)):
    with (out_dir / f"{name}_{day}_{day}.csv").open("w", newline="", encoding="utf-8") as f:
      w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
      w.writeheader()
      w.writerows(data)


# ---------------------------------------------------------------------------
# Company keys and day grouping
# ---------------------------------------------------------------------------
def ckey(province: str, hoja: str, name: str) -> tuple[str, str]:
  """Company identity: registry sheet; the name only when a filing has no sheet."""
  return (province.strip(), f"H:{hoja.strip()}" if hoja.strip() else f"N:{name.strip()}")


def group_day(rows: list[dict], acts: list[dict]) -> dict[tuple[str, str], dict]:
  """{company key: {"name": latest name, "filings": {item_id: [span events]}, "acts": [act rows]}}"""
  out: dict[tuple[str, str], dict] = {}

  def entry(province: str, hoja: str, name: str) -> dict:
    k = ckey(province, hoja, name)
    e = out.setdefault(k, {"name": name, "filings": defaultdict(list), "acts": []})
    e["name"] = name  # rows come in filing order: the last name wins
    return e

  for row in rows:
    company = row["company_name_borme"].strip()
    if not company:
      continue
    e = entry(row["province"], row.get("company_hoja", ""), company)
    rel = row["relation_type"]
    owner = row["owner_name"].strip()
    if rel != "_COMPANY" and (rel not in ROLES_TO_INCLUDE or not owner):
      continue
    e["filings"][row["borme_item_id"].strip()].append({
      "event_type": (row.get("event_type") or "").strip().upper() or "MENCION",
      "relation_type": rel,
      "role_title_raw": (row.get("role_title_raw") or "").strip(),
      "role_title_code": (row.get("role_title_code") or "").strip(),
      "person_name": owner,
      "source_pdf_url": row["source_pdf_url"].strip(),
    })
  for act in acts:
    company = act["company_name_borme"].strip()
    if company:
      entry(act["province"], act.get("company_hoja", ""), company)["acts"].append(act)
  return out


def load_companies(db, keys: list[tuple[str, str]]) -> dict[tuple[str, str], dict]:
  found: dict[tuple[str, str], dict] = {}
  cols = "id, company_name, province, hoja, aliases, nif, last_seen"
  by_province: dict[str, list[str]] = defaultdict(list)
  names: list[str] = []
  for province, ident in keys:
    if ident.startswith("H:"):
      by_province[province].append(ident[2:])
    else:
      names.append(ident[2:])
  for province, hojas in by_province.items():
    for part in chunks(sorted(set(hojas))):
      ph = ",".join("?" for _ in part)
      for r in db.query(f"SELECT {cols} FROM companies WHERE province = ? AND hoja IN ({ph})", [province, *part]):
        found[(province, f"H:{r['hoja']}")] = r
  for part in chunks(sorted(set(names))):
    ph = ",".join("?" for _ in part)
    for r in db.query(f"SELECT {cols} FROM companies WHERE hoja IS NULL AND company_name IN ({ph}) ORDER BY id", part):
      found.setdefault((r["province"], f"N:{r['company_name']}"), r)
  return found


def load_open_spans(db, company_ids: list[int]) -> dict[int, list[dict]]:
  out: dict[int, list[dict]] = defaultdict(list)
  for part in chunks(company_ids):
    ph = ",".join("?" for _ in part)
    for r in db.query(
      f"SELECT id, company_id, person_name, relation_type, role_title_code, date_start "
      f"FROM admin_spans WHERE company_id IN ({ph}) AND date_end IS NULL ORDER BY id",
      part,
    ):
      out[r["company_id"]].append(r)
  return out


def load_company_events(db, company_ids: list[int]) -> dict[int, list[dict]]:
  out: dict[int, list[dict]] = defaultdict(list)
  for part in chunks(company_ids):
    ph = ",".join("?" for _ in part)
    for r in db.query(
      f"SELECT company_id, borme_date, act_code, fields_json FROM company_events "
      f"WHERE company_id IN ({ph}) ORDER BY borme_date, id",
      part,
    ):
      out[r["company_id"]].append({"borme_date": r["borme_date"], "act_code": r["act_code"],
                                   "fields": json.loads(r["fields_json"] or "{}")})
  return out


# ---------------------------------------------------------------------------
# NIF matching for new companies / new names (lazy: only fetched when needed)
# ---------------------------------------------------------------------------
class NifMatcher:
  def __init__(self):
    self._idx: tuple[dict, dict] | None = None

  def match(self, name: str) -> dict | None:
    if self._idx is None:
      log("[INFO] fetching Socrata company index for NIF matching …")
      self._idx = bsql.build_socrata_index(bsql.fetch_socrata_companies())
    return bsql.match_company(name, *self._idx)


# ---------------------------------------------------------------------------
# Build the per-day transaction
# ---------------------------------------------------------------------------
COMPANY_BY_KEY = "(SELECT id FROM companies WHERE province = ? AND {cond} ORDER BY id LIMIT 1)"


def company_ref(key: tuple[str, str]) -> tuple[str, list[Any]]:
  province, ident = key
  if ident.startswith("H:"):
    return COMPANY_BY_KEY.format(cond="hoja = ?"), [province, ident[2:]]
  return COMPANY_BY_KEY.format(cond="hoja IS NULL AND company_name = ?"), [province, ident[2:]]


def build_day_statements(db, day: str, rows: list[dict], acts: list[dict], matcher: NifMatcher) -> tuple[list[Stmt], dict]:
  grouped = group_day(rows, acts)
  stats = {"companies_new": 0, "companies_updated": 0, "companies_skipped": 0, "companies_renamed": 0,
           "spans_new": 0, "spans_closed": 0, "acts": 0, "persons": 0, "persons_new": 0}
  if not grouped:
    return [], stats

  existing = load_companies(db, list(grouped.keys()))
  # Idempotency: skip companies already updated with this (or a later) day.
  todo = {k: v for k, v in grouped.items() if k not in existing or (existing[k]["last_seen"] or "") < day}
  stats["companies_skipped"] = len(grouped) - len(todo)
  ids = [existing[k]["id"] for k in todo if k in existing]
  open_by_company = load_open_spans(db, ids)
  events_by_company = load_company_events(db, [existing[k]["id"] for k, v in todo.items() if k in existing and v["acts"]])

  stmts: list[Stmt] = []
  affected_persons: set[str] = set()

  for key, day_data in todo.items():
    province, ident = key
    hoja = ident[2:] if ident.startswith("H:") else None
    name = day_data["name"]
    comp = existing.get(key)
    ref_sql, ref_args = company_ref(key)

    if comp is None:
      m = matcher.match(name)
      stmts.append((
        "INSERT INTO companies (company_name, province, nif, match_type, matched_name, first_seen, last_seen, "
        "num_filings, hoja, aliases, extinct_on) VALUES (?,?,?,?,?,?,?,?,?,NULL,NULL)",
        [name, province, m["nif"] if m else None, m["match_type"] if m else None, m["name"] if m else None,
         day, day, 1, hoja],
      ))
      if m:
        stmts.append((f"INSERT OR IGNORE INTO company_nifs (nif, company_id, match_type, matched_name) "
                      f"VALUES (?, {ref_sql}, ?, ?)", [m["nif"], *ref_args, m["match_type"], m["name"]]))
      stats["companies_new"] += 1
      open_spans: list[dict] = []
      prior_events: list[dict] = []
    else:
      stmts.append(("UPDATE companies SET last_seen = ?, num_filings = COALESCE(num_filings, 0) + 1 WHERE id = ?",
                    [day, comp["id"]]))
      stats["companies_updated"] += 1
      if hoja and name != comp["company_name"]:
        # Renamed (or a cleaner spelling): keep the old name as an alias, try a NIF for the new one.
        aliases = [a for a in (comp["aliases"] or "").split("|") if a and a != name]
        if comp["company_name"] not in aliases:
          aliases.append(comp["company_name"])
        stmts.append(("UPDATE companies SET company_name = ?, aliases = ? WHERE id = ?",
                      [name, "|".join(aliases), comp["id"]]))
        m = matcher.match(name)
        if m:
          stmts.append(("INSERT OR IGNORE INTO company_nifs (nif, company_id, match_type, matched_name) VALUES (?,?,?,?)",
                        [m["nif"], comp["id"], m["match_type"], m["name"]]))
          if not comp["nif"]:
            stmts.append(("UPDATE companies SET nif = ?, match_type = ?, matched_name = ? WHERE id = ?",
                          [m["nif"], m["match_type"], m["name"], comp["id"]]))
        stats["companies_renamed"] += 1
      open_spans = open_by_company.get(comp["id"], [])
      prior_events = events_by_company.get(comp["id"], [])

    # --- spans (same rule as the full rebuild: borme_build_spans.apply_filing)
    active: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for sp in open_spans:
      active[(sp["person_name"], sp["relation_type"])].append(
        {"existing_id": sp["id"], "person_name": sp["person_name"], "role_title_code": sp["role_title_code"] or "",
         "date_start": sp["date_start"]})
    new_spans: list[dict] = []
    closed_existing: list[tuple[int, str, str, str, str]] = []

    def close(span: dict, date: str, item_id: str, pdf: str, reason: str) -> None:
      if "existing_id" in span:
        closed_existing.append((span["existing_id"], span["person_name"], item_id, pdf, reason))
      else:
        span.update(date_end=date, item_id_end=item_id, source_pdf_end=pdf, end_reason=reason)

    def open_span(event: dict, date: str, item_id: str) -> dict:
      span = {"person_name": event["person_name"], "relation_type": event["relation_type"],
              "role_title_raw": event["role_title_raw"], "role_title_code": event["role_title_code"],
              "date_start": date, "date_end": None, "item_id_start": item_id, "item_id_end": None,
              "source_pdf_start": event["source_pdf_url"], "source_pdf_end": None, "end_reason": None}
      new_spans.append(span)
      return span

    extinct = False
    for item_id in sorted(day_data["filings"]):
      extinct |= bspans.apply_filing(active, day_data["filings"][item_id], day, item_id, close, open_span)

    for span_id, person, item_id_end, pdf_end, reason in closed_existing:
      stmts.append(("UPDATE admin_spans SET date_end = ?, item_id_end = ?, source_pdf_end = ?, end_reason = ? "
                    "WHERE id = ? AND date_end IS NULL", [day, item_id_end, pdf_end, reason, span_id]))
      affected_persons.add(person)
    for sp in new_spans:
      stmts.append((
        "INSERT INTO admin_spans (company_id, person_name, relation_type, role_title_raw, role_title_code, "
        "date_start, date_end, item_id_start, item_id_end, source_pdf_start, source_pdf_end, end_reason) "
        f"VALUES ({ref_sql},?,?,?,?,?,?,?,?,?,?,?)",
        [*ref_args, sp["person_name"], sp["relation_type"], sp["role_title_raw"] or None, sp["role_title_code"] or None,
         sp["date_start"], sp["date_end"], sp["item_id_start"], sp["item_id_end"], sp["source_pdf_start"],
         sp["source_pdf_end"], sp["end_reason"]],
      ))
      affected_persons.add(sp["person_name"])
    if extinct:
      stmts.append((f"UPDATE companies SET extinct_on = ? WHERE id = {ref_sql}", [day, *ref_args]))
    stats["spans_new"] += len(new_spans)
    stats["spans_closed"] += len(closed_existing)

    # --- company acts + profile
    company_acts = [a for a in day_data["acts"] if a["act_code"] not in bsql.ROLE_ACT_CODES]
    for act in company_acts:
      stmts.append((f"INSERT INTO company_events (company_id, borme_date, act_code, fields_json, source_pdf) "
                    f"VALUES ({ref_sql},?,?,?,?)",
                    [*ref_args, act["borme_date"], act["act_code"], act["fields_json"], act["source_pdf_url"]]))
    if company_acts:
      stats["acts"] += len(company_acts)
      evs = prior_events + [{"borme_date": a["borme_date"], "act_code": a["act_code"],
                             "fields": json.loads(a["fields_json"] or "{}")} for a in company_acts]
      prof = bsql.build_profile(evs)
      cols = bsql.PROFILE_COLUMNS
      stmts.append((
        f"INSERT INTO company_profile (company_id, {', '.join(cols)}) VALUES ({ref_sql}, {','.join('?' * len(cols))}) "
        f"ON CONFLICT(company_id) DO UPDATE SET {', '.join(f'{c} = excluded.{c}' for c in cols)}",
        [*ref_args, *[prof.get(c) for c in cols]],
      ))

  # person_summary refresh (+ FTS rows for people seen for the first time)
  persons = sorted(affected_persons)
  known: set[str] = set()
  for part in chunks(persons):
    ph = ",".join("?" for _ in part)
    known.update(r["person_name"] for r in db.query(
      f"SELECT person_name FROM person_summary WHERE person_name IN ({ph})", part))
  rel_ph = ",".join("?" for _ in PERSON_RELATIONS)
  for person in persons:
    norm = bsql.normalize_person_name(person)
    # UPSERT, never REPLACE: person search joins person_summary_fts ON
    # f.rowid = p.rowid, and REPLACE would give the row a new rowid.
    stmts.append((
      f"""INSERT INTO person_summary
            (person_name, person_name_norm, num_companies, num_companies_with_nif, active_spans, total_spans)
          SELECT s.person_name, ?,
                 count(DISTINCT s.company_id),
                 count(DISTINCT CASE WHEN c.nif IS NOT NULL AND c.nif <> '' THEN s.company_id END),
                 sum(CASE WHEN s.date_end IS NULL THEN 1 ELSE 0 END),
                 count(*)
          FROM admin_spans s JOIN companies c ON c.id = s.company_id
          WHERE s.person_name = ? AND s.relation_type IN ({rel_ph})
          GROUP BY s.person_name
          ON CONFLICT(person_name) DO UPDATE SET
            num_companies = excluded.num_companies,
            num_companies_with_nif = excluded.num_companies_with_nif,
            active_spans = excluded.active_spans,
            total_spans = excluded.total_spans""",
      [norm, person, *PERSON_RELATIONS],
    ))
    if person not in known:
      stmts.append((
        "INSERT INTO person_summary_fts (rowid, person_name, person_name_norm) "
        "SELECT rowid, person_name, person_name_norm FROM person_summary WHERE person_name = ?",
        [person],
      ))
      stats["persons_new"] += 1
  stats["persons"] = len(persons)
  return stmts, stats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> int:
  p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
  p.add_argument("--sqlite", help="Apply to a local SQLite file instead of Turso.")
  p.add_argument("--start-date", help="YYYY-MM-DD; overrides borme_meta (required on first run).")
  p.add_argument("--end-date", help="YYYY-MM-DD; default today.")
  p.add_argument("--max-days", type=int, default=0, help="Stop after N calendar days (0 = no limit).")
  p.add_argument("--provinces", default=",".join(bx.DEFAULT_PROVINCES))
  p.add_argument("--workers", type=int, default=6)
  p.add_argument("--cache-dir", default=str(DEFAULT_CACHE_DIR))
  p.add_argument("--archive-dir", default=str(DEFAULT_ARCHIVE_DIR),
                 help="Where to write per-day relations CSVs (bulk_YYYY/). Use '' to disable.")
  p.add_argument("--dry-run", action="store_true", help="Parse and compute, but write nothing to the DB.")
  args = p.parse_args()

  if args.sqlite:
    db = LocalDB(args.sqlite)
    target = args.sqlite
  else:
    url = os.environ.get("TURSO_URL")
    # The web app's TURSO_TOKEN is typically read-only; prefer a dedicated write token.
    token = (os.environ.get("TURSO_WRITE_TOKEN") or os.environ.get("TURSO_TOKEN")
             or os.environ.get("TURSO_AUTH_TOKEN"))
    if not url or not token:
      log("[ERROR] TURSO_URL and TURSO_WRITE_TOKEN (or TURSO_TOKEN) must be set (or pass --sqlite).")
      return 2
    db = TursoDB(url, token)
    target = url

  if not args.dry_run:
    ensure_meta(db)
  last = None
  try:
    last = get_last_processed(db)
  except Exception:  # noqa: BLE001 -- table may not exist in dry-run
    pass

  today = dt.date.today()
  if args.start_date:
    start = bx.parse_date(args.start_date)
  elif last:
    start = bx.parse_date(last) + dt.timedelta(days=1)
  else:
    log("[ERROR] borme_meta has no last_processed_date; pass --start-date (e.g. 2026-01-01).")
    return 2
  end = bx.parse_date(args.end_date) if args.end_date else today
  end = min(end, today)

  log(f"[INFO] target={target} range={start}..{end} last_processed={last} dry_run={args.dry_run}")
  provinces = {bx.normalize_spaces(x).upper() for x in args.provinces.split(",") if x.strip()}
  cache_dir = Path(args.cache_dir)
  archive_dir = Path(args.archive_dir) if args.archive_dir else None
  matcher = NifMatcher()
  totals: dict[str, int] = defaultdict(int)
  days_done = 0

  day = start
  while day <= end:
    if args.max_days and days_done >= args.max_days:
      break
    ds = day.strftime("%Y%m%d")
    parsed = parse_day(ds, provinces, cache_dir, args.workers)
    if parsed is None:
      if day >= today:
        log(f"[INFO] {ds}: not published yet; stopping without advancing.")
        break
      log(f"[INFO] {ds}: no BORME published")
      parsed = ([], [])
    rows, acts = parsed

    if (rows or acts) and archive_dir:
      archive_rows(archive_dir, ds, rows, acts)

    stmts, stats = build_day_statements(db, ds, rows, acts, matcher)
    stmts.append(("INSERT OR REPLACE INTO borme_meta (key, value) VALUES (?, ?)", [META_KEY, ds]))
    if rows:
      log(f"[INFO] {ds}: {stats} -> {len(stmts)} statements")
    if not args.dry_run:
      db.transaction(stmts)
    for k, v in stats.items():
      totals[k] += v
    days_done += 1
    day += dt.timedelta(days=1)

  log(f"[DONE] {days_done} days processed; totals={dict(totals)}")

  # Let the GitHub workflow skip the (~17 min) graph rebuild when nothing changed.
  gh_output = os.environ.get("GITHUB_OUTPUT")
  if gh_output:
    changed = (not args.dry_run) and any(
      totals.get(k, 0) > 0 for k in ("companies_new", "companies_updated", "spans_new", "spans_closed", "persons_new", "acts")
    )
    with open(gh_output, "a", encoding="utf-8") as fh:
      fh.write(f"changed={'true' if changed else 'false'}\n")
  return 0


if __name__ == "__main__":
  sys.exit(main())
