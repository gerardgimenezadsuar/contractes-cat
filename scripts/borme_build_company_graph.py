#!/usr/bin/env python3
"""
Build the "related companies" graph from BORME admin spans and sync it to the
`company_links` table (Turso in production, or a local SQLite file).

Only ownership and real administration create links:
  OWNER  SOCIO_UNICO. Only the LATEST sole shareholder of each company counts:
         BORME never closes sole-shareholder spans, so older ones are stale
         (e.g. shelf companies that were sold).
  ADMIN  ADMINISTRADOR (excluding insolvency/judicial/substitute administrators)
         and board control roles (president, vice-president, CEO / consejero
         delegado). Plain consejeros, secretaries, apoderados and liquidators
         are excluded.

Noise filters:
  - ADMIN spans that ended within 120 days (shelf-company hand-overs).
  - Officers in more than HUB_LIMIT companies (professional nominees,
    corporate-service providers): never used to link companies.
  - Junk names from PDF parsing; person names with fewer than 3 words
    (too ambiguous without a DNI).

Link types, stored per company NIF (only companies with a NIF have a page):
  PARENT        a company that is sole shareholder / administrator of this one
  SUBSIDIARY    a company this one owns / administers
  SHARED_ADMIN  another company with the same owner or administrator
Each row keeps compact JSON evidence (who, which role, dates, BORME PDF).

Usage:
  python3 scripts/borme_build_company_graph.py              # Turso (TURSO_URL + TURSO_WRITE_TOKEN)
  python3 scripts/borme_build_company_graph.py --sqlite X   # local copy
  python3 scripts/borme_build_company_graph.py --dry-run    # compute + diff, write nothing
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from borme_build_sqlite import normalize_name  # noqa: E402
from borme_incremental_update import LocalDB, TursoDB  # noqa: E402

HUB_LIMIT = 20            # officers in more companies than this never create links
SHORT_SPAN_DAYS = 120     # ADMIN spans shorter than this are ignored
MAX_LINKS_PER_COMPANY = 100
MAX_EVIDENCE = 5
PAGE = 50_000
WRITE_BATCH = 500

CONTROL_BOARD = re.compile(r"(PRESIDEN|VICEPRESID|COPRESID|CONS_DEL|CONS_EJECUT)")
EXCLUDED_ADMIN = re.compile(r"(CONCURS|CONC$|JUDICIAL|SUPL|SUP_MAN)")
ENTITY_SUFFIX = re.compile(
  r"\b(SL|SA|SLU|SAU|SLP|SLL|SCCL|SCP|S\.?L\.?U?|S\.?A\.?U?|SOCIEDAD|SOCIETAT|AIE|FUNDACION|FUNDACIO|COOPERATIVA)\b\.?$"
)

SCHEMA = """CREATE TABLE IF NOT EXISTS company_links (
  nif        TEXT NOT NULL,
  link_type  TEXT NOT NULL,
  related_id INTEGER NOT NULL,
  active     INTEGER NOT NULL,
  strength   INTEGER NOT NULL,
  evidence   TEXT NOT NULL,
  h          TEXT NOT NULL,
  PRIMARY KEY (nif, link_type, related_id)
) WITHOUT ROWID"""


def log(msg: str) -> None:
  print(msg, flush=True)


def role_class(relation_type: str, code: str | None) -> str | None:
  code = code or ""
  if relation_type == "SOCIO_UNICO":
    return "OWNER"
  if relation_type == "ADMINISTRADOR":
    return None if EXCLUDED_ADMIN.search(code) else "ADMIN"
  if relation_type == "ORGANO_GOBIERNO":
    return "ADMIN" if CONTROL_BOARD.search(code) else None
  return None


def is_junk(name: str) -> bool:
  return "REGISTRO MERCANTIL" in name.upper() or ":" in name


def is_entity(name: str) -> bool:
  return bool(ENTITY_SUFFIX.search(name.strip().upper()))


def span_days(start: str, end: str | None) -> int:
  if not end:
    return 1 << 30
  try:
    return (datetime.strptime(end, "%Y%m%d") - datetime.strptime(start, "%Y%m%d")).days
  except ValueError:
    return 1 << 30


# ---------------------------------------------------------------------------
# Load
# ---------------------------------------------------------------------------
def load_paged(db, sql_tpl: str, id_col: str, max_id: int) -> list[dict]:
  out: list[dict] = []
  lo = 0
  while lo < max_id:
    out.extend(db.query(sql_tpl, [lo, lo + PAGE]))
    lo += PAGE
  return out


def load(db) -> tuple[dict[int, dict], list[dict]]:
  max_c = db.query("SELECT max(id) AS m FROM companies")[0]["m"] or 0
  companies = {
    r["id"]: r for r in load_paged(
      db, "SELECT id, company_name, nif FROM companies WHERE id > ? AND id <= ?", "id", max_c)
  }
  max_s = db.query("SELECT max(id) AS m FROM admin_spans")[0]["m"] or 0
  spans = load_paged(
    db,
    "SELECT company_id, person_name, relation_type, role_title_code, date_start, date_end, source_pdf_start "
    "FROM admin_spans WHERE id > ? AND id <= ? "
    "AND relation_type IN ('SOCIO_UNICO','ADMINISTRADOR','ORGANO_GOBIERNO')",
    "id", max_s,
  )
  return companies, spans


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
def build_links(companies: dict[int, dict], spans: list[dict]) -> dict[tuple[str, str, int], dict]:
  # 1. classify + filter spans
  kept: list[dict] = []
  latest_owner_date: dict[int, str] = {}
  for s in spans:
    name = (s["person_name"] or "").strip()
    if not name or is_junk(name):
      continue
    cls = role_class(s["relation_type"], s["role_title_code"])
    if cls is None:
      continue
    if cls == "ADMIN" and span_days(s["date_start"], s["date_end"]) < SHORT_SPAN_DAYS:
      continue
    if cls == "OWNER":
      cid = s["company_id"]
      if s["date_start"] > latest_owner_date.get(cid, ""):
        latest_owner_date[cid] = s["date_start"]
    kept.append({**s, "person_name": name, "cls": cls})
  kept = [s for s in kept if s["cls"] != "OWNER" or s["date_start"] == latest_owner_date[s["company_id"]]]
  log(f"  kept {len(kept):,} owner/admin spans")

  # 2. officers -> companies, hubs
  by_officer: dict[str, list[dict]] = defaultdict(list)
  for s in kept:
    by_officer[s["person_name"]].append(s)
  n_companies = {p: len({s["company_id"] for s in ss}) for p, ss in by_officer.items()}
  hubs = {p for p, n in n_companies.items() if n > HUB_LIMIT}
  log(f"  officers {len(by_officer):,}, hubs (> {HUB_LIMIT} companies) {len(hubs):,}")

  # 3. legal-entity officers that are themselves a (unique) company in BORME
  norm_index: dict[str, list[int]] = defaultdict(list)
  for cid, c in companies.items():
    norm_index[normalize_name(c["company_name"])].append(cid)
  entity_company: dict[str, int] = {}
  for p in by_officer:
    if is_entity(p):
      hits = norm_index.get(normalize_name(p), [])
      if len(hits) == 1:
        entity_company[p] = hits[0]
  log(f"  legal-entity officers matched to a BORME company: {len(entity_company):,}")

  def ev(s: dict) -> dict:
    return {"r": s["cls"], "c": s["role_title_code"] or s["relation_type"], "s": s["date_start"],
            "e": s["date_end"], "p": s["source_pdf_start"]}

  # pair -> list of evidence; directed parent edges (parent_id, child_id)
  parent_edges: dict[tuple[int, int], list[dict]] = defaultdict(list)
  shared: dict[tuple[int, int], list[dict]] = defaultdict(list)

  for officer, ss in by_officer.items():
    if officer in entity_company:
      parent_id = entity_company[officer]
      admin_companies = {s["company_id"] for s in ss if s["cls"] == "ADMIN"}
      for s in ss:
        if s["company_id"] == parent_id:
          continue
        # A company administering many others is a service provider, not a parent.
        if s["cls"] == "ADMIN" and len(admin_companies) > HUB_LIMIT:
          continue
        parent_edges[(parent_id, s["company_id"])].append({"o": officer, **ev(s)})
      continue
    if officer in hubs:
      continue
    if not is_entity(officer) and len(officer.split()) < 3:
      continue
    per_company: dict[int, dict] = {}
    for s in ss:  # one representative span per company: open first, then latest
      cur = per_company.get(s["company_id"])
      if cur is None or (s["date_end"] is None, s["date_start"]) > (cur["date_end"] is None, cur["date_start"]):
        per_company[s["company_id"]] = s
    cids = sorted(per_company)
    for i in range(len(cids)):
      for j in range(i + 1, len(cids)):
        a, b = per_company[cids[i]], per_company[cids[j]]
        shared[(cids[i], cids[j])].append({"o": officer, "a": ev(a), "b": ev(b)})

  log(f"  parent edges {len(parent_edges):,}, shared-officer pairs {len(shared):,}")

  # 4. anchor rows for companies with a NIF
  ids_by_nif: dict[str, set[int]] = defaultdict(set)
  for cid, c in companies.items():
    if c["nif"]:
      ids_by_nif[c["nif"]].add(cid)
  nif_of = {cid: c["nif"] for cid, c in companies.items() if c["nif"]}

  rows: dict[tuple[str, str, int], dict] = {}

  def add(nif: str, link_type: str, related: int, evidence: list[dict], active: bool) -> None:
    if related in ids_by_nif[nif] or (nif_of.get(related) == nif):
      return
    key = (nif, link_type, related)
    cur = rows.get(key)
    if cur is None:
      rows[key] = {"active": active, "evidence": list(evidence)}
    else:
      cur["active"] = cur["active"] or active
      cur["evidence"].extend(evidence)

  for (parent_id, child_id), evs in parent_edges.items():
    active = any(e["e"] is None for e in evs)
    if child_id in nif_of:
      add(nif_of[child_id], "PARENT", parent_id, evs, active)
    if parent_id in nif_of:
      add(nif_of[parent_id], "SUBSIDIARY", child_id, evs, active)
  for (a, b), evs in shared.items():
    active = any(e["a"]["e"] is None and e["b"]["e"] is None for e in evs)
    if a in nif_of:
      add(nif_of[a], "SHARED_ADMIN", b, evs, active)
    if b in nif_of:
      # evidence is stored from the anchor's point of view: "a" = anchor side
      add(nif_of[b], "SHARED_ADMIN", a, [{"o": e["o"], "a": e["b"], "b": e["a"]} for e in evs], active)

  # 5. finalize: strength, cap evidence, cap links per company, hash
  by_nif: dict[str, list[tuple[tuple[str, str, int], dict]]] = defaultdict(list)
  for key, r in rows.items():
    officers = {e["o"] for e in r["evidence"]}
    r["strength"] = len(officers)
    r["evidence"] = sorted(r["evidence"], key=lambda e: (e.get("e") is None if "e" in e else e["a"]["e"] is None),
                           reverse=True)[:MAX_EVIDENCE]
    by_nif[key[0]].append((key, r))
  final: dict[tuple[str, str, int], dict] = {}
  type_rank = {"PARENT": 0, "SUBSIDIARY": 1, "SHARED_ADMIN": 2}
  for nif, items in by_nif.items():
    items.sort(key=lambda kv: (not kv[1]["active"], type_rank[kv[0][1]], -kv[1]["strength"], kv[0][2]))
    for key, r in items[:MAX_LINKS_PER_COMPANY]:
      evidence = json.dumps(r["evidence"], ensure_ascii=False, separators=(",", ":"), sort_keys=True)
      active = 1 if r["active"] else 0
      h = hashlib.sha1(f"{active}|{r['strength']}|{evidence}".encode()).hexdigest()[:16]
      final[key] = {"active": active, "strength": r["strength"], "evidence": evidence, "h": h}
  log(f"  link rows: {len(final):,} for {len(by_nif):,} companies with a NIF")
  return final


# ---------------------------------------------------------------------------
# Sync (diff by hash)
# ---------------------------------------------------------------------------
def load_existing(db) -> dict[tuple[str, str, int], str]:
  out: dict[tuple[str, str, int], str] = {}
  last = ("", "", -1)
  while True:
    page = db.query(
      "SELECT nif, link_type, related_id, h FROM company_links "
      "WHERE (nif, link_type, related_id) > (?, ?, ?) ORDER BY nif, link_type, related_id LIMIT ?",
      [*last, PAGE],
    )
    for r in page:
      out[(r["nif"], r["link_type"], r["related_id"])] = r["h"]
    if len(page) < PAGE:
      return out
    last = (page[-1]["nif"], page[-1]["link_type"], page[-1]["related_id"])


def sync(db, final: dict, dry_run: bool) -> None:
  if not dry_run:
    db.transaction([(SCHEMA, [])])
  try:
    existing = load_existing(db)
  except Exception:  # noqa: BLE001 -- table missing in dry-run
    existing = {}
  upserts = [k for k, v in final.items() if existing.get(k) != v["h"]]
  deletes = [k for k in existing if k not in final]
  log(f"  diff: {len(upserts):,} upserts, {len(deletes):,} deletes (existing {len(existing):,})")
  if dry_run:
    return
  stmts = [("DELETE FROM company_links WHERE nif = ? AND link_type = ? AND related_id = ?", list(k)) for k in deletes]
  for k in upserts:
    v = final[k]
    stmts.append((
      "INSERT OR REPLACE INTO company_links (nif, link_type, related_id, active, strength, evidence, h) "
      "VALUES (?,?,?,?,?,?,?)",
      [*k, v["active"], v["strength"], v["evidence"], v["h"]],
    ))
  for i in range(0, len(stmts), WRITE_BATCH):
    db.transaction(stmts[i:i + WRITE_BATCH])
    if (i // WRITE_BATCH) % 20 == 0:
      log(f"  wrote {min(i + WRITE_BATCH, len(stmts)):,}/{len(stmts):,}")


def main() -> int:
  p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
  p.add_argument("--sqlite", help="Use a local SQLite file instead of Turso.")
  p.add_argument("--dry-run", action="store_true")
  args = p.parse_args()
  if args.sqlite:
    db = LocalDB(args.sqlite)
  else:
    url = os.environ.get("TURSO_URL")
    token = os.environ.get("TURSO_WRITE_TOKEN") or os.environ.get("TURSO_TOKEN")
    if not url or not token:
      log("[ERROR] TURSO_URL and TURSO_WRITE_TOKEN must be set (or pass --sqlite).")
      return 2
    db = TursoDB(url, token)

  t0 = time.time()
  log("[1/3] loading companies and spans …")
  companies, spans = load(db)
  log(f"  {len(companies):,} companies, {len(spans):,} spans ({time.time() - t0:.0f}s)")
  log("[2/3] building links …")
  final = build_links(companies, spans)
  log("[3/3] syncing company_links …")
  sync(db, final, args.dry_run)
  log(f"[DONE] {time.time() - t0:.0f}s")
  return 0


if __name__ == "__main__":
  sys.exit(main())
