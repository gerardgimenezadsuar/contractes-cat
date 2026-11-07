#!/usr/bin/env python3
"""
Rebuild person_summary_fts so its rowids match person_summary rowids.

Person search joins `person_summary_fts f ON f.rowid = p.rowid`. The first
version of borme_incremental_update.py used INSERT OR REPLACE on
person_summary, which re-assigned rowids for every touched person and broke
that join. This rebuilds the FTS table in a single transaction (~750k rows).

Usage (needs a write token):
  set -a; source .env.local; set +a
  python3 scripts/borme_repair_person_fts.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from borme_incremental_update import TursoDB  # noqa: E402

db = TursoDB(os.environ["TURSO_URL"], os.environ["TURSO_WRITE_TOKEN"])

check_sql = (
  "SELECT count(*) AS n FROM person_summary p LEFT JOIN person_summary_fts f ON f.rowid = p.rowid "
  "WHERE f.person_name IS NOT p.person_name"
)
print("misaligned before:", db.query(check_sql)[0]["n"], flush=True)
db.transaction([
  ("DELETE FROM person_summary_fts", []),
  ("INSERT INTO person_summary_fts (rowid, person_name, person_name_norm) "
   "SELECT rowid, person_name, person_name_norm FROM person_summary", []),
])
print("misaligned after:", db.query(check_sql)[0]["n"], flush=True)
print("rows:", db.query("SELECT (SELECT count(*) FROM person_summary) AS ps, (SELECT count(*) FROM person_summary_fts) AS fts")[0])
