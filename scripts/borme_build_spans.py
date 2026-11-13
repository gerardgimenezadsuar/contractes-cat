#!/usr/bin/env python3
"""
Build structured database tables from the raw BORME event log.

Input : borme-dataset/data/<input>/bulk_*/relations_*.csv
        (default input "v2" = output of borme_reparse_cache.py)
Output:
  borme-dataset/data/db/companies.csv
  borme-dataset/data/db/admin_spans.csv

Company identity
----------------
A company is (province, registry sheet "hoja", e.g. "B-642774"). The sheet
survives renames, so a company keeps its history and its NIF match when it
changes name. The latest name is the company name; earlier names are kept in
`aliases`. Rows without a sheet (very rare) fall back to (province, name).

Span reconstruction (event-driven, per filing, in date order)
-------------------------------------------------------------
  - NOMBRAMIENTO / REELECCION open a span (unless an identical one is open)
  - CESE_DIMISION / REVOCACION / CANCELACION_OFICIO close the most plausible
    matching open span
  - MENCION opens only if no matching span is open; a new sole shareholder
    (SOCIO_UNICO / ACCIONISTA_UNICO) closes the previous owner's open span
  - company acts ("_COMPANY" rows):
      EXTINCION               closes every open span of the company
      PERDIDA_UNIPERSONALIDAD closes the open sole-shareholder span
"""

from __future__ import annotations

import argparse
import csv
import glob
from collections import Counter, defaultdict
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "borme-dataset" / "data"
OUTPUT_DIR = DATA_DIR / "db"

ROLES_TO_INCLUDE = {
    "ADMINISTRADOR", "APODERADO", "SOCIO_UNICO",
    "ORGANO_GOBIERNO", "LIQUIDADOR",
}
OWNER_ROLES = {"SOCIO_UNICO"}
CLOSING_EVENTS = {"CESE_DIMISION", "REVOCACION", "CANCELACION_OFICIO"}
EVENT_ORDER = {
    "CESE_DIMISION": 0, "REVOCACION": 0, "CANCELACION_OFICIO": 0,
    "NOMBRAMIENTO": 1, "REELECCION": 1,
    "MENCION": 2,
    "PERDIDA_UNIPERSONALIDAD": 8, "EXTINCION": 9,
}


def company_key(row: dict) -> str:
    province = row["province"].strip()
    hoja = (row.get("company_hoja") or "").strip()
    if hoja:
        return f"{province}||H:{hoja}"
    return f"{province}||N:{row['company_name_borme'].strip()}"


# ---------------------------------------------------------------------------
# Step 1: Load events grouped by (company, filing)
# ---------------------------------------------------------------------------
def load_events(input_csvs: list[str], until: str = "") -> tuple[dict, dict]:
    """
    Returns ({company_key: {borme_item_id: [events]}}, {company_key: [(date, name)]})
    """
    data: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    names: dict[str, list[tuple[str, str]]] = defaultdict(list)
    total = 0

    for csv_path in input_csvs:
        with open(csv_path, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if until and row["borme_date"] > until:
                    continue
                rel = row["relation_type"]
                company = row["company_name_borme"].strip()
                if not company:
                    continue
                key = company_key(row)
                date = row["borme_date"].strip()
                names[key].append((date, company))
                if rel == "_COMPANY":
                    owner = ""
                elif rel in ROLES_TO_INCLUDE:
                    owner = row["owner_name"].strip()
                    if not owner:
                        continue
                else:
                    continue
                data[key][row["borme_item_id"].strip()].append({
                    "borme_date": date,
                    "event_type": (row.get("event_type") or "").strip().upper() or "MENCION",
                    "relation_type": rel,
                    "role_title_raw": (row.get("role_title_raw") or "").strip(),
                    "role_title_code": (row.get("role_title_code") or "").strip(),
                    "person_name": owner,
                    "source_pdf_url": row["source_pdf_url"].strip(),
                })
                total += 1

    # Companies whose filings never name a person (e.g. only a change of
    # domicile) still exist: register them from the company-event log.
    for ev_path in sorted({str(Path(p).parent) for p in input_csvs}):
        for csv_path in sorted(glob.glob(f"{ev_path}/company_events_*.csv")):
            with open(csv_path, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    company = row["company_name_borme"].strip()
                    if company and not (until and row["borme_date"] > until):
                        names[company_key(row)].append((row["borme_date"].strip(), company))

    print(f"  Loaded {total:,} events for {len(data):,} companies ({len(names):,} companies in total)", flush=True)
    return data, names


# ---------------------------------------------------------------------------
# Shared replay rule (also used by borme_incremental_update.py)
# ---------------------------------------------------------------------------
def apply_filing(active: dict, events: list[dict], date: str, item_id: str, close, open_span, stats: Counter | None = None) -> bool:
    """Apply one filing's events to a company's open spans.

    active: {(person, relation_type): [open span dicts with role_title_code, date_start]}
    close(span, date, item_id, pdf, reason) ends a span; open_span(event, date, item_id)
    returns a new span dict. Returns True when the filing extinguishes the company.
    """
    stats = stats if stats is not None else Counter()
    extinct = False
    for event in sorted(events, key=lambda e: EVENT_ORDER.get(e["event_type"], 3)):
        pdf = event["source_pdf_url"]
        event_type = event["event_type"]

        if event["relation_type"] == "_COMPANY":
            if event_type == "EXTINCION":
                for open_list in active.values():
                    for s in open_list:
                        close(s, date, item_id, pdf, "EXTINCION")
                        stats["closed_by_extincion"] += 1
                active.clear()
                extinct = True
            elif event_type == "PERDIDA_UNIPERSONALIDAD":
                for k in [k for k in active if k[1] in OWNER_ROLES]:
                    for s in active.pop(k):
                        close(s, date, item_id, pdf, "PERDIDA_UNIPERSONALIDAD")
                        stats["closed_by_perdida_unipersonalidad"] += 1
            continue

        person = event["person_name"]
        role = event["relation_type"]
        code = event["role_title_code"]
        base_key = (person, role)
        open_list = active.get(base_key, [])

        if event_type in CLOSING_EVENTS:
            if not open_list:
                continue
            idx = None
            if code:
                for i, s in enumerate(open_list):
                    if s.get("role_title_code") == code:
                        idx = i
                        break
            if idx is None:
                idx = max(range(len(open_list)), key=lambda i: open_list[i]["date_start"])
            close(open_list.pop(idx), date, item_id, pdf, event_type)
            if event_type == "CANCELACION_OFICIO":
                stats["closed_by_cancelacion_oficio"] += 1
            if not open_list:
                active.pop(base_key, None)
            continue

        if any(s.get("role_title_code") == code for s in open_list):
            continue

        # A new sole shareholder replaces the previous one.
        if role in OWNER_ROLES:
            for k in [k for k in active if k[1] in OWNER_ROLES and k[0] != person]:
                for s in active.pop(k):
                    close(s, date, item_id, pdf, "NUEVO_SOCIO_UNICO")
                    stats["closed_by_new_owner"] += 1

        active.setdefault(base_key, []).append(open_span(event, date, item_id))
    return extinct


# ---------------------------------------------------------------------------
# Step 2: Compute admin spans per company
# ---------------------------------------------------------------------------
def compute_spans(data: dict, names: dict) -> tuple[list[dict], list[dict], Counter]:
    companies: list[dict] = []
    spans: list[dict] = []
    stats: Counter = Counter()
    span_id = 0

    for key in names:
        filings = data.get(key, {})
        province, ident = key.split("||", 1)
        hoja = ident[2:] if ident.startswith("H:") else ""
        dated_names = sorted(names[key])
        company_name = dated_names[-1][1]
        aliases = []
        for _, n in dated_names:
            if n != company_name and n not in aliases:
                aliases.append(n)

        sorted_filings = sorted(filings.items(), key=lambda kv: (kv[1][0]["borme_date"], kv[0]))
        extinct_on = None

        companies.append({
            "company_name": company_name,
            "province": province,
            "hoja": hoja,
            "aliases": "|".join(aliases),
            "first_seen": dated_names[0][0],
            "last_seen": dated_names[-1][0],
            "num_filings": len({d for d, _ in dated_names}),
        })

        active: dict[tuple[str, str], list[dict]] = defaultdict(list)

        def close(span: dict, date: str, item_id: str, pdf: str, reason: str) -> None:
            span["date_end"] = date
            span["item_id_end"] = item_id
            span["source_pdf_end"] = pdf
            span["end_reason"] = reason
            spans.append(span)

        def open_span(event: dict, date: str, item_id: str) -> dict:
            nonlocal span_id
            span_id += 1
            return {
                "id": span_id,
                "company_key": key,
                "company_name": company_name,
                "province": province,
                "hoja": hoja,
                "person_name": event["person_name"],
                "relation_type": event["relation_type"],
                "role_title_raw": event["role_title_raw"],
                "role_title_code": event["role_title_code"],
                "date_start": date,
                "date_end": None,
                "item_id_start": item_id,
                "item_id_end": None,
                "source_pdf_start": event["source_pdf_url"],
                "source_pdf_end": None,
                "end_reason": None,
            }

        for item_id, events in sorted_filings:
            date = events[0]["borme_date"]
            if apply_filing(active, events, date, item_id, close, open_span, stats):
                extinct_on = date

        companies[-1]["extinct_on"] = extinct_on or ""
        for open_list in active.values():
            spans.extend(open_list)

    return companies, spans, stats


# ---------------------------------------------------------------------------
# Step 3: Write CSVs
# ---------------------------------------------------------------------------
def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Wrote {len(rows):,} rows → {path}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="v2", help="data subdir holding bulk_*/relations_*.csv (default v2)")
    ap.add_argument("--output", default=str(OUTPUT_DIR))
    ap.add_argument("--until", default="", help="YYYYMMDD: ignore filings after this date (replay tests)")
    args = ap.parse_args()

    input_csvs = sorted(glob.glob(str(DATA_DIR / args.input / "bulk_*" / "relations_*.csv")))
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[1/3] Loading events from {len(input_csvs)} CSVs under {args.input}/ …", flush=True)
    data, names = load_events(input_csvs, args.until)

    print("[2/3] Computing admin spans …", flush=True)
    companies, spans, stats = compute_spans(data, names)
    open_spans = sum(1 for s in spans if s["date_end"] is None)
    print(f"  {len(companies):,} companies ({sum(1 for c in companies if c['aliases']):,} with former names, "
          f"{sum(1 for c in companies if c['extinct_on']):,} extinct)", flush=True)
    print(f"  {len(spans):,} spans ({open_spans:,} open / {len(spans) - open_spans:,} closed)", flush=True)
    for k, v in sorted(stats.items()):
        print(f"    {k}: {v:,}")

    spans.sort(key=lambda s: (s["company_key"], s["relation_type"], s["person_name"], s.get("role_title_code", ""), s["date_start"]))
    companies.sort(key=lambda c: (c["province"], c["hoja"], c["company_name"]))

    print("[3/3] Writing CSVs …", flush=True)
    write_csv(out_dir / "companies.csv", companies,
              ["company_name", "province", "hoja", "aliases", "first_seen", "last_seen", "num_filings", "extinct_on"])
    write_csv(out_dir / "admin_spans.csv", spans, [
        "id", "company_name", "province", "hoja", "person_name", "relation_type",
        "role_title_raw", "role_title_code", "date_start", "date_end",
        "item_id_start", "item_id_end", "source_pdf_start", "source_pdf_end", "end_reason",
    ])

    print("\n=== SUMMARY ===")
    for role, cnt in Counter(s["relation_type"] for s in spans).most_common():
        active_cnt = sum(1 for s in spans if s["relation_type"] == role and s["date_end"] is None)
        print(f"  {role:<20} {cnt:>8,} spans  ({active_cnt:,} currently open)")


if __name__ == "__main__":
    main()
