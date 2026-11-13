#!/usr/bin/env python3
"""
Build a SQLite database from BORME admin spans + NIF bridge.

Steps:
  1. Read <db-dir>/companies.csv + admin_spans.csv (from borme_build_spans.py)
  2. Read company events (from borme_reparse_cache.py)
  3. Fetch all (NIF, name) pairs from Socrata and match BORME companies by their
     current name, then by former names
  4. Build SQLite: companies, admin_spans, company_events, company_profile,
     person_summary (+ FTS)

Usage:
    python3 scripts/borme_build_sqlite.py --db-dir borme-dataset/data/v2/db
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
import unicodedata
from pathlib import Path

import requests

import sys as _sys
_sys.path.insert(0, str(Path(__file__).resolve().parent))
import borme_parser as bp  # noqa: E402

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DATA_DIR    = Path(__file__).parent.parent / "borme-dataset" / "data"
DB_DIR      = DATA_DIR / "db"

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
    # "SMITH & NEPHEW" = "SMITH AND NEPHEW" = "SMITH Y NEPHEW" (also Catalan "I").
    n = re.sub(r"\s*&\s*|\s+(?:AND|Y|I|E)\s+", " ", n)
    return re.sub(r"[.,\-/\s&']", "", n)


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
            # Must be a unique, stable order: ordering by count has ties, and
            # offset paging over ties silently duplicates/drops thousands of rows.
            "$order":  "identificacio_adjudicatari, denominacio_adjudicatari",
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

        def better(new: dict, old: dict | None) -> bool:
            # A real NIF always beats a masked one ("*****4738*"); then more contracts wins.
            if old is None:
                return True
            new_masked, old_masked = "*" in new["nif"], "*" in old["nif"]
            if new_masked != old_masked:
                return old_masked
            return new["contracts"] > old["contracts"]

        up = name.upper()
        if better(candidate, exact.get(up)):
            exact[up] = candidate

        norm = normalize_name(name)
        if norm and better(candidate, normalized.get(norm)):
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
# Step 3: Company profile from company events
# ---------------------------------------------------------------------------
ROLE_ACT_CODES = {
    "NOMBRAMIENTOS", "REVOCACIONES", "CESES", "REELECCIONES", "CANCELACIONES_OFICIO", "MODIFICACION_PODERES",
}
STATUS_BY_ACT = {
    "EXTINCION": "EXTINGIDA",
    "DISOLUCION": "EN_LIQUIDACION",
    "CIERRE_HOJA_BAJA_IAE": "HOJA_CERRADA",
    "CIERRE_HOJA_NIF": "HOJA_CERRADA",
    "CIERRE_HOJA_OTRO": "HOJA_CERRADA",
    "REAPERTURA_HOJA": "ACTIVA",
    "REACTIVACION": "ACTIVA",
}


def company_key(province: str, hoja: str, name: str) -> str:
    return f"{province}||H:{hoja}" if hoja else f"{province}||N:{name}"


def build_profile(events: list[dict]) -> dict:
    """Fold a company's acts (sorted by date) into its current registry profile."""
    p: dict = {"status": "ACTIVA", "status_date": None}
    concurso_phase = None
    for ev in events:
        code = ev["act_code"]
        f = ev["fields"]
        date = ev["borme_date"]
        if code == "CONSTITUCION":
            p.setdefault("constitution_date", date)
            if f.get("start_operations"):
                p["start_operations"] = f["start_operations"]
        if code in ("CONSTITUCION", "CAMBIO_DOMICILIO") and f.get("address"):
            p["address"], p["municipality"], p["address_date"] = f["address"], f.get("municipality") or None, date
        if code == "CONSTITUCION" and f.get("capital") is not None:
            p["capital"], p["capital_date"] = f["capital"], date
        if code in ("AMPLIACION_CAPITAL", "REDUCCION_CAPITAL", "REDUCCION_Y_AMPLIACION_CAPITAL") and f.get("resulting_capital") is not None:
            p["capital"], p["capital_date"] = f["resulting_capital"], date
        obj = f.get("object") if isinstance(f.get("object"), dict) else None
        if code in ("CONSTITUCION", "CAMBIO_OBJETO", "AMPLIACION_OBJETO") and obj:
            p["object"] = (obj.get("text") or "")[:1000] or None
            if obj.get("cnae"):
                p["cnae"], p["cnae_label"] = obj["cnae"], obj.get("cnae_label")
        if code == "PAGINA_WEB" and f.get("url"):
            p["website"] = f["url"]
        if code == "SITUACION_CONCURSAL":
            phase = f.get("phase") or bp.concurso_resolution(f.get("text", ""))["phase"]
            if phase in ("OPEN", "LIQUIDATION") and concurso_phase not in ("OPEN", "LIQUIDATION"):
                p["concurso_since"] = date
            if phase != "NEUTRAL":
                concurso_phase = phase
            p["concurso_last_date"] = date
            p["concurso_kind"] = concurso_phase
            cal = f.get("calificacion") or bp.concurso_resolution(f.get("text", ""))["calificacion"]
            if cal:
                p["concurso_calificacion"] = cal
        if code in STATUS_BY_ACT:
            p["status"], p["status_date"] = STATUS_BY_ACT[code], date
            if code == "DISOLUCION" and re.search(r"FUSI|ABSORC|ESCISI", _strip_accents(f.get("reason", "")).upper()):
                p["status"] = "ABSORBIDA"
        if code in ("FUSION_ABSORCION", "ESCISION_TOTAL", "CESION_GLOBAL"):
            p["last_restructuring_date"] = date
    # Insolvency only becomes the status while the procedure is open; an
    # approved creditors' agreement ends its effects (shown as CONVENI), and a
    # concluded or fulfilled procedure leaves the status untouched.
    if p["status"] in ("ACTIVA", "EN_LIQUIDACION"):
        if concurso_phase in ("OPEN", "LIQUIDATION"):
            p["status"] = "EN_CONCURSO"
            p["status_date"] = p.get("concurso_since")
        elif concurso_phase == "AGREEMENT":
            p["status"] = "CONVENI"
            p["status_date"] = p.get("concurso_last_date")
    return p


PROFILE_COLUMNS = [
    "status", "status_date", "constitution_date", "start_operations", "address", "municipality", "address_date",
    "capital", "capital_date", "cnae", "cnae_label", "object", "website", "concurso_kind", "concurso_last_date",
    "last_restructuring_date", "concurso_since", "concurso_calificacion",
]


def load_company_events(events_dir: Path, until: str = "") -> dict[str, list[dict]]:
    by_key: dict[str, list[dict]] = {}
    files = sorted(events_dir.glob("bulk_*/company_events_*.csv"))
    n = 0
    for path in files:
        with path.open(encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row["act_code"] in ROLE_ACT_CODES or (until and row["borme_date"] > until):
                    continue
                key = company_key(row["province"], row.get("company_hoja", ""), row["company_name_borme"])
                by_key.setdefault(key, []).append({
                    "borme_date": row["borme_date"],
                    "act_code": row["act_code"],
                    "fields": json.loads(row["fields_json"] or "{}"),
                    "fields_json": row["fields_json"],
                    "source_pdf": row["source_pdf_url"],
                })
                n += 1
    for evs in by_key.values():
        evs.sort(key=lambda e: e["borme_date"])
    print(f"  {n:,} company-level events for {len(by_key):,} companies ({len(files)} files)", flush=True)
    return by_key


# ---------------------------------------------------------------------------
# Step 4: Build SQLite
# ---------------------------------------------------------------------------
def build_sqlite(
    sqlite_path: Path,
    companies: list[dict],
    spans: list[dict],
    nif_map: dict[str, dict],
    events_by_key: dict[str, list[dict]],
    extra_nifs: dict[str, list[dict]] | None = None,
) -> None:
    sqlite_path.unlink(missing_ok=True)
    con = sqlite3.connect(sqlite_path)
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
            num_filings     INTEGER,
            hoja            TEXT,
            aliases         TEXT,
            extinct_on      TEXT
        );
        CREATE INDEX idx_companies_nif  ON companies(nif);
        CREATE INDEX idx_companies_name ON companies(company_name);
        CREATE UNIQUE INDEX idx_companies_hoja ON companies(province, hoja) WHERE hoja IS NOT NULL;

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
            source_pdf_end   TEXT,
            end_reason      TEXT
        );
        CREATE INDEX idx_spans_company ON admin_spans(company_id);
        CREATE INDEX idx_spans_person_name ON admin_spans(person_name);
        CREATE INDEX idx_spans_person_company ON admin_spans(person_name, company_id);
        CREATE INDEX idx_spans_person_active ON admin_spans(person_name, date_end);

        -- Every NIF a company is known by in the contracts data: the one matched by
        -- its current name (companies.nif) plus those matched by former names
        -- (e.g. SAYTEL SERVICIOS INFORMATICOS SA -> SEIDOR SOLUTIONS SL).
        CREATE TABLE company_nifs (
            nif             TEXT NOT NULL,
            company_id      INTEGER NOT NULL REFERENCES companies(id),
            match_type      TEXT NOT NULL,
            matched_name    TEXT,
            PRIMARY KEY (nif, company_id)
        ) WITHOUT ROWID;
        CREATE INDEX idx_company_nifs_company ON company_nifs(company_id);

        CREATE TABLE company_events (
            id              INTEGER PRIMARY KEY,
            company_id      INTEGER NOT NULL REFERENCES companies(id),
            borme_date      TEXT NOT NULL,
            act_code        TEXT NOT NULL,
            fields_json     TEXT,
            source_pdf      TEXT
        );
        CREATE INDEX idx_company_events_company ON company_events(company_id, borme_date);

        CREATE TABLE company_profile (
            company_id      INTEGER PRIMARY KEY REFERENCES companies(id),
            status          TEXT NOT NULL,
            status_date     TEXT,
            constitution_date TEXT,
            start_operations TEXT,
            address         TEXT,
            municipality    TEXT,
            address_date    TEXT,
            capital         REAL,
            capital_date    TEXT,
            cnae            TEXT,
            cnae_label      TEXT,
            object          TEXT,
            website         TEXT,
            concurso_kind   TEXT,
            concurso_last_date TEXT,
            last_restructuring_date TEXT,
            concurso_since  TEXT,
            concurso_calificacion TEXT
        );
        CREATE INDEX idx_company_profile_municipality ON company_profile(municipality);

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

    comp_key_to_id: dict[str, int] = {}
    for row in companies:
        key = company_key(row["province"], row.get("hoja", ""), row["company_name"])
        match = nif_map.get(key)
        cur.execute(
            """INSERT INTO companies
               (company_name, province, nif, match_type, matched_name, first_seen, last_seen, num_filings,
                hoja, aliases, extinct_on)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                row["company_name"],
                row["province"],
                match["nif"] if match else None,
                match["match_type"] if match else None,
                match["name"] if match else None,
                row.get("first_seen"),
                row.get("last_seen"),
                int(row.get("num_filings", 0) or 0),
                row.get("hoja") or None,
                row.get("aliases") or None,
                row.get("extinct_on") or None,
            ),
        )
        comp_key_to_id[key] = cur.lastrowid  # type: ignore[assignment]
        nif_rows = ([match] if match else []) + (extra_nifs or {}).get(key, [])
        cur.executemany(
            "INSERT OR IGNORE INTO company_nifs (nif, company_id, match_type, matched_name) VALUES (?,?,?,?)",
            [(m["nif"], cur.lastrowid, m["match_type"], m.get("name")) for m in nif_rows],
        )

    span_rows = []
    for span in spans:
        comp_id = comp_key_to_id.get(company_key(span["province"], span.get("hoja", ""), span["company_name"]))
        if comp_id is None:
            continue
        span_rows.append((
            int(span["id"]), comp_id, span["person_name"], span["relation_type"],
            span.get("role_title_raw") or None, span.get("role_title_code") or None,
            span["date_start"], span["date_end"] or None,
            span.get("item_id_start") or None, span.get("item_id_end") or None,
            span.get("source_pdf_start") or None, span.get("source_pdf_end") or None,
            span.get("end_reason") or None,
        ))
    cur.executemany(
        """INSERT INTO admin_spans
           (id, company_id, person_name, relation_type, role_title_raw, role_title_code, date_start, date_end,
            item_id_start, item_id_end, source_pdf_start, source_pdf_end, end_reason)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        span_rows,
    )
    print(f"  {len(span_rows):,} spans inserted", flush=True)

    ev_rows = []
    profile_rows = []
    for key, evs in events_by_key.items():
        comp_id = comp_key_to_id.get(key)
        if comp_id is None:
            continue
        for ev in evs:
            ev_rows.append((comp_id, ev["borme_date"], ev["act_code"], ev["fields_json"], ev["source_pdf"]))
        prof = build_profile(evs)
        profile_rows.append((comp_id, *[prof.get(c) for c in PROFILE_COLUMNS]))
    cur.executemany(
        "INSERT INTO company_events (company_id, borme_date, act_code, fields_json, source_pdf) VALUES (?,?,?,?,?)",
        ev_rows,
    )
    cur.executemany(
        f"INSERT INTO company_profile (company_id, {', '.join(PROFILE_COLUMNS)}) VALUES ({','.join('?' * (len(PROFILE_COLUMNS) + 1))})",
        profile_rows,
    )
    print(f"  {len(ev_rows):,} company events, {len(profile_rows):,} company profiles", flush=True)

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
            (str(r[0]), normalize_person_name(str(r[0])), int(r[1] or 0), int(r[2] or 0), int(r[3] or 0), int(r[4] or 0))
            for r in summary_rows
        ],
    )
    print(f"  Built person_summary with {len(summary_rows):,} rows", flush=True)
    cur.execute(
        "INSERT INTO person_summary_fts(person_name, person_name_norm) SELECT person_name, person_name_norm FROM person_summary"
    )
    # Where borme_incremental_update.py resumes: the last BORME day in the data.
    last_day = max((c.get("last_seen") or "" for c in companies), default="")
    cur.execute("CREATE TABLE IF NOT EXISTS borme_meta (key TEXT PRIMARY KEY, value TEXT)")
    cur.execute("INSERT OR REPLACE INTO borme_meta (key, value) VALUES ('last_processed_date', ?)", (last_day,))
    print(f"  borme_meta.last_processed_date = {last_day}", flush=True)
    con.commit()
    con.close()
    size_mb = sqlite_path.stat().st_size / 1_048_576
    print(f"  SQLite written → {sqlite_path}  ({size_mb:.1f} MB)", flush=True)


def _words(name: str) -> list[str]:
    n = _ENTITY_SUFFIX.sub("", _LETTER_DOT.sub("", _strip_accents(name).upper())).strip()
    return [w for w in re.split(r"[^A-Z0-9]+", n) if len(w) >= 3]


def carry_over_nifs(
    previous_db: Path,
    companies: list[dict],
    nif_map: dict[str, dict],
    extra_nifs: dict[str, list[dict]],
    socrata_rows: list[dict],
) -> int:
    """Keep NIF matches from the previous build when Socrata's names drifted.

    Socrata names change over time ("Seqirus Spain S.L. A CLS Company"), so a
    match made earlier can no longer be reproduced by name. We keep it when the
    NIF is not already used by another company and the NIF's main Socrata name
    still starts with the same word as the company name (this drops old wrong
    matches such as ENCIS SA -> F60137411 "INCOOP SCCL").
    """
    con = sqlite3.connect(previous_db)
    prev: dict[tuple[str, str], str] = {}
    for province, name, nif in con.execute("SELECT province, company_name, nif FROM companies WHERE nif IS NOT NULL"):
        prev.setdefault((province, name), nif)
    con.close()
    main_name: dict[str, tuple[int, str]] = {}
    for r in socrata_rows:
        nif = str(r.get("identificacio_adjudicatari", "")).strip()
        n = int(r.get("num_contracts", "0") or "0")
        if nif and n > main_name.get(nif, (-1, ""))[0]:
            main_name[nif] = (n, str(r.get("denominacio_adjudicatari", "")))
    used = {m["nif"] for m in nif_map.values()} | {m["nif"] for ms in extra_nifs.values() for m in ms}
    carried = 0
    for row in companies:
        key = company_key(row["province"], row.get("hoja", ""), row["company_name"])
        names = [row["company_name"]] + [a for a in (row.get("aliases") or "").split("|") if a]
        for name in names:
            nif = prev.get((row["province"], name))
            if not nif or nif in used or "*" in nif or nif not in main_name:
                continue
            words, socrata_words = _words(name), _words(main_name[nif][1])
            if not words or not socrata_words or words[0] != socrata_words[0]:
                continue
            match = {"nif": nif, "name": main_name[nif][1], "match_type": "carried_over"}
            if key not in nif_map:
                nif_map[key] = match
            else:
                extra_nifs.setdefault(key, []).append(match)
            used.add(nif)
            carried += 1
            break
    return carried


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db-dir", default=str(DB_DIR), help="dir with companies.csv + admin_spans.csv; admin.sqlite is written here")
    ap.add_argument("--events-dir", default=str(DATA_DIR / "v2"), help="dir with bulk_*/company_events_*.csv")
    ap.add_argument("--until", default="", help="YYYYMMDD: ignore acts after this date (replay tests)")
    ap.add_argument("--carry-nifs", help="SQLite with companies(province, company_name, nif) from the previous build: "
                                         "keep its NIF matches that name matching can no longer reproduce")
    args = ap.parse_args()
    db_dir = Path(args.db_dir)

    print("[1/5] Loading companies.csv + admin_spans.csv …", flush=True)
    with (db_dir / "companies.csv").open(encoding="utf-8") as f:
        companies = list(csv.DictReader(f))
    with (db_dir / "admin_spans.csv").open(encoding="utf-8") as f:
        spans = list(csv.DictReader(f))
    print(f"  {len(companies):,} companies, {len(spans):,} spans", flush=True)

    print("[2/5] Loading company events …", flush=True)
    events_by_key = load_company_events(Path(args.events_dir), args.until)

    print("[3/5] Fetching Socrata company index …", flush=True)
    socrata_rows = fetch_socrata_companies()
    exact_idx, norm_idx = build_socrata_index(socrata_rows)
    print(f"  {len(exact_idx):,} exact keys, {len(norm_idx):,} normalized keys", flush=True)

    print("[4/5] Matching BORME companies to NIFs (current name, then former names) …", flush=True)
    nif_map: dict[str, dict] = {}
    extra_nifs: dict[str, list[dict]] = {}
    by_type: dict[str, int] = {}
    for row in companies:
        key = company_key(row["province"], row.get("hoja", ""), row["company_name"])
        candidates = [row["company_name"]] + list(reversed([a for a in (row.get("aliases") or "").split("|") if a]))
        seen_nifs: set[str] = set()
        for i, name in enumerate(candidates):
            match = match_company(name, exact_idx, norm_idx)
            if not match or match["nif"] in seen_nifs:
                continue
            seen_nifs.add(match["nif"])
            if i > 0:
                match = {**match, "match_type": f"{match['match_type']}_former_name"}
            if key not in nif_map:
                nif_map[key] = match
                by_type[match["match_type"]] = by_type.get(match["match_type"], 0) + 1
            else:
                extra_nifs.setdefault(key, []).append(match)
    print(f"  {len(nif_map):,} matched {by_type} out of {len(companies):,}; "
          f"{sum(len(v) for v in extra_nifs.values()):,} extra NIFs from former names", flush=True)

    if args.carry_nifs:
        carried = carry_over_nifs(Path(args.carry_nifs), companies, nif_map, extra_nifs, socrata_rows)
        print(f"  carried over {carried:,} NIF matches from {args.carry_nifs}", flush=True)

    print("[5/5] Building SQLite …", flush=True)
    build_sqlite(db_dir / "admin.sqlite", companies, spans, nif_map, events_by_key, extra_nifs)


if __name__ == "__main__":
    main()
