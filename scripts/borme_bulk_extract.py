#!/usr/bin/env python3
"""High-volume BORME Section A extractor with optional matching against contractes.cat dataset.

Outputs:
  - relations_<run_id>.csv: person-level relations with event_type and role title detail.
  - company_events_<run_id>.csv: per-filing company metadata (constitucion + datos registrales).
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import requests
from pypdf import PdfReader

BORME_SUMARIO_URL = "https://www.boe.es/datosabiertos/api/borme/sumario/{date}"
SOCRATA_BASE_URL = "https://analisi.transparenciacatalunya.cat/resource/ybgg-dgi6.json"
HEADERS = {"Accept": "application/json"}
DEFAULT_PROVINCES = ("BARCELONA", "GIRONA", "LLEIDA", "TARRAGONA")
DEFAULT_OUTPUT_DIR = Path("data/borme_bulk")
DEFAULT_CACHE_DIR = Path("data/borme_cache")
TIMEOUT_SECONDS = 60


@dataclass(frozen=True)
class SectionItem:
  date_yyyymmdd: str
  item_id: str
  province_title: str
  pdf_url: str


def normalize_spaces(text: str) -> str:
  return re.sub(r"\s+", " ", text).strip()


def normalize_company_for_match(text: str) -> str:
  return re.sub(r"[.,\-/\s]", "", text).upper()


def parse_date(value: str) -> dt.date:
  value = value.strip()
  if re.fullmatch(r"\d{8}", value):
    return dt.datetime.strptime(value, "%Y%m%d").date()
  return dt.datetime.strptime(value, "%Y-%m-%d").date()


def daterange(start_date: dt.date, end_date: dt.date) -> Iterable[dt.date]:
  day = start_date
  while day <= end_date:
    yield day
    day += dt.timedelta(days=1)


def ensure_list(value: object) -> list[object]:
  if value is None:
    return []
  if isinstance(value, list):
    return value
  return [value]


def fetch_sumario(date_yyyymmdd: str) -> dict:
  url = BORME_SUMARIO_URL.format(date=date_yyyymmdd)
  response = requests.get(url, headers=HEADERS, timeout=TIMEOUT_SECONDS)
  response.raise_for_status()
  payload = response.json()
  if payload.get("status", {}).get("code") != "200":
    raise ValueError(f"BORME API status != 200 for {date_yyyymmdd}")
  return payload


def extract_section_a_items(payload: dict, provinces: set[str], date_yyyymmdd: str) -> list[SectionItem]:
  items: list[SectionItem] = []
  diarios = ensure_list(payload.get("data", {}).get("sumario", {}).get("diario"))
  for diario_raw in diarios:
    if not isinstance(diario_raw, dict):
      continue
    secciones = ensure_list(diario_raw.get("seccion"))
    for section_raw in secciones:
      if not isinstance(section_raw, dict) or str(section_raw.get("codigo", "")).upper() != "A":
        continue
      section_items = ensure_list(section_raw.get("item"))
      for item_raw in section_items:
        if not isinstance(item_raw, dict):
          continue
        province_title = str(item_raw.get("titulo", "")).upper().strip()
        if province_title not in provinces:
          continue
        url_pdf = item_raw.get("url_pdf")
        pdf_url = str(url_pdf.get("texto", "") if isinstance(url_pdf, dict) else (url_pdf or "")).strip()
        if not pdf_url:
          continue
        item_id = str(item_raw.get("identificador", "")).strip()
        items.append(
          SectionItem(
            date_yyyymmdd=date_yyyymmdd,
            item_id=item_id,
            province_title=province_title,
            pdf_url=pdf_url,
          )
        )
  return items


def split_registry_blocks(pdf_text: str) -> list[str]:
  return re.split(r"\n\d+\s-\s", pdf_text)


def extract_company_name(block_text: str) -> str:
  candidate = block_text.strip()
  if not candidate:
    return ""
  marker = re.search(
    r"\b("
    r"Constitución|Nombramientos|Revocaciones|Reelecciones|Fe de erratas|Otros conceptos|Cambio de domicilio|"
    r"Transformación de sociedad|Reducción de capital|Ampliación de capital|Disolución|Extinción|"
    r"Ceses/Dimisiones|Declaración de unipersonalidad|Cambio de objeto social|Modificaciones estatutarias"
    r")\b",
    candidate,
    flags=re.IGNORECASE,
  )
  company_raw = candidate[: marker.start()] if marker else candidate.split("\n", 1)[0]
  company_raw = normalize_spaces(company_raw).rstrip(" .,:;")
  return company_raw


def clean_fragment(text: str) -> str:
  value = normalize_spaces(text)
  value = re.split(
    r"\b("
    r"DATOS\s+REGISTRALES|NOMBRAMIENTOS|OTROS\s+CONCEPTOS|DOMICILIO|CAPITAL|"
    r"CONSTITUCION|REVOCACIONES|REELECCIONES|OBJETO\s+SOCIAL|COMIENZO\s+DE\s+OPERACIONES"
    r")\b",
    value,
    maxsplit=1,
    flags=re.IGNORECASE,
  )[0]
  value = re.sub(r"^(DON|DOÑA)\s+", "", value, flags=re.IGNORECASE)
  return value.strip(" '\".,:;")


def split_names(text: str) -> list[str]:
  value = clean_fragment(text)
  if not value:
    return []
  parts = re.split(r"\s*;\s*|\s+Y\s+", value, flags=re.IGNORECASE)
  return [p.strip(" '\".,:;") for p in parts if len(p.strip(" '\".,:;")) >= 3]


SECTION_BOUNDARIES = (
  r"CONSTITUCI[OÓ]N",
  r"NOMBRAMIENTOS",
  r"CESES/DIMISIONES",
  r"REVOCACIONES",
  r"REELECCIONES",
  r"DATOS\s+REGISTRALES",
  r"OTROS\s+CONCEPTOS",
  r"CAMBIO\s+DE\s+DOMICILIO",
  r"DECLARACI[OÓ]N\s+DE\s+UNIPERSONALIDAD",
  r"P[ÉE]RDIDA\s+DEL\s+CARACTER\s+DE\s+UNIPERSONALIDAD",
  r"DISOLUCI[OÓ]N",
  r"EXTINCI[OÓ]N",
  r"MODIFICACIONES\s+ESTATUTARIAS",
  r"OBJETO\s+SOCIAL",
)

ROLE_CAPTURE_PATTERN = re.compile(r"([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ./\s-]{1,60}?)\s*:\s*([^\.]+)", re.IGNORECASE)


def extract_section_body(block: str, header_regex: str) -> list[str]:
  boundary = "|".join(SECTION_BOUNDARIES)
  return re.findall(
    rf"{header_regex}\.\s*(.+?)(?=(?:\b(?:{boundary})\b\.)|$)",
    block,
    flags=re.IGNORECASE,
  )


def normalize_role_title_code(role_title_raw: str) -> str:
  value = normalize_spaces(role_title_raw).upper()
  value = re.sub(r"[^A-Z0-9]+", "_", value).strip("_")
  value = re.sub(r"_+", "_", value)
  return value


def classify_relation_type(role_title_raw: str) -> str | None:
  title = normalize_spaces(role_title_raw).upper()
  normalized = re.sub(r"[^A-Z0-9]", "", title)
  if not normalized:
    return None
  if "ADM" in normalized and "COM" not in normalized:
    return "ADMINISTRADOR"
  if "APOD" in normalized or "APODER" in normalized:
    return "APODERADO"
  if "LIQUID" in normalized:
    return "LIQUIDADOR"
  if (
    "CONSEJ" in normalized
    or "PRESIDENT" in normalized
    or "SECRETAR" in normalized
    or "VICEPRES" in normalized
    or "CONSDEL" in normalized
    or "COMISIONEJECUT" in normalized
  ):
    return "ORGANO_GOBIERNO"
  return None


def parse_role_relations(section_text: str, event_type: str) -> list[dict]:
  relations: list[dict] = []
  for match in ROLE_CAPTURE_PATTERN.finditer(section_text):
    role_title_raw = normalize_spaces(match.group(1))
    relation_type = classify_relation_type(role_title_raw)
    if not relation_type:
      continue
    role_title_code = normalize_role_title_code(role_title_raw)
    for owner in split_names(match.group(2)):
      relations.append(
        {
          "relation_type": relation_type,
          "owner_name": owner,
          "event_type": event_type,
          "role_title_raw": role_title_raw,
          "role_title_code": role_title_code,
        }
      )
  return relations


def parse_spanish_date(raw: str) -> str | None:
  value = normalize_spaces(raw).strip(" .")
  match = re.fullmatch(r"(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})", value)
  if not match:
    return None
  day = int(match.group(1))
  month = int(match.group(2))
  year = int(match.group(3))
  if year < 100:
    year += 2000 if year <= 69 else 1900
  try:
    parsed = dt.date(year, month, day)
  except ValueError:
    return None
  return parsed.strftime("%Y%m%d")


def extract_constitucion_metadata(block: str, filing_date: str) -> dict:
  has_constitucion = bool(re.search(r"\bCONSTITUCI[OÓ]N\.", block, flags=re.IGNORECASE))
  start_raw = ""
  start_yyyymmdd = ""
  date_match = re.search(
    r"COMIENZO\s+DE\s+OPERACIONES\s*:\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})",
    block,
    flags=re.IGNORECASE,
  )
  if date_match:
    start_raw = date_match.group(1)
    parsed = parse_spanish_date(start_raw)
    if parsed:
      start_yyyymmdd = parsed
  else:
    match = re.search(r"COMIENZO\s+DE\s+OPERACIONES\s*:\s*([^\.]+)", block, flags=re.IGNORECASE)
    if match:
      start_raw = clean_fragment(match.group(1))
      parsed = parse_spanish_date(start_raw)
      if parsed:
        start_yyyymmdd = parsed
  return {
    "has_constitucion": "1" if has_constitucion else "0",
    "constitution_date": filing_date if has_constitucion else "",
    "start_operations_raw": start_raw,
    "start_operations_yyyymmdd": start_yyyymmdd,
  }


def extract_datos_registrales(block: str) -> dict:
  raw = ""
  tomo = ""
  folio = ""
  hoja = ""
  inscripcion = ""
  registry_date = ""
  match = re.search(r"DATOS\s+REGISTRALES\.\s*(.+)$", block, flags=re.IGNORECASE)
  if match:
    raw = normalize_spaces(match.group(1)).strip().rstrip(".")
    m_t = re.search(r"\bT\s*([0-9]+)\b", raw, flags=re.IGNORECASE)
    m_f = re.search(r"\bF\s*([0-9]+)\b", raw, flags=re.IGNORECASE)
    m_h = re.search(r"\bH\s*([A-Z]?\s*[0-9]+)\b", raw, flags=re.IGNORECASE)
    m_ia = re.search(r"\bI/A\s*([0-9A-Z]+)\b", raw, flags=re.IGNORECASE)
    m_dt = re.search(r"\((\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\)", raw)
    tomo = m_t.group(1) if m_t else ""
    folio = m_f.group(1) if m_f else ""
    hoja = normalize_spaces(m_h.group(1)) if m_h else ""
    inscripcion = m_ia.group(1) if m_ia else ""
    if m_dt:
      parsed = parse_spanish_date(m_dt.group(1))
      if parsed:
        registry_date = parsed
  return {
    "datos_registrales_raw": raw,
    "registry_tomo": tomo,
    "registry_folio": folio,
    "registry_hoja": hoja,
    "registry_inscripcion": inscripcion,
    "registry_date_yyyymmdd": registry_date,
  }


def extract_tax_ids(text: str) -> list[str]:
  compact = normalize_spaces(text).replace(" ", "")
  pattern = re.compile(r"\b(?:[A-HJNP-SUVW]\d{7}[0-9A-J]|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\b", re.IGNORECASE)
  ids = []
  seen = set()
  for m in pattern.finditer(compact.upper()):
    value = m.group(0)
    if value not in seen:
      seen.add(value)
      ids.append(value)
  return ids


def extract_relations(block_text: str) -> list[dict]:
  relations: list[dict] = []
  block = normalize_spaces(block_text)
  patterns = [
    ("SOCIO_UNICO", r"SIENDO\s+(?:EL\s+)?SOCIO\s+U[NÑ]ICO\s+([^.;]+)"),
    ("SOCIO_UNICO", r"NUEVO\s+SOCIO\s+U[NÑ]ICO:\s*([^.;]+)"),
    ("SOCIO_UNICO", r"SOCIO\s+U[NÑ]ICO:\s*([^.;]+)"),
    ("ACCIONISTA_UNICO", r"SIENDO\s+(?:EL\s+)?ACCIONISTA\s+U[NÑ]ICO\s+([^.;]+)"),
    ("ACCIONISTA_UNICO", r"NUEVO\s+ACCIONISTA\s+U[NÑ]ICO:\s*([^.;]+)"),
    ("ACCIONISTA_UNICO", r"ACCIONISTA\s+U[NÑ]ICO:\s*([^.;]+)"),
    ("SOCIO", r"SOCIOS(?:\s+PROFESIONALES)?\s*:\s*([^.;]+)"),
    ("SOCIO", r"SEPARACION\s+DE\s+([^.;]+?)\s+COMO\s+SOCIOS"),
    ("SOCIO", r"INCORPORACION\s+DE\s+([^.;]+?)\s+COMO\s+SOCIOS"),
  ]
  for relation_type, pattern in patterns:
    for m in re.finditer(pattern, block, flags=re.IGNORECASE):
      for owner in split_names(m.group(1)):
        relations.append(
          {
            "relation_type": relation_type,
            "owner_name": owner,
            "event_type": "MENCION",
            "role_title_raw": "",
            "role_title_code": "",
          }
        )
  for section in extract_section_body(block, r"NOMBRAMIENTOS"):
    relations.extend(parse_role_relations(section, "NOMBRAMIENTO"))
  for section in extract_section_body(block, r"CESES/DIMISIONES"):
    relations.extend(parse_role_relations(section, "CESE_DIMISION"))
  for section in extract_section_body(block, r"REVOCACIONES"):
    relations.extend(parse_role_relations(section, "REVOCACION"))
  return relations


def load_or_fetch_pdf_text(item: SectionItem, cache_dir: Path) -> str:
  cache_dir.mkdir(parents=True, exist_ok=True)
  cache_file = cache_dir / f"{item.date_yyyymmdd}_{item.item_id}.txt"
  if cache_file.exists():
    return cache_file.read_text(encoding="utf-8")
  response = requests.get(item.pdf_url, timeout=TIMEOUT_SECONDS)
  response.raise_for_status()
  reader = PdfReader(io.BytesIO(response.content))
  text = "\n".join((page.extract_text() or "") for page in reader.pages)
  cache_file.write_text(text, encoding="utf-8")
  return text


def process_item(item: SectionItem, cache_dir: Path) -> tuple[list[dict], list[dict], dict]:
  try:
    text = load_or_fetch_pdf_text(item, cache_dir)
  except Exception as exc:
    print(f"[WARN] skipping {item.item_id} ({item.date_yyyymmdd}): {exc}", flush=True)
    return [], [], {"item_id": item.item_id, "relations": 0, "company_events": 0}
  blocks = split_registry_blocks(text)
  rows: list[dict] = []
  company_event_rows: list[dict] = []
  for block in blocks[1:]:
    company = extract_company_name(block)
    if not company:
      continue
    block_norm = normalize_spaces(block)
    company_tax_ids = extract_tax_ids(block)
    constitucion_meta = extract_constitucion_metadata(block_norm, item.date_yyyymmdd)
    registry_meta = extract_datos_registrales(block_norm)
    company_event_rows.append(
      {
        "borme_date": item.date_yyyymmdd,
        "borme_item_id": item.item_id,
        "province": item.province_title,
        "company_name_borme": company,
        "company_tax_id_candidates": "|".join(company_tax_ids),
        "source_pdf_url": item.pdf_url,
        **constitucion_meta,
        **registry_meta,
      }
    )
    relations = extract_relations(block_norm)
    for relation in relations:
      owner_name = str(relation["owner_name"])
      owner_tax_ids = extract_tax_ids(owner_name)
      rows.append(
        {
          "borme_date": item.date_yyyymmdd,
          "borme_item_id": item.item_id,
          "province": item.province_title,
          "company_name_borme": company,
          "relation_type": relation["relation_type"],
          "owner_name": owner_name,
          "event_type": relation["event_type"],
          "role_title_raw": relation["role_title_raw"],
          "role_title_code": relation["role_title_code"],
          "company_tax_id_candidates": "|".join(company_tax_ids),
          "owner_tax_id_candidates": "|".join(owner_tax_ids),
          **constitucion_meta,
          **registry_meta,
          "source_pdf_url": item.pdf_url,
        }
      )
  stats = {"item_id": item.item_id, "relations": len(rows), "company_events": len(company_event_rows)}
  return rows, company_event_rows, stats


def fetch_all_company_rows() -> list[dict]:
  rows: list[dict] = []
  limit = 50000
  offset = 0
  while True:
    params = {
      "$select": "identificacio_adjudicatari, denominacio_adjudicatari, count(*) as num_contracts",
      "$where": "denominacio_adjudicatari IS NOT NULL AND identificacio_adjudicatari IS NOT NULL",
      "$group": "identificacio_adjudicatari, denominacio_adjudicatari",
      "$limit": str(limit),
      "$offset": str(offset),
    }
    res = requests.get(SOCRATA_BASE_URL, params=params, timeout=TIMEOUT_SECONDS)
    res.raise_for_status()
    chunk = res.json()
    if not chunk:
      break
    rows.extend(chunk)
    if len(chunk) < limit:
      break
    offset += limit
  return rows


def match_companies(unique_companies: list[str]) -> dict[str, dict]:
  matches: dict[str, dict] = {}
  rows = fetch_all_company_rows()
  exact: dict[str, dict] = {}
  norm: dict[str, dict] = {}
  for row in rows:
    name = str(row.get("denominacio_adjudicatari", "")).strip()
    if not name:
      continue
    candidate = {
      "matched_nif": row.get("identificacio_adjudicatari", ""),
      "matched_name": name,
      "matched_contracts": row.get("num_contracts", "0"),
    }
    up = name.upper()
    if up not in exact or int(candidate["matched_contracts"] or 0) > int(exact[up]["matched_contracts"] or 0):
      exact[up] = candidate
    n = normalize_company_for_match(name)
    if n and (n not in norm or int(candidate["matched_contracts"] or 0) > int(norm[n]["matched_contracts"] or 0)):
      norm[n] = candidate
  for company in unique_companies:
    if company.upper() in exact:
      matches[company] = {"match_type": "exact", **exact[company.upper()]}
    else:
      n = normalize_company_for_match(company)
      if n in norm:
        matches[company] = {"match_type": "normalized", **norm[n]}
      else:
        matches[company] = {"match_type": "none", "matched_nif": "", "matched_name": "", "matched_contracts": "0"}
  return matches


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  with path.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)


def main() -> None:
  parser = argparse.ArgumentParser(description="Bulk extract structured relations from BORME Section A PDFs.")
  parser.add_argument("--start-date", required=True, help="YYYY-MM-DD or YYYYMMDD")
  parser.add_argument("--end-date", required=True, help="YYYY-MM-DD or YYYYMMDD")
  parser.add_argument("--provinces", default=",".join(DEFAULT_PROVINCES))
  parser.add_argument("--workers", type=int, default=8)
  parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
  parser.add_argument("--cache-dir", default=str(DEFAULT_CACHE_DIR / "pdf_text"))
  parser.add_argument("--skip-matching", action="store_true", help="Do not match against contractes.cat companies.")
  args = parser.parse_args()

  start_date = parse_date(args.start_date)
  end_date = parse_date(args.end_date)
  if end_date < start_date:
    raise ValueError("end-date must be >= start-date")

  provinces = {normalize_spaces(p).upper() for p in args.provinces.split(",") if p.strip()}
  output_dir = Path(args.output_dir)
  cache_dir = Path(args.cache_dir)
  run_id = f"{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}"

  all_items: list[SectionItem] = []
  for day in daterange(start_date, end_date):
    ds = day.strftime("%Y%m%d")
    try:
      payload = fetch_sumario(ds)
      day_items = extract_section_a_items(payload, provinces, ds)
      all_items.extend(day_items)
      print(f"[INFO] {ds}: {len(day_items)} items", flush=True)
    except Exception as exc:
      print(f"[WARN] {ds}: {exc}", flush=True)

  extracted: list[dict] = []
  company_events: list[dict] = []
  with ThreadPoolExecutor(max_workers=max(1, args.workers)) as ex:
    futures = [ex.submit(process_item, item, cache_dir) for item in all_items]
    for i, fut in enumerate(as_completed(futures), start=1):
      rows, event_rows, stats = fut.result()
      extracted.extend(rows)
      company_events.extend(event_rows)
      if i % 10 == 0 or i == len(futures):
        print(
          f"[INFO] processed {i}/{len(futures)} PDFs, relations={len(extracted)}, company_events={len(company_events)}",
          flush=True,
        )

  dedup = []
  seen = set()
  for row in extracted:
    key = (
      row["borme_date"],
      row["borme_item_id"],
      row["company_name_borme"],
      row["relation_type"],
      row["event_type"],
      row["role_title_code"],
      row["owner_name"],
    )
    if key in seen:
      continue
    seen.add(key)
    dedup.append(row)

  dedup_company_events = []
  seen_company = set()
  for row in company_events:
    key = (row["borme_date"], row["borme_item_id"], row["company_name_borme"])
    if key in seen_company:
      continue
    seen_company.add(key)
    dedup_company_events.append(row)

  unique_companies = sorted({r["company_name_borme"] for r in dedup})
  match_map = {}
  if not args.skip_matching:
    print(f"[INFO] matching {len(unique_companies)} companies", flush=True)
    match_map = match_companies(unique_companies)

  relations_rows = []
  for row in dedup:
    merged = dict(row)
    if match_map:
      merged.update(match_map.get(row["company_name_borme"], {}))
    relations_rows.append(merged)

  relations_csv = output_dir / f"relations_{run_id}.csv"
  company_events_csv = output_dir / f"company_events_{run_id}.csv"
  matches_csv = output_dir / f"company_matches_{run_id}.csv"
  summary_json = output_dir / f"summary_{run_id}.json"

  relation_fields = [
    "borme_date",
    "borme_item_id",
    "province",
    "company_name_borme",
    "relation_type",
    "owner_name",
    "event_type",
    "role_title_raw",
    "role_title_code",
    "has_constitucion",
    "constitution_date",
    "start_operations_raw",
    "start_operations_yyyymmdd",
    "datos_registrales_raw",
    "registry_tomo",
    "registry_folio",
    "registry_hoja",
    "registry_inscripcion",
    "registry_date_yyyymmdd",
    "company_tax_id_candidates",
    "owner_tax_id_candidates",
    "source_pdf_url",
    "match_type",
    "matched_nif",
    "matched_name",
    "matched_contracts",
  ]
  for row in relations_rows:
    row.setdefault("match_type", "none")
    row.setdefault("matched_nif", "")
    row.setdefault("matched_name", "")
    row.setdefault("matched_contracts", "0")
  write_csv(relations_csv, relations_rows, relation_fields)

  company_event_fields = [
    "borme_date",
    "borme_item_id",
    "province",
    "company_name_borme",
    "has_constitucion",
    "constitution_date",
    "start_operations_raw",
    "start_operations_yyyymmdd",
    "datos_registrales_raw",
    "registry_tomo",
    "registry_folio",
    "registry_hoja",
    "registry_inscripcion",
    "registry_date_yyyymmdd",
    "company_tax_id_candidates",
    "source_pdf_url",
  ]
  write_csv(company_events_csv, dedup_company_events, company_event_fields)

  match_rows = [
    {"company_name_borme": company, **match_map.get(company, {"match_type": "none", "matched_nif": "", "matched_name": "", "matched_contracts": "0"})}
    for company in unique_companies
  ]
  write_csv(
    matches_csv,
    match_rows,
    ["company_name_borme", "match_type", "matched_nif", "matched_name", "matched_contracts"],
  )

  match_counts: dict[str, int] = {}
  for row in match_rows:
    k = row["match_type"]
    match_counts[k] = match_counts.get(k, 0) + 1

  summary = {
    "run_id": run_id,
    "start_date": start_date.isoformat(),
    "end_date": end_date.isoformat(),
    "provinces": sorted(provinces),
    "section_a_items_processed": len(all_items),
    "relations_extracted": len(relations_rows),
    "company_events_extracted": len(dedup_company_events),
    "unique_companies_extracted": len(unique_companies),
    "company_match_counts": match_counts,
    "files": {
      "relations_csv": str(relations_csv),
      "company_events_csv": str(company_events_csv),
      "matches_csv": str(matches_csv),
      "summary_json": str(summary_json),
    },
  }
  summary_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
  print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
  main()
