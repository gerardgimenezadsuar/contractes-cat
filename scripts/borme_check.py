#!/usr/bin/env python3
"""
Read-only health checks for the BORME admin-history DB (Turso).

Default checks are cheap (index/primary-key lookups on the newest rows) so
they can run after every scheduled update:

  1. freshness       borme_meta.last_processed_date is recent (BORME publishes Mon-Fri)
  2. orphans         newest spans all point at an existing company
  3. dates           newest spans have date_end >= date_start
  4. duplicates      no person/role is open twice in the same company
                     (what a day applied twice would produce)
  5. person_summary  counts match the spans for people in the newest spans
  6. search index    person_summary_fts rowid == person_summary rowid for the
                     newest people (search joins on rowid)

--full adds whole-table checks (~2-4M rows read, run occasionally):
  - search index alignment for every person
  - spans opened per month in the last 24 months, to compare 2026 volumes
    with the same months of 2025

Exit code 1 if any check fails.

Usage:
  set -a; source .env.local; set +a
  python3 scripts/borme_check.py [--full] [--max-lag-days 5]
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from borme_incremental_update import PERSON_RELATIONS, TursoDB  # noqa: E402

RECENT_SPANS = 20_000    # newest spans by id (new spans get increasing ids)
RECENT_PERSONS = 20_000  # newest people by rowid

failures: list[str] = []


def check(name: str, ok: bool, detail: str) -> None:
  print(f"[{'OK' if ok else 'FAIL'}] {name}: {detail}", flush=True)
  if not ok:
    failures.append(name)


def main() -> int:
  p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
  p.add_argument("--full", action="store_true", help="Also run whole-table checks (more rows read).")
  p.add_argument("--max-lag-days", type=int, default=5, help="Max days between today and last processed date.")
  args = p.parse_args()

  url = os.environ.get("TURSO_URL")
  token = os.environ.get("TURSO_TOKEN") or os.environ.get("TURSO_WRITE_TOKEN") or os.environ.get("TURSO_AUTH_TOKEN")
  if not url or not token:
    print("TURSO_URL and TURSO_TOKEN (read-only is enough) must be set.")
    return 2
  db = TursoDB(url, token)
  q = db.query

  # 1. freshness
  meta = q("SELECT value FROM borme_meta WHERE key = 'last_processed_date'")
  last = meta[0]["value"] if meta else None
  if last:
    lag = (dt.date.today() - dt.datetime.strptime(last, "%Y%m%d").date()).days
    check("freshness", lag <= args.max_lag_days, f"last processed {last} ({lag} days ago)")
  else:
    check("freshness", False, "borme_meta has no last_processed_date")

  max_id = q("SELECT max(id) AS m FROM admin_spans")[0]["m"] or 0
  since_id = max(0, max_id - RECENT_SPANS)
  rel_ph = ",".join("?" for _ in PERSON_RELATIONS)

  # 2. orphans
  n = q("SELECT count(*) AS n FROM admin_spans s LEFT JOIN companies c ON c.id = s.company_id "
        "WHERE s.id > ? AND c.id IS NULL", [since_id])[0]["n"]
  check("orphans", n == 0, f"{n} of the newest {RECENT_SPANS:,} spans have no company")

  # 3. dates
  n = q("SELECT count(*) AS n FROM admin_spans WHERE id > ? AND date_end IS NOT NULL AND date_end < date_start",
        [since_id])[0]["n"]
  check("dates", n == 0, f"{n} of the newest spans end before they start")

  # 4. duplicates: another open span with the same company/person/role/title
  n = q("""SELECT count(*) AS n FROM admin_spans s
           JOIN admin_spans o ON o.person_name = s.person_name AND o.company_id = s.company_id
            AND o.relation_type = s.relation_type AND coalesce(o.role_title_code, '') = coalesce(s.role_title_code, '')
            AND o.date_end IS NULL AND o.id <> s.id
           WHERE s.id > ? AND s.date_end IS NULL""", [since_id])[0]["n"]
  check("duplicates", n == 0, f"{n} newest open spans have an identical open twin")

  # 5. person_summary consistency for people in the newest spans
  n = q(f"""WITH people AS (SELECT DISTINCT person_name FROM admin_spans WHERE id > ?),
            agg AS (
              SELECT s.person_name,
                     count(DISTINCT s.company_id) AS nc,
                     count(DISTINCT CASE WHEN c.nif IS NOT NULL AND c.nif <> '' THEN s.company_id END) AS nn,
                     sum(CASE WHEN s.date_end IS NULL THEN 1 ELSE 0 END) AS a,
                     count(*) AS t
              FROM admin_spans s JOIN companies c ON c.id = s.company_id
              WHERE s.person_name IN (SELECT person_name FROM people) AND s.relation_type IN ({rel_ph})
              GROUP BY s.person_name)
            SELECT count(*) AS n FROM agg LEFT JOIN person_summary p ON p.person_name = agg.person_name
            WHERE p.person_name IS NULL OR p.num_companies <> agg.nc OR p.num_companies_with_nif <> agg.nn
               OR p.active_spans <> agg.a OR p.total_spans <> agg.t""",
        [since_id, *PERSON_RELATIONS])[0]["n"]
  check("person_summary", n == 0, f"{n} people from the newest spans have stale/missing summary rows")

  # 6. search index alignment (newest people, or everyone with --full)
  max_rowid = q("SELECT max(rowid) AS m FROM person_summary")[0]["m"] or 0
  from_rowid = 0 if args.full else max(0, max_rowid - RECENT_PERSONS)
  n = q("""SELECT count(*) AS n FROM person_summary p LEFT JOIN person_summary_fts f ON f.rowid = p.rowid
           WHERE p.rowid > ? AND f.person_name IS NOT p.person_name""", [from_rowid])[0]["n"]
  scope = "all people" if args.full else f"newest {RECENT_PERSONS:,} people"
  check("search_index", n == 0, f"{n} misaligned rows ({scope})")
  if args.full:
    c = q("SELECT (SELECT count(*) FROM person_summary) AS ps, (SELECT count(*) FROM person_summary_fts) AS fts")[0]
    check("search_index_count", c["ps"] == c["fts"], f"person_summary={c['ps']:,} fts={c['fts']:,}")

    # Volume sanity: spans opened per month, last 24 months.
    start = (dt.date.today().replace(day=1) - dt.timedelta(days=760)).strftime("%Y%m01")
    rows = q("SELECT substr(date_start, 1, 6) AS ym, count(*) AS n FROM admin_spans "
             "WHERE date_start >= ? GROUP BY ym ORDER BY ym", [start])
    print("\nSpans opened per month (compare 2026 with the same months of 2025):")
    by = {r["ym"]: r["n"] for r in rows}
    for ym, n in by.items():
        prev = by.get(f"{int(ym[:4]) - 1}{ym[4:]}")
        cmp = f"  vs {prev:>6,} a year earlier ({n / prev:5.0%})" if prev else ""
        print(f"  {ym}: {n:>6,}{cmp}")

  print("\nRESULT:", "FAIL " + ", ".join(failures) if failures else "all checks passed", flush=True)
  return 1 if failures else 0


if __name__ == "__main__":
  sys.exit(main())
