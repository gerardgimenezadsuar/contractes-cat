#!/usr/bin/env python3
"""Re-parse every cached BORME PDF text with the current parser.

Reads  borme-dataset/data/borme_cache/pdf_text/YYYYMMDD_BORME-A-YYYY-N-PP.txt
Writes borme-dataset/data/v2/bulk_YYYY/relations_YYYY.csv
       borme-dataset/data/v2/bulk_YYYY/company_events_YYYY.csv

No network access: the cache already holds every PDF since 2009 (the daily
updater keeps adding to it). Feed the output to borme_build_spans.py --input v2.

Usage:
  python3 scripts/borme_reparse_cache.py [--from 2009] [--to 2026] [--workers 8]
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import borme_bulk_extract as bx  # noqa: E402

DATA_DIR = SCRIPT_DIR.parent / "borme-dataset" / "data"
CACHE_DIR = DATA_DIR / "borme_cache" / "pdf_text"
OUT_DIR = DATA_DIR / "v2"
PROVINCE_BY_CODE = {"08": "BARCELONA", "17": "GIRONA", "25": "LLEIDA", "43": "TARRAGONA"}
NAME_RE = re.compile(r"^(\d{8})_(BORME-A-(\d{4})-\d+-(\d{2}))\.txt$")

RELATION_FIELDS = [
  "borme_date", "borme_item_id", "province", "company_name_borme", "company_hoja", "relation_type", "owner_name",
  "event_type", "role_title_raw", "role_title_code", "has_constitucion", "constitution_date",
  "start_operations_raw", "start_operations_yyyymmdd", "datos_registrales_raw", "registry_tomo",
  "registry_folio", "registry_hoja", "registry_inscripcion", "registry_date_yyyymmdd",
  "company_tax_id_candidates", "owner_tax_id_candidates", "source_pdf_url",
]


def item_for(path: Path) -> bx.SectionItem | None:
  m = NAME_RE.match(path.name)
  if not m or m.group(4) not in PROVINCE_BY_CODE:
    return None
  date, item_id = m.group(1), m.group(2)
  url = f"https://www.boe.es/borme/dias/{date[:4]}/{date[4:6]}/{date[6:]}/pdfs/{item_id}.pdf"
  return bx.SectionItem(date_yyyymmdd=date, item_id=item_id, province_title=PROVINCE_BY_CODE[m.group(4)], pdf_url=url)


def work(path_str: str):
  path = Path(path_str)
  item = item_for(path)
  if item is None:
    return None, [], []
  rows, events, _ = bx.rows_from_text(path.read_text(encoding="utf-8"), item)
  return item.date_yyyymmdd[:4], rows, events


def main() -> int:
  ap = argparse.ArgumentParser()
  ap.add_argument("--from", dest="year_from", type=int, default=2009)
  ap.add_argument("--to", dest="year_to", type=int, default=2100)
  ap.add_argument("--workers", type=int, default=8)
  args = ap.parse_args()

  files = sorted(
    str(p) for p in CACHE_DIR.glob("*_BORME-A-*.txt")
    if args.year_from <= int(p.name[:4]) <= args.year_to
  )
  print(f"[INFO] {len(files):,} cached PDFs", flush=True)
  by_year_rows: dict[str, list[dict]] = defaultdict(list)
  by_year_events: dict[str, list[dict]] = defaultdict(list)
  with ProcessPoolExecutor(max_workers=args.workers) as ex:
    for i, (year, rows, events) in enumerate(ex.map(work, files, chunksize=25), start=1):
      if year:
        by_year_rows[year].extend(rows)
        by_year_events[year].extend(events)
      if i % 2000 == 0:
        print(f"[INFO] {i:,}/{len(files):,}", flush=True)

  for year in sorted(by_year_rows):
    out = OUT_DIR / f"bulk_{year}"
    out.mkdir(parents=True, exist_ok=True)
    rows = sorted(by_year_rows[year], key=lambda r: (r["borme_date"], r["borme_item_id"]))
    events = sorted(by_year_events[year], key=lambda r: (r["borme_date"], r["borme_item_id"], r["entry_number"], r["act_seq"]))
    bx.write_csv(out / f"relations_{year}.csv", rows, RELATION_FIELDS)
    bx.write_csv(out / f"company_events_{year}.csv", events, bx.COMPANY_EVENT_FIELDS)
    print(f"[INFO] {year}: {len(rows):,} relations, {len(events):,} company events", flush=True)
  return 0


if __name__ == "__main__":
  sys.exit(main())
