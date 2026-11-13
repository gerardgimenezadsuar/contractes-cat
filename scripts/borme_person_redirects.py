#!/usr/bin/env python3
"""Map person URLs that disappear in a rebuild to their new name (301 redirects).

Person pages live at /persones/<BORME name>. When a parser fix changes a name
("DONJAUME CAMPI GINESTA" -> "JAUME CAMPI GINESTA", "FOUR LILI" -> "FOUR LILI
CAPITAL SL"), the old URL would stop resolving and lose its search ranking.

Inputs : --old-names JSON list of indexable names in the current prod DB
         --old-db    SQLite with companies(nif) + spans/admin_spans(person_name) of prod
         --new-db    the rebuilt admin.sqlite (with company_nifs + person_summary)
Output : src/data/person-redirects.json  {old name: new name}, merged with the
         existing file (chains are collapsed, entries whose target vanished dropped).
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import sqlite3
import unicodedata
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "person-redirects.json"


def norm(s: str) -> str:
  s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").upper()
  s = re.sub(r"^(DON|DONA)\s*", "", s)
  return re.sub(r"[^A-Z0-9]", "", s)


def main() -> int:
  ap = argparse.ArgumentParser()
  ap.add_argument("--old-names", required=True)
  ap.add_argument("--old-db", required=True)
  ap.add_argument("--new-db", required=True)
  args = ap.parse_args()

  old_names = json.load(open(args.old_names, encoding="utf-8"))
  new = sqlite3.connect(args.new_db)
  new_people = {r[0]: (r[1] or 0) for r in new.execute("SELECT person_name, num_control_companies_with_nif FROM person_summary")}
  new_indexable = {n for n, c in new_people.items() if c > 0}
  by_norm = collections.defaultdict(set)
  for n in new_indexable:
    by_norm[norm(n)].add(n)

  old = sqlite3.connect(args.old_db)
  span_table = "spans" if old.execute("SELECT 1 FROM sqlite_master WHERE name='spans'").fetchone() else "admin_spans"
  old_nifs = collections.defaultdict(set)
  for name, nif in old.execute(f"SELECT s.person_name, c.nif FROM {span_table} s JOIN companies c ON c.id = s.company_id WHERE c.nif IS NOT NULL"):
    old_nifs[name].add(nif)
  new_by_nif = collections.defaultdict(set)
  for name, nif in new.execute("SELECT s.person_name, n.nif FROM admin_spans s JOIN company_nifs n ON n.company_id = s.company_id"):
    new_by_nif[nif].add(name)

  mapping: dict[str, str] = {}
  stats = collections.Counter()
  for name in old_names:
    if name in new_people:
      stats["unchanged"] += 1
      continue
    k = norm(name)
    cands = set(by_norm.get(k, ()))  # same name once honorifics/punctuation are ignored
    if not cands:
      for nif in old_nifs.get(name, ()):
        for v in new_by_nif.get(nif, ()):
          vk = norm(v)
          if min(len(vk), len(k)) >= 6 and (vk.startswith(k) or k.startswith(vk)):
            cands.add(v)
      cands = {c for c in cands if c in new_indexable} or cands
    if len(cands) == 1:
      mapping[name] = cands.pop()
      stats["redirected"] += 1
    else:
      stats["ambiguous" if cands else "gone"] += 1

  previous = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
  merged = {**previous, **mapping}
  # Collapse chains A->B->C and drop entries whose final target no longer exists.
  final = {}
  for src in merged:
    dst, seen = merged[src], {src}
    while dst in merged and dst not in seen:
      seen.add(dst)
      dst = merged[dst]
    if dst in new_people and dst != src:
      final[src] = dst
  OUT.parent.mkdir(parents=True, exist_ok=True)
  OUT.write_text(json.dumps(dict(sorted(final.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
  print(dict(stats), f"-> {len(final):,} redirects in {OUT}")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
