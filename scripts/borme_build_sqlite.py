#!/usr/bin/env python3
"""
Build a SQLite database from BORME admin spans + NIF bridge.

Steps:
  1. Read db/companies.csv + db/admin_spans.csv
  2. Fetch all (NIF, name) pairs from Socrata and match BORME company names
  3. Build SQLite DB with companies + admin_spans tables (nif column on companies)
  4. Export per-NIF JSON files to public/borme/ for Next.js static serving

Usage:
    cd borme-dataset
    python3 ../scripts/borme_build_sqlite.py
"""

from __future__ import annotations

import csv
import json
import re
import sqlite3
import unicodedata
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DATA_DIR    = Path(__file__).parent.parent / "borme-dataset" / "data"
DB_DIR      = DATA_DIR / "db"
COMPANIES_CSV   = DB_DIR / "companies.csv"
ADMIN_SPANS_CSV = DB_DIR / "admin_spans.csv"
SQLITE_PATH = DB_DIR / "admin.sqlite"
PUBLIC_DIR  = Path(__file__).parent.parent / "public" / "borme"

SOCRATA_URL = "https://analisi.transparenciacatalunya.cat/resource/ybgg-dgi6.json"
TIMEOUT = 60
PERSON_RELATIONS = (
    "ADMINISTRADOR",
    "APODERADO",
    "ORGANO_GOBIERNO",
    "LIQUIDADOR",
    "SOCIO_UNICO",
    "SOCIO",
    "ACCIONISTA_UNICO",
)


# ---------------------------------------------------------------------------
# Name normalisation
# ---------------------------------------------------------------------------
def _strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


# Remove dots between/after single uppercase letters: S.L. → SL, S.A.U. → SAU
# Matches a dot preceded by an uppercase letter and followed by an uppercase letter,
# space, comma, or end of string.
_LETTER_DOT = re.compile(r"(?<=[A-Z])\.(?=[A-Z\s,$]|$)")

# Legal entity type suffixes to strip from the END of a name.
# Applied after accent-stripping, uppercasing, and dot-removal.
# Order matters: longest/most-specific patterns must come first.
_ENTITY_SUFFIX = re.compile(
    r"[\s,]+(?:"
    r"SOCIEDAD\s+LIMITADA\s+(?:UNIPERSONAL|PROFESIONAL|LABORAL)"
    r"|SOCIEDAD\s+ANONIMA\s+(?:UNIPERSONAL|PROFESIONAL|LABORAL)"
    r"|SOCIEDAD\s+(?:COOPERATIVA|LIMITADA|ANONIMA|CIVIL)"
    r"|SOCIETAT\s+(?:LIMITADA|ANONIMA|COOPERATIVA)"
    r"|COMUNIDAD\s+DE\s+BIENES"
    r"|AGRUPACION\s+DE\s+INTERES\s+ECONOMICO"
    r"|SLU|SAU|SLP|SAP|SLL|SAL|SRL|SCCL|AIE"
    r"|SL|SA|SC|CB"
    r")\s*$",
    re.IGNORECASE,
)


def normalize_name(name: str) -> str:
    """
    Canonical name for matching:
      1. Strip accents, uppercase
      2. Remove dots between/after isolated uppercase letters (S.L. → SL)
      3. Strip legal entity type suffix from the end
      4. Remove all remaining punctuation and spaces
    """
    n = _strip_accents(name).upper()
    n = _LETTER_DOT.sub("", n)
    n = _ENTITY_SUFFIX.sub("", n).strip()
    return re.sub(r"[.,\-/\s]", "", n)


def normalize_person_name(name: str) -> str:
    """
    Canonical person string for fast token search:
      - strip accents
      - uppercase
      - keep only A-Z0-9 as token chars
      - collapse all separators to single spaces
    """
    n = _strip_accents(name).upper()
    n = re.sub(r"[^A-Z0-9]+", " ", n)
    return re.sub(r"\s+", " ", n).strip()


# ---------------------------------------------------------------------------
# Step 1: Fetch Socrata company index  (NIF + name)
# ---------------------------------------------------------------------------
def fetch_socrata_companies() -> list[dict]:
    """Return all unique (nif, name) pairs from Socrata, paginated."""
    rows: list[dict] = []
    limit  = 50_000
    offset = 0
    while True:
        params = {
            "$select": "identificacio_adjudicatari, denominacio_adjudicatari, count(*) as num_contracts",
            "$where": (
                "denominacio_adjudicatari IS NOT NULL "
                "AND identificacio_adjudicatari IS NOT NULL"
            ),
            "$group":  "identificacio_adjudicatari, denominacio_adjudicatari",
            "$order":  "num_contracts desc",
            "$limit":  str(limit),
            "$offset": str(offset),
        }
        resp = requests.get(SOCRATA_URL, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        chunk = resp.json()
        if not chunk:
            break
        rows.extend(chunk)
        print(f"  fetched {len(rows):,} Socrata rows …", flush=True)
        if len(chunk) < limit:
            break
        offset += limit
    return rows


def build_socrata_index(socrata_rows: list[dict]) -> tuple[dict[str, dict], dict[str, dict]]:
    """
    Returns (exact_index, normalized_index).
    exact_index:      upper(name) → best row
    normalized_index: normalize_name(name) → best row
    """
    exact: dict[str, dict]      = {}
    normalized: dict[str, dict] = {}

    for row in socrata_rows:
        name = str(row.get("denominacio_adjudicatari", "")).strip()
        nif  = str(row.get("identificacio_adjudicatari", "")).strip()
        if not name or not nif:
            continue
        contracts = int(row.get("num_contracts", "0") or "0")
        candidate = {"nif": nif, "name": name, "contracts": contracts}

        up = name.upper()
        if up not in exact or contracts > exact[up]["contracts"]:
            exact[up] = candidate

        norm = normalize_name(name)
        if norm and (norm not in normalized or contracts > normalized[norm]["contracts"]):
            normalized[norm] = candidate

    return exact, normalized


# ---------------------------------------------------------------------------
# Step 2: Match BORME company rows
# ---------------------------------------------------------------------------
def match_company(borme_name: str, exact: dict, normalized: dict) -> dict | None:
    if not borme_name:
        return None
    hit = exact.get(borme_name.upper())
    if hit:
        return {**hit, "match_type": "exact"}
    norm = normalize_name(borme_name)
    hit = normalized.get(norm)
    if hit:
        return {**hit, "match_type": "normalized"}
    return None


# ---------------------------------------------------------------------------
# Step 3: Build SQLite
# ---------------------------------------------------------------------------
def build_sqlite(
    companies: list[dict],
    spans: list[dict],
    nif_map: dict[str, dict],
) -> None:
    SQLITE_PATH.unlink(missing_ok=True)
    con = sqlite3.connect(SQLITE_PATH)
    cur = con.cursor()

    cur.executescript("""
        CREATE TABLE companies (
            id              INTEGER PRIMARY KEY,
            company_name    TEXT NOT NULL,
            province        TEXT NOT NULL,
            nif             TEXT,
            match_type      TEXT,
            matched_name    TEXT,
            first_seen      TEXT,
            last_seen       TEXT,
            num_filings     INTEGER
        );
        CREATE INDEX idx_companies_nif  ON companies(nif);
        CREATE INDEX idx_companies_name ON companies(company_name);

        CREATE TABLE admin_spans (
            id              INTEGER PRIMARY KEY,
            company_id      INTEGER NOT NULL REFERENCES companies(id),
            person_name     TEXT NOT NULL,
            relation_type   TEXT NOT NULL,
            role_title_raw  TEXT,
            role_title_code TEXT,
            date_start      TEXT NOT NULL,
            date_end        TEXT,
            item_id_start   TEXT,
            item_id_end     TEXT,
            source_pdf_start TEXT,
            source_pdf_end   TEXT
        );
        CREATE INDEX idx_spans_company ON admin_spans(company_id);
        CREATE INDEX idx_spans_person_name ON admin_spans(person_name);
        CREATE INDEX idx_spans_person_company ON admin_spans(person_name, company_id);
        CREATE INDEX idx_spans_person_active ON admin_spans(person_name, date_end);

        CREATE TABLE person_summary (
            person_name              TEXT PRIMARY KEY,
            person_name_norm         TEXT NOT NULL,
            num_companies            INTEGER NOT NULL,
            num_companies_with_nif   INTEGER NOT NULL,
            active_spans             INTEGER NOT NULL,
            total_spans              INTEGER NOT NULL
        );
        CREATE INDEX idx_person_summary_name ON person_summary(person_name);
        CREATE INDEX idx_person_summary_name_norm ON person_summary(person_name_norm);
        CREATE VIRTUAL TABLE person_summary_fts USING fts5(
            person_name,
            person_name_norm,
            tokenize='unicode61 remove_diacritics 2'
        );
    """)

    # Insert companies
    comp_key_to_id: dict[str, int] = {}
    for row in companies:
        name     = row["company_name"]
        province = row["province"]
        key      = f"{province}||{name}"
        match    = nif_map.get(key)
        cur.execute(
            """INSERT INTO companies
               (company_name, province, nif, match_type, matched_name, first_seen, last_seen, num_filings)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                name,
                province,
                match["nif"]       if match else None,
                match["match_type"] if match else None,
                match["name"]      if match else None,
                row.get("first_seen"),
                row.get("last_seen"),
                int(row.get("num_filings", 0) or 0),
            ),
        )
        comp_key_to_id[key] = cur.lastrowid  # type: ignore[assignment]

    # Insert spans
    for span in spans:
        key  = f"{span['province']}||{span['company_name']}"
        comp_id = comp_key_to_id.get(key)
        if comp_id is None:
            continue
        cur.execute(
            """INSERT INTO admin_spans
               (id, company_id, person_name, relation_type, role_title_raw, role_title_code,
                date_start, date_end,
                item_id_start, item_id_end, source_pdf_start, source_pdf_end)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                int(span["id"]),
                comp_id,
                span["person_name"],
                span["relation_type"],
                span.get("role_title_raw") or None,
                span.get("role_title_code") or None,
                span["date_start"],
                span["date_end"] or None,
                span.get("item_id_start") or None,
                span.get("item_id_end")   or None,
                span.get("source_pdf_start") or None,
                span.get("source_pdf_end")   or None,
            ),
        )

    # Build person search summary (one row per person).
    placeholders = ",".join("?" for _ in PERSON_RELATIONS)
    summary_rows = cur.execute(
        f"""
        SELECT s.person_name,
               count(DISTINCT s.company_id) AS num_companies,
               count(DISTINCT CASE WHEN c.nif IS NOT NULL AND c.nif <> '' THEN s.company_id END) AS num_companies_with_nif,
               sum(CASE WHEN s.date_end IS NULL THEN 1 ELSE 0 END) AS active_spans,
               count(*) AS total_spans
        FROM admin_spans s
        JOIN companies c ON c.id = s.company_id
        WHERE s.relation_type IN ({placeholders})
        GROUP BY s.person_name
        """,
        PERSON_RELATIONS,
    ).fetchall()

    cur.executemany(
        """
        INSERT INTO person_summary
          (person_name, person_name_norm, num_companies, num_companies_with_nif, active_spans, total_spans)
        VALUES (?,?,?,?,?,?)
        """,
        [
            (
                str(row[0]),
                normalize_person_name(str(row[0])),
                int(row[1] or 0),
                int(row[2] or 0),
                int(row[3] or 0),
                int(row[4] or 0),
            )
            for row in summary_rows
        ],
    )
    print(f"  Built person_summary with {len(summary_rows):,} rows", flush=True)
    cur.execute(
        """
        INSERT INTO person_summary_fts(person_name, person_name_norm)
        SELECT person_name, person_name_norm FROM person_summary
        """
    )
    print("  Built person_summary_fts", flush=True)

    con.commit()
    con.close()
    size_mb = SQLITE_PATH.stat().st_size / 1_048_576
    print(f"  SQLite written → {SQLITE_PATH}  ({size_mb:.1f} MB)", flush=True)


# ---------------------------------------------------------------------------
# Step 4: Export per-NIF JSON for Next.js static serving
# ---------------------------------------------------------------------------
def export_json(nif_map: dict[str, dict], companies: list[dict], spans: list[dict]) -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    # Build (province||name) → nif
    key_to_nif: dict[str, str] = {
        f"{v['province']}||{v['name_borme']}": k_nif
        for k_nif, v in nif_map_by_nif.items()  # noqa: F821 — built below
    }
    # Actually build nif_map_by_nif here
    nif_to_company: dict[str, dict] = {}
    for comp_key, match in nif_map.items():
        nif = match["nif"]
        if nif not in nif_to_company:
            nif_to_company[nif] = {
                "nif":          nif,
                "matched_name": match["name"],
                "company_keys": [],
            }
        nif_to_company[nif]["company_keys"].append(comp_key)

    # Build company_key → spans lookup
    key_to_spans: dict[str, list[dict]] = {}
    for span in spans:
        key = f"{span['province']}||{span['company_name']}"
        key_to_spans.setdefault(key, []).append(span)

    exported = 0
    for nif, info in nif_to_company.items():
        all_spans: list[dict] = []
        for comp_key in info["company_keys"]:
            for s in key_to_spans.get(comp_key, []):
                all_spans.append({
                    "person_name":    s["person_name"],
                    "relation_type":  s["relation_type"],
                    "role_title_raw": s.get("role_title_raw") or None,
                    "role_title_code": s.get("role_title_code") or None,
                    "date_start":     s["date_start"],
                    "date_end":       s["date_end"] or None,
                    "source_pdf":     s.get("source_pdf_start") or None,
                })

        if not all_spans:
            continue

        # Sort: open spans first, then by date_start
        all_spans.sort(key=lambda s: (
            s["date_end"] is not None,
            s["date_start"],
            s["relation_type"],
            s["person_name"],
        ))

        out = {
            "nif":          nif,
            "matched_name": info["matched_name"],
            "spans":        all_spans,
        }
        nif_safe = re.sub(r"[^A-Za-z0-9]", "_", nif)
        (PUBLIC_DIR / f"{nif_safe}.json").write_text(
            json.dumps(out, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        exported += 1

    print(f"  Exported {exported:,} per-NIF JSON files → {PUBLIC_DIR}/", flush=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    print("[1/5] Loading companies.csv …", flush=True)
    with COMPANIES_CSV.open(encoding="utf-8") as f:
        companies = list(csv.DictReader(f))
    print(f"  {len(companies):,} companies", flush=True)

    print("[2/5] Loading admin_spans.csv …", flush=True)
    with ADMIN_SPANS_CSV.open(encoding="utf-8") as f:
        spans = list(csv.DictReader(f))
    print(f"  {len(spans):,} spans", flush=True)

    print("[3/5] Fetching Socrata company index …", flush=True)
    socrata_rows = fetch_socrata_companies()
    print(f"  {len(socrata_rows):,} Socrata rows", flush=True)
    exact_idx, norm_idx = build_socrata_index(socrata_rows)
    print(f"  {len(exact_idx):,} exact keys, {len(norm_idx):,} normalized keys", flush=True)

    print("[4/5] Matching BORME companies to NIFs …", flush=True)
    nif_map: dict[str, dict] = {}   # (province||name) → match dict
    exact_count = norm_count = 0
    for row in companies:
        key   = f"{row['province']}||{row['company_name']}"
        match = match_company(row["company_name"], exact_idx, norm_idx)
        if match:
            nif_map[key] = match
            if match["match_type"] == "exact":
                exact_count += 1
            else:
                norm_count += 1

    print(
        f"  {len(nif_map):,} matched  "
        f"({exact_count:,} exact + {norm_count:,} normalized)  "
        f"out of {len(companies):,} companies",
        flush=True,
    )

    print("[5/5a] Building SQLite …", flush=True)
    build_sqlite(companies, spans, nif_map)

    print("[5/5b] Exporting per-NIF JSON …", flush=True)

    # Build nif_to_company (needed by export_json's inner logic — inline it here)
    nif_to_company: dict[str, dict] = {}
    for comp_key, match in nif_map.items():
        nif = match["nif"]
        if nif not in nif_to_company:
            nif_to_company[nif] = {
                "nif":          nif,
                "matched_name": match["name"],
                "company_keys": [],
            }
        nif_to_company[nif]["company_keys"].append(comp_key)

    key_to_spans: dict[str, list[dict]] = {}
    for span in spans:
        key = f"{span['province']}||{span['company_name']}"
        key_to_spans.setdefault(key, []).append(span)

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    exported = 0
    for nif, info in nif_to_company.items():
        all_spans: list[dict] = []
        for comp_key in info["company_keys"]:
            for s in key_to_spans.get(comp_key, []):
                all_spans.append({
                    "person_name":   s["person_name"],
                    "relation_type": s["relation_type"],
                    "role_title_raw": s.get("role_title_raw") or None,
                    "role_title_code": s.get("role_title_code") or None,
                    "date_start":    s["date_start"],
                    "date_end":      s["date_end"] or None,
                    "source_pdf":    s.get("source_pdf_start") or None,
                })

        if not all_spans:
            continue

        all_spans.sort(key=lambda s: (
            s["date_end"] is not None,
            s["date_start"],
            s["relation_type"],
            s["person_name"],
        ))

        out = {
            "nif":          nif,
            "matched_name": info["matched_name"],
            "spans":        all_spans,
        }
        nif_safe = re.sub(r"[^A-Za-z0-9]", "_", nif)
        (PUBLIC_DIR / f"{nif_safe}.json").write_text(
            json.dumps(out, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        exported += 1

    print(f"  Exported {exported:,} per-NIF JSON files → {PUBLIC_DIR}/", flush=True)

    print()
    print("=== DONE ===")
    print(f"  SQLite:  {SQLITE_PATH}")
    print(f"  JSON:    {PUBLIC_DIR}/<NIF>.json")
    print()
    print("Next.js usage:")
    print("  fetch(`/borme/${nif.replace(/[^A-Za-z0-9]/g, '_')}.json`)")


if __name__ == "__main__":
    main()
