#!/usr/bin/env python3
"""Structured parser for BORME Section A ("Actos inscritos") PDF text.

Replaces the regex-on-the-whole-block approach of the original extractor:

  1. Page furniture (the "BOLETÍN OFICIAL DEL REGISTRO MERCANTIL / Núm. … Pág. …
     / cve: … / Verificable en …" footer that pypdf inserts mid-entry at every
     page break) is removed *before* lines are joined, so names that straddle a
     page break stay whole.
  2. Entries are split on their sequential numbers ("433815 - NAME."), so
     address lines such as "17 - L-11 (CUNIT)" no longer start a fake entry.
  3. Each entry is split into its acts (Constitución, Nombramientos, Cambio de
     domicilio social, …) using a complete, case-sensitive list of act headers.
  4. Role lists are split on *known role labels* (ADM.UNICO:, Consejero:, …),
     so names keep their legal-form dots ("VMX GROUP S.L.") and a name is never
     swallowed into the label ("ORTEGA CEDRUN PAULA. APOD.SOL/MAN:").
     Names in a list are separated by ";" only — never on " Y ", which is part
     of many company names ("G2 9DOS Y ASOCIADOS SL").

`parse_text()` returns one `Entry` per registry entry with the company name,
registry sheet (hoja), the list of acts with structured fields, and the
person/entity relations in the same row format the span builder expects.
"""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path
from dataclasses import dataclass, field

# --------------------------------------------------------------------------
# Page furniture
# --------------------------------------------------------------------------

_FURNITURE_LINE = re.compile(
  r"^\s*(?:"
  r"BOLET[IÍ]N OFICIAL DEL REGISTRO MERCANTIL"
  r"|N[uú]m\.\s*\d+\s+\S+\s+\d{1,2}\s+de\s+\S+\s+de\s+\d{4}\s+P[aá]g\.\s*\d+"
  r"|cve:\s*BORME-[A-Z]-\d{4}-\d+-\d+"
  r"|Verificable en https?://www\.boe\.es"
  r"|https?://www\.boe\.es\s+BOLET[IÍ]N OFICIAL DEL REGISTRO MERCANTIL.*ISSN.*"
  r")\s*$"
)

ENTRY_START = re.compile(r"^(\d{1,7}) - (?=\S)", re.MULTILINE)


def strip_furniture(text: str) -> str:
  return "\n".join(line for line in text.splitlines() if not _FURNITURE_LINE.match(line))


def normalize_spaces(text: str) -> str:
  return re.sub(r"\s+", " ", text).strip()


# --------------------------------------------------------------------------
# Act headers (case-sensitive: they are Title case; free text is upper case)
# --------------------------------------------------------------------------

# (canonical code, regex). Order matters only for overlapping prefixes: longer first.
ACTS: list[tuple[str, str]] = [
  ("CONSTITUCION", r"Constituci[oó]n"),
  ("NOMBRAMIENTOS", r"Nombramientos"),
  ("REVOCACIONES", r"Revocaciones"),
  ("CESES", r"Ceses/Dimisiones"),
  ("REELECCIONES", r"Reelecciones"),
  ("CANCELACIONES_OFICIO", r"Cancelaciones de oficio de nombramientos"),
  ("MODIFICACION_PODERES", r"Modificaci[oó]n de poderes"),
  ("MODIFICACIONES_ESTATUTARIAS", r"Modificaciones estatutarias"),
  ("CAMBIO_DOMICILIO", r"Cambio de domicilio social"),
  ("CAMBIO_OBJETO", r"Cambio de objeto social"),
  ("AMPLIACION_OBJETO", r"Ampliaci[oó]n del objeto social"),
  ("CAMBIO_DENOMINACION", r"Cambio de denominaci[oó]n social"),
  ("AMPLIACION_CAPITAL_SIN_EJECUTAR", r"Acuerdo de ampliaci[oó]n de capital social sin ejecutar"),
  ("REDUCCION_Y_AMPLIACION_CAPITAL", r"Reducci[oó]n y ampliaci[oó]n de capital"),
  ("AMPLIACION_CAPITAL", r"Ampliaci[oó]n de capital"),
  ("REDUCCION_CAPITAL", r"Reducci[oó]n de capital"),
  ("DESEMBOLSO_DIVIDENDOS", r"Desembolso de dividendos pasivos"),
  ("DISOLUCION", r"Disoluci[oó]n"),
  ("EXTINCION", r"Extinci[oó]n"),
  ("REACTIVACION", r"Reactivaci[oó]n de la sociedad(?: \([^)]{0,80}\))?"),
  ("MODIFICACION_DURACION", r"Modificaci[oó]n de duraci[oó]n"),
  ("FUSION_ABSORCION", r"Fusi[oó]n por absorci[oó]n"),
  ("FUSION_UNION", r"Fusi[oó]n por uni[oó]n"),
  ("ESCISION_PARCIAL", r"Escisi[oó]n parcial"),
  ("ESCISION_TOTAL", r"Escisi[oó]n total"),
  ("SEGREGACION", r"Segregaci[oó]n"),
  ("CESION_GLOBAL", r"Cesi[oó]n global de activo y pasivo"),
  ("TRANSFORMACION", r"Transformaci[oó]n de sociedad"),
  ("DECLARACION_UNIPERSONALIDAD", r"Declaraci[oó]n de unipersonalidad"),
  ("PERDIDA_UNIPERSONALIDAD", r"P[ée]rdida del car[aá]cter de unipersonalidad"),
  ("SOCIEDAD_UNIPERSONAL", r"Sociedad unipersonal"),
  ("SITUACION_CONCURSAL", r"Situaci[oó]n concursal"),
  ("EMISION_OBLIGACIONES", r"Emisi[oó]n de obligaciones"),
  ("PRIMERA_INSCRIPCION", r"Primera inscripci[oó]n(?: \(O\.M\. 10/6/1\.997\))?"),
  ("APERTURA_SUCURSAL", r"Apertura de sucursal"),
  ("CIERRE_SUCURSAL", r"Cierre de sucursal"),
  ("PRIMERA_SUCURSAL", r"Primera sucursal de sociedad extranjera"),
  ("SUCURSAL", r"Sucursal"),
  ("REAPERTURA_HOJA", r"Reapertura hoja registral"),
  ("CIERRE_HOJA_BAJA_IAE", r"Cierre provisional hoja registral por baja en el [íi]ndice de Entidades Jur[íi]dicas"),
  ("CIERRE_HOJA_NIF", r"Cierre provisional de la hoja registral por revocaci[oó]n del NIF"),
  ("CIERRE_HOJA_OTRO", r"Cierre provisional (?:de la )?hoja registral[^.:]*"),
  ("CREDITO_INCOBRABLE", r"Cr[ée]dito incobrable"),
  ("DEPOSITO_LIBROS", r"Dep[óo]sito de libros"),
  ("ADAPTACION", r"Adaptaci[oó]n (?:Ley \d+/\d+|sociedad|de la sociedad)"),
  ("SOCIOS_PROFESIONALES", r"Socios profesionales"),
  ("PAGINA_WEB", r"P[áa]gina web de la sociedad"),
  ("EMPRESARIO_INDIVIDUAL", r"Empresario Individual"),
  ("ARTICULO_378", r"Articulo 378\.5 del Reglamento del Registro Mercantil"),
  ("OTROS_CONCEPTOS", r"Otros conceptos"),
  ("FE_DE_ERRATAS", r"Fe de erratas"),
  ("DATOS_REGISTRALES", r"Datos registrales"),
]

# Distinctive headers that also appear without a preceding "." ("…LANGEVELD Otros conceptos:").
_LOOSE_HEADERS = (
  r"Datos registrales|Otros conceptos|Nombramientos|Revocaciones|Ceses/Dimisiones|Reelecciones|Fe de erratas|"
  r"Declaraci[oó]n de unipersonalidad|Cambio de domicilio social|Modificaciones estatutarias|Cambio de objeto social|"
  r"Cambio de denominaci[oó]n social|Ampliaci[oó]n de capital|Reducci[oó]n de capital|Disoluci[oó]n|Extinci[oó]n|"
  r"Situaci[oó]n concursal|Sociedad unipersonal|P[ée]rdida del car[aá]cter de unipersonalidad|"
  r"P[áa]gina web de la sociedad|Reactivaci[oó]n de la sociedad|Modificaci[oó]n de duraci[oó]n"
)
_ACT_ALT = "|".join(f"(?P<{code}>{rx})" for code, rx in ACTS)
# An act header starts the body, or follows a "." (possibly glued: "SL.Datos").
ACT_HEADER = re.compile(
  rf"(?:^|(?<=\.)|(?<=\.\s)|(?<=\.\s\s)|(?<=\.-)|(?<=\.-\s)|(?<=\s)(?=(?:{_LOOSE_HEADERS})\b))(?:{_ACT_ALT})(?=\s*[.:]|\s*$)"
)

ROLE_ACTS = {
  "NOMBRAMIENTOS": "NOMBRAMIENTO",
  "REELECCIONES": "REELECCION",
  "REVOCACIONES": "REVOCACION",
  "CESES": "CESE_DIMISION",
  "CANCELACIONES_OFICIO": "CANCELACION_OFICIO",
  "MODIFICACION_PODERES": "NOMBRAMIENTO",
}

# --------------------------------------------------------------------------
# Role labels
# --------------------------------------------------------------------------

def _fold(text: str) -> str:
  return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn").upper()


# A label's first token (letters only, accents folded) must start with one of these.
ROLE_STEMS = (
  "ADM", "APO", "APDO", "CONS", "CJO", "COPRES", "PRES", "PDTE", "VICE", "VPRES", "VPTE", "VSEC", "VOCAL",
  "SEC", "LIQ", "REP", "AUX", "AUD", "MRO", "MIEM", "MBRO", "COMIS", "PATR", "GER", "DIR", "TESOR",
  "INTERV", "ENT", "SUPL", "SOCIO", "ACCION", "ORG", "DEPOS",
)
_LABEL_CHARS = re.compile(r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9.\s/\-]*$")
_GLUED_TITLE_LABEL = re.compile(
  r"(?<=[A-ZÁÉÍÓÚÑ])(?=(?:Presidente|Vicepresid|Secretario|Vicesecret|Consejero|Cons\.|Adm\.|Apoderado|"
  r"Liquidador|Miembro|Socio|Vocal)[^:;]{0,16}:)"
)


def _is_role_label(label: str) -> bool:
  label = label.strip()
  if not label or len(label) > 20 or not _LABEL_CHARS.match(label):
    return False
  tokens = label.split()
  # Unknown abbreviated labels: one dotted token ("DTOR.GERENTE", "Con.Delegado", "Co.De.Ma.So").
  if len(tokens) == 1 and "." in label.rstrip(".") and len(label) <= 16:
    return True
  if len(tokens) > 3:
    return False
  first = re.sub(r"[^A-Z0-9]", "", _fold(tokens[0]))
  if not first or len(first) > 13:
    return False
  return first.startswith(ROLE_STEMS)


def find_labels(text: str) -> list[tuple[int, int, str]]:
  """Return (label_start, value_start, label) for every role label in `text`.

  A label starts at the beginning of the act text or right after a "."; we take
  the shortest valid one ("PRESIDENTE", not "L. PRESIDENTE" or
  "ORTEGA CEDRUN PAULA. APOD.SOL/MAN") and then extend it over a short
  abbreviation that belongs to it ("ADM. GERENTE", "CONS. DELEG.").
  """
  labels: list[tuple[int, int, str]] = []
  lower = 0
  for m in re.finditer(r":", text):
    colon = m.start()
    if colon < lower:
      continue
    starts = [lower] + [lower + p.end() for p in re.finditer(r"\.\s+|(?<=[A-Za-zÁÉÍÓÚÑáéíóúñ]{3})\.(?=\S)", text[lower:colon])]
    chosen = None
    for start in reversed(starts):
      if _is_role_label(text[start:colon]):
        chosen = start
        break
    if chosen is None:
      continue
    # Extend over a preceding short abbreviation ("ADM." + " GERENTE").
    idx = starts.index(chosen)
    while idx > 0:
      prev = text[starts[idx - 1]:chosen].strip()
      if len(prev) <= 6 and prev.endswith(".") and _is_role_label(prev) and _is_role_label(text[starts[idx - 1]:colon]):
        idx -= 1
        chosen = starts[idx]
      else:
        break
    labels.append((chosen, colon + 1, normalize_spaces(text[chosen:colon])))
    lower = colon + 1
  return labels


# --------------------------------------------------------------------------
# Names
# --------------------------------------------------------------------------

_LEADING_JUNK = re.compile(
  r"^(?:(?:DON|DOÑA|DÑA\.?|D\.|Dª\.?|SR\.|SRA\.)\s+|(?:LA|EL)\s+(?:SOCIEDAD|MERCANTIL|COMPA[ÑN][IÍ]A|ENTIDAD)\s+)+",
  re.IGNORECASE,
)


_GIVEN_NAMES_FILE = Path(__file__).resolve().parent / "data" / "borme_given_names.txt"
try:
  GIVEN_NAMES = frozenset(_GIVEN_NAMES_FILE.read_text(encoding="utf-8").split())
except OSError:  # pragma: no cover
  GIVEN_NAMES = frozenset()
_GLUED_DON = re.compile(r"^(DOÑA|DON|D\.|Dª)([A-ZÁÉÍÓÚÑÇÜ]{3,})\b")
_LOWER_DON = re.compile(r"^(?:do[nñ]a?|do a)\s*(?=[A-ZÁÉÍÓÚÑ])")


def unglue_honorific(value: str, natural_order: bool = False) -> str:
  """'DONJAVIER CASTILLO CORTES' -> 'JAVIER CASTILLO CORTES' (but keep DONATO, DONALD, DONOSO…).

  With natural_order=True (free-text mentions: "SIENDO SOCIO UNICO DONSAIF ULLAH"),
  the first token is a given name, so the glued honorific is stripped unless the
  whole token is itself a known name or a "DONG…" Chinese given name.
  """
  value = _LOWER_DON.sub("", value)
  m = _GLUED_DON.match(value)
  if not m:
    return value
  whole = m.group(1) + m.group(2)
  if whole in GIVEN_NAMES:
    return value
  if m.group(2) in GIVEN_NAMES or (natural_order and not whole.startswith("DONG")):
    return value[len(m.group(1)):]
  return value


_ROLE_PREFIX = re.compile(r"^(?:NUEVO\s+|NUEVA\s+)?(?:SOCI[OA]|ACCIONISTA)(?:\s+U[NÑ]IC[OA])?(?:\s+PROFESIONAL)?\s*:\s*", re.IGNORECASE)
# Names are upper case: ". Título en minúscula" starts an act or a sentence.
_SENTENCE_AFTER = re.compile(r"\.\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ].*$")
# "URBACET SL.AUTORIZACION EN LOS TERMINOS…": text glued after a full legal form.
_GLUED_AFTER_FORM = re.compile(r"\b(SL|SA|SLU|SAU|SLP|SLL|SRL|BV|LTD|GMBH|INC)\.(?=[A-ZÁÉÍÓÚÑ]{4,}).*$")


def clean_name(raw: str, natural_order: bool = False) -> str:
  value = normalize_spaces(raw)
  value = _ROLE_PREFIX.sub("", value)
  value = _SENTENCE_AFTER.sub("", value)
  value = _GLUED_AFTER_FORM.sub(r"\1", value)
  value = re.sub(r"^(?:LA|EL)\s+(?:SOCIEDAD|MERCANTIL|COMPA[ÑN][IÍ]A|ENTIDAD)\s*:\s*", "", value, flags=re.IGNORECASE)
  value = value.strip(" '\"«»“”‘’.,:;-_º")
  value = _LEADING_JUNK.sub("", value)
  value = value.strip(" '\"«»“”‘’,:;-_º")
  # Unbalanced quotes / parentheses left by the source text.
  if value.count('"') % 2:
    value = value.replace('"', "")
  if value.count("(") != value.count(")"):
    value = value.replace("(", "").replace(")", "") if value.count("(") < value.count(")") else value + ")" * (value.count("(") - value.count(")"))
  value = value.rstrip(" .,;:-")
  # A dot typed instead of a space between two words ("MAMPEL.VICTOR"), but not
  # the Catalan "l·l" written L.L ("MAL.LIRACH") nor abbreviations ("S.L", "CO.LTD").
  value = re.sub(r"(?<=[A-ZÁÉÍÓÚÑ]{3})\.(?=[A-ZÁÉÍÓÚÑ]{3})(?<!L\.(?=L))(?!(?:COM|CAT|NET|ORG|INFO|BIZ)\b)", " ", value)
  return normalize_spaces(unglue_honorific(value, natural_order))


_GLUED_UPPER_LABEL = re.compile(
  r"(?:\.\s*|(?<=[A-ZÑ]))(?:SECR?|V-?SEC|VICE\w*|PRES\w*|CONS\w*|ADM\w*|APOD\w*|LIQ\w*|MBRO|MIEMB\w*)[A-Z.\s/-]{0,14}$"
)


# Safety net: a Title-case act header inside a name means a boundary was missed.
_ACT_IN_NAME = re.compile(rf"\s(?:{_LOOSE_HEADERS})\b.*$")


def split_name_list(value: str) -> list[str]:
  out = []
  for part in value.split(";"):
    part = _ACT_IN_NAME.sub("", part)
    if ":" in part:
      # An unrecognised label is glued inside ("ESTEVESECR.NO CONS: OTHER NAME"):
      # keep the part before the label; the part after belongs to an unknown role.
      head = part.split(":", 1)[0]
      part = _GLUED_UPPER_LABEL.sub("", head)
      # Drop a short unrecognised label left after the name ("GONZALEZ. COM.EJEC").
      tail = re.search(r"\.\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ.\-/]{0,12})$", part)
      if tail and not re.fullmatch(r"(?:S\.?L|S\.?A|COOP|SLU|SAU|SLP|L|A|U|P)\.?", tail.group(1)):
        part = part[: tail.start()]
      if ":" in part or part == head and not re.search(r"\.\s", head):
        part = re.split(r"\.\s", head)[0] if re.search(r"\.\s", head) else ""
    name = clean_name(part)
    if len(name) >= 3 and re.search(r"[A-Za-zÁÉÍÓÚÑ]", name):
      out.append(name)
  return out


# "SIENDO SOCIO UNICO X." inside free text: a name ends at a "." that is not an
# abbreviation dot ("S.L", "AVEL.LI", "I. M. P. SL"), at ";" or at the next act.
_MENTION_STOP = re.compile(
  r"\s*,?\s*(?:Y\s+)?(?:POSTERIOR(?:MENTE)?\b|EN FECHA\b|CON FECHA\b|DE FECHA\b|(?:NUEVO\s+)?(?:SOCIO|ACCIONISTA)\s*U[NÑ]ICO\b|"
  r"SIENDO\b|QUEDANDO\b|PERDIDA DE\b|DECLARACION DE\b|\(?\s*SOCI[OA]\b|"
  r"Y\s+(?:CAMBIO|SEPARACION|NOMBRAMIENTO|PERDIDA|DECLARACION|INCORPORACION|CESE|BAJA|ALTA)\b)"
)
_LEGAL_TAIL = re.compile(r"\s(?:[A-ZÁÉÍÓÚÑ]\.|(?:S\.?L|S\.?A|SLU|SLP|SAU|SCP|SCCL|SC|COOP|LTDA|L\.?U|R\.?L)\b)")


def take_name(text: str) -> str:
  """Name at the start of `text` in free-text mentions ("SIENDO SOCIO UNICO X. …")."""
  text = text.lstrip()
  if text and text[0] in "\"«“":
    close = {"\"": "\"", "«": "»", "“": "”"}[text[0]]
    j = text.find(close, 1)
    if j > 0:
      return clean_name(text[1:j], natural_order=True)
  i = 0
  n = len(text)
  while i < n:
    c = text[i]
    if c in ";\":":
      break
    if c == ".":
      nxt = text[i + 1] if i + 1 < n else ""
      if nxt and not nxt.isspace():
        word = re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]+$", text[:i])
        if (word and len(word.group(0)) <= 3) or (text[i - 1:i] == "L" and nxt == "L") or not nxt.isalpha():
          i += 1
          continue  # abbreviation dot: S.L, B.V, CO.LTD, Catalan AVEL.LI / MAL.LIRACH
        break  # "MASJOAN.SEPARACION DE SOCIOS…": a sentence glued to the name
      single = i >= 1 and text[i - 1].isalpha() and (i < 2 or text[i - 2] in " .")
      if single and _LEGAL_TAIL.match(text[i + 1 : i + 8]):
        i += 1
        continue  # initials / split legal forms: "I. M. P. SL", "S. COOP"
      break
    if c in " ," and _MENTION_STOP.match(text, i) and i > 0:
      break
    if text.startswith(" Datos registrales", i):
      break
    i += 1
  return clean_name(text[:i], natural_order=True)


MENTION_PATTERNS = [
  ("SOCIO_UNICO", r"(?:NUEVO\s+)?SOCIO\s*U[NÑ]ICO\s*(?::|ES|ERA)?\s*(?:A\s+)?"),
  ("ACCIONISTA_UNICO", r"(?:NUEVO\s+)?ACCIONISTA\s*U[NÑ]ICO\s*(?::|ES|ERA)?\s*"),
]
_MENTION = re.compile(
  r"SIENDO\s*(?:EL\s+|LA\s+)?(?P<a>(?:NUEV[OA]\s+)?(?:SOCI[OA]|ACCIONISTA)\s*U[NÑ]IC[OA])\s*:?\s*"
  r"|(?P<b>(?:NUEV[OA]\s+)?(?:SOCI[OA]|ACCIONISTA)\s*U[NÑ]IC[OA])\s*:\s*"
  r"|(?P<c>CAMBIO\s+DE\s+(?:SOCIO|ACCIONISTA)\s*U[NÑ]ICO)[^:.]{0,40}?SIENDO\s+(?:ESTE|ESTA|EL\s+NUEVO|LA\s+NUEVA)\s*:?\s*",
  re.IGNORECASE,
)


def mention_relations(text: str) -> list[dict]:
  """Sole-shareholder mentions inside free text (Otros conceptos, Fe de erratas…)."""
  out = []
  for m in _MENTION.finditer(text):
    kind = _fold(m.group("a") or m.group("b") or m.group("c"))
    name = take_name(text[m.end():])
    if not name or len(name) < 3:
      continue
    if re.match(r"^(DE|DEL|SOCIEDAD|UNIPERSONAL|COMO|EN FECHA)\b", name):
      continue
    out.append({
      "relation_type": "ACCIONISTA_UNICO" if "ACCIONISTA" in kind else "SOCIO_UNICO",
      "owner_name": name,
      "event_type": "MENCION",
      "role_title_raw": "",
      "role_title_code": "",
    })
  return out


# --------------------------------------------------------------------------
# Role classification (unchanged semantics from borme_bulk_extract.py)
# --------------------------------------------------------------------------

def normalize_role_title_code(role_title_raw: str) -> str:
  value = normalize_spaces(role_title_raw).upper()
  value = re.sub(r"[^A-Z0-9]+", "_", value).strip("_")
  return re.sub(r"_+", "_", value)


def classify_relation_type(role_title_raw: str) -> str | None:
  normalized = re.sub(r"[^A-Z0-9]", "", _fold(normalize_spaces(role_title_raw)))
  if not normalized:
    return None
  if normalized.startswith("SOCIOUNICO") or normalized.startswith("SOCUNICO"):
    return "SOCIO_UNICO"
  if normalized.startswith("CODE") or normalized.startswith("CONDE"):
    return "ORGANO_GOBIERNO"
  if normalized.startswith("ACCIONISTAUNICO"):
    return "ACCIONISTA_UNICO"
  if normalized.startswith("SOCIOS") or normalized.startswith("SOCIO"):
    return "SOCIO"
  if "ADM" in normalized and "COM" not in normalized:
    return "ADMINISTRADOR"
  if "APOD" in normalized or "APODER" in normalized:
    return "APODERADO"
  if "LIQUID" in normalized:
    return "LIQUIDADOR"
  if (
    "DELEG" in normalized
    or "CONSEJ" in normalized
    or "PRESIDENT" in normalized
    or "SECRETAR" in normalized
    or "VICEPRES" in normalized
    or "CONSDEL" in normalized
    or "COMISIONEJECUT" in normalized
  ):
    return "ORGANO_GOBIERNO"
  return None


def role_relations(act_text: str, event_type: str) -> list[dict]:
  text = _GLUED_TITLE_LABEL.sub(". ", act_text)
  labels = find_labels(text)
  out = []
  for i, (start, value_start, label) in enumerate(labels):
    end = labels[i + 1][0] if i + 1 < len(labels) else len(text)
    relation_type = classify_relation_type(label)
    if not relation_type:
      continue
    for name in split_name_list(text[value_start:end]):
      out.append({
        "relation_type": relation_type,
        "owner_name": name,
        "event_type": event_type,
        "role_title_raw": label,
        "role_title_code": normalize_role_title_code(label),
      })
  return out


def representatives(act_text: str) -> list[dict]:
  """Physical representatives of legal-entity officers ("X SL. REPR.143 RRM: PERSON")."""
  text = _GLUED_TITLE_LABEL.sub(". ", act_text)
  labels = find_labels(text)
  out = []
  for i, (start, value_start, label) in enumerate(labels):
    if not _fold(label).startswith("REPR"):
      continue
    if i == 0:
      continue
    end = labels[i + 1][0] if i + 1 < len(labels) else len(text)
    entity = split_name_list(text[labels[i - 1][1]:start])
    persons = split_name_list(text[value_start:end])
    if entity and persons:
      out.append({"entity": entity[-1], "representative": persons[0], "officer_label": labels[i - 1][2]})
  return out


# --------------------------------------------------------------------------
# Field parsing for company-level acts
# --------------------------------------------------------------------------

def parse_spanish_date(raw: str) -> str | None:
  m = re.search(r"(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})", raw or "")
  if not m:
    return None
  d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
  if y < 100:
    y += 2000 if y <= 69 else 1900
  try:
    import datetime as dt
    return dt.date(y, mo, d).strftime("%Y%m%d")
  except ValueError:
    return None


def parse_euros(raw: str) -> float | None:
  m = re.search(r"(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*(?:Euros|EUR|€)", raw or "")
  if not m:
    return None
  return float(m.group(1).replace(".", "").replace(",", "."))


_LABELLED_FIELD = re.compile(
  r"(?P<label>Comienzo de operaciones|Objeto social|Domicilio|Capital|Resultante Suscrito|Resultante Desembolsado|"
  r"Desembolsado|Suscrito|Duraci[oó]n)\s*:\s*"
)


def labelled_fields(text: str) -> dict[str, str]:
  out: dict[str, str] = {}
  matches = list(_LABELLED_FIELD.finditer(text))
  for i, m in enumerate(matches):
    end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
    key = _fold(m.group("label")).replace(" ", "_").lower()
    out.setdefault(key, text[m.end():end].strip(" .;"))
  return out


_CNAE = re.compile(r"(\d{4})\s*/\s*([^.]+?)(?=\.\s|\.$|$)")


def parse_object(text: str) -> dict:
  out: dict = {"text": text}
  main = re.search(r"ACTIVIDAD PRINCIPAL:\s*(\d{4})\s*/\s*(.+?)(?:\.\s*OTRAS ACTIVIDADES:|\.\s*ETC\b|$)", text)
  if main:
    out["cnae"] = main.group(1)
    out["cnae_label"] = main.group(2).strip(" .")
    others = re.search(r"OTRAS ACTIVIDADES:\s*(.+)$", text)
    if others:
      out["cnae_other"] = sorted({c for c in re.findall(r"\b(\d{4})\s*/", others.group(1))})
  return out


def parse_address(text: str) -> dict:
  text = text.strip(" .")
  m = re.search(r"\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$", text)
  municipality = m.group(1).strip() if m else ""
  return {"address": text, "municipality": municipality}


# Insolvency resolutions -> procedure phase. Order matters: "incumplimiento"
# contains "cumplimiento", and "conclusión" outranks everything else.
_CONCURSO_PHASES: list[tuple[str, str]] = [
  ("INCUMPLIMIENTO DE CONVENIO", "OPEN"),
  ("CONCLUSION DEL CONCURSO", "CLOSED"),
  ("CUMPLIMIENTO DE CONVENIO", "CLOSED"),
  ("CESE DE LAS LIMITACIONES", "CLOSED"),
  ("ARCHIVO DE LAS ACTUACIONES", "CLOSED"),
  ("APROBACION DEL CONVENIO", "AGREEMENT"),
  ("FASE DE LIQUIDACION", "LIQUIDATION"),
  ("PLAN DE LIQUIDACION", "LIQUIDATION"),
  ("PROCEDIMIENTO ESPECIAL DE LIQUIDACION", "LIQUIDATION"),
  ("REAPERTURA DEL CONCURSO", "OPEN"),
  ("DECLARACION DE CONCURSO", "OPEN"),
  ("DECLARACION DEL CONCURSO", "OPEN"),
  ("INTERVENCION O SUSPENSION", "OPEN"),
  ("FASE DE CONVENIO", "OPEN"),
  ("ACUMULACION DE CONCURSO", "OPEN"),
]


def concurso_resolution(text: str) -> dict:
  """Phase of an insolvency act: OPEN / LIQUIDATION / AGREEMENT / CLOSED, or
  NEUTRAL (administrators, qualification…) when it does not change the state."""
  folded = _fold(text)
  m = re.search(r"FECHA DE RESOLUCION\s*[\d/]+\.\s*(.+?)(?:\.\s*JUZGADO:|$)", folded)
  resolution = normalize_spaces(m.group(1)) if m else ""
  scope = resolution or folded
  phase = "NEUTRAL"
  for needle, value in _CONCURSO_PHASES:
    if needle in scope:
      phase = value
      break
  calificacion = None
  if "CALIFICACION DEL CONCURSO" in scope:
    calificacion = "CULPABLE" if "CULPABLE" in scope else "FORTUITO" if "FORTUITO" in scope else None
  return {"phase": phase, "resolution": resolution[:200], "calificacion": calificacion}


# Lists of companies in merger acts are separated by ". " after the legal form:
# "SEIDOR EQUITYCO S.L. NUBERSIA SL. IT SEIDOR SL."
_LEGAL_FORM_END = re.compile(
  r"\b(SL|SA|SLU|SAU|SLP|SLL|SRL|SAS|BV|NV|AG|GMBH|LTD|LIMITED|INC|LLC|SCCL|LIMITADA|ANONIMA|UNIPERSONAL"
  r"|S\.L|S\.A|S\.L\.U|S\.A\.U|S\.L\.P|B\.V|N\.V|S\.R\.L)\.\s+"
)


def act_fields(code: str, text: str) -> dict:
  if code == "CONSTITUCION":
    f = labelled_fields(text)
    out: dict = {}
    if "comienzo_de_operaciones" in f:
      out["start_operations"] = parse_spanish_date(f["comienzo_de_operaciones"]) or f["comienzo_de_operaciones"]
    if "objeto_social" in f:
      out["object"] = parse_object(f["objeto_social"])
    if "domicilio" in f:
      out.update(parse_address(f["domicilio"]))
    if "capital" in f:
      out["capital"] = parse_euros(f["capital"] + " Euros" if "Euro" not in f["capital"] else f["capital"])
    return out
  if code == "CAMBIO_DOMICILIO":
    return parse_address(text)
  if code in ("CAMBIO_OBJETO", "AMPLIACION_OBJETO"):
    return {"object": parse_object(text.strip(" ."))}
  if code == "CAMBIO_DENOMINACION":
    return {"new_name": clean_name(text)}
  if code in ("AMPLIACION_CAPITAL", "REDUCCION_CAPITAL", "REDUCCION_Y_AMPLIACION_CAPITAL", "DESEMBOLSO_DIVIDENDOS"):
    f = labelled_fields(text)
    out = {}
    for key, name in (("capital", "amount"), ("resultante_suscrito", "resulting_capital"),
                      ("desembolsado", "paid"), ("resultante_desembolsado", "resulting_paid")):
      if key in f:
        out[name] = parse_euros(f[key] if "Euro" in f[key] else f[key] + " Euros")
    return out
  if code == "DISOLUCION":
    return {"reason": text.strip(" .")}
  if code == "TRANSFORMACION":
    m = re.search(r"(?:Forma Jur[ií]dica|Denominaci[oó]n y forma adoptada)\s*:\s*(.+)", text)
    return {"new_form": m.group(1).strip(" .") if m else text.strip(" .")}
  if code in ("FUSION_ABSORCION", "FUSION_UNION", "ESCISION_PARCIAL", "ESCISION_TOTAL", "SEGREGACION", "CESION_GLOBAL"):
    m = re.search(r"(Sociedades? [^:]{3,60}):\s*(.+)", text)
    others = [n for part in (m.group(2) if m else "").split(";") for n in split_name_list(_LEGAL_FORM_END.sub(r"\1;", part))]
    return {"counterparty_label": m.group(1) if m else "", "counterparties": others}
  if code == "SITUACION_CONCURSAL":
    proc = re.search(r"Procedimiento concursal\s*([\w/.-]+)", text, re.IGNORECASE)
    court = re.search(r"Juzgado:\s*(?:num\.\s*\d+\s*)?([^.]+)", text)
    res = re.search(r"Fecha de [Rr]esoluci[oó]n\s*(\d{1,2}/\d{1,2}/\d{4})", text)
    return {
      **concurso_resolution(text),
      "procedure": (proc.group(1).rstrip(".") if proc else ""),
      "court": normalize_spaces(court.group(1)) if court else "",
      "resolution_date": parse_spanish_date(res.group(1)) if res else None,
    }
  if code == "PAGINA_WEB":
    m = re.search(r"((?:https?://)?(?:www\.)?[\w\-]+(?:\.[\w\-]+)+(?:/\S*)?)", text, re.IGNORECASE)
    return {"url": m.group(1).rstrip(".").lower() if m else ""}
  if code == "DATOS_REGISTRALES":
    return parse_registry(text)
  return {}


def parse_registry(text: str) -> dict:
  raw = normalize_spaces(text).strip(" .")
  hoja = re.search(r"\bH\s+([A-Z]{1,2}\s*)?(\d+)", raw)
  dt_m = re.search(r"\(\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s*\)", raw)
  tomo = re.search(r"\bT\s*(\d+)\b", raw)
  folio = re.search(r"\bF\s*(\d+)\b", raw)
  ins = re.search(r"\bI/A\s*([0-9A-Z]+)", raw)
  return {
    "raw": raw,
    "hoja": f"{(hoja.group(1) or '').strip() or '_'}-{hoja.group(2)}" if hoja else "",
    "tomo": tomo.group(1) if tomo else "",
    "folio": folio.group(1) if folio else "",
    "inscripcion": ins.group(1) if ins else "",
    "registry_date": parse_spanish_date(dt_m.group(1)) if dt_m else None,
  }


# --------------------------------------------------------------------------
# Entry splitting
# --------------------------------------------------------------------------

@dataclass
class Act:
  code: str
  header: str
  text: str
  fields: dict = field(default_factory=dict)


@dataclass
class Entry:
  number: int
  company_name: str
  text: str
  acts: list[Act]
  relations: list[dict]
  representatives: list[dict]
  hoja: str
  registry: dict
  previous_owners: list[str] = field(default_factory=list)


def split_entries(text: str) -> list[tuple[int, str]]:
  """Split on sequential entry numbers; a number that does not follow the
  previous one ("17 - L-11 (CUNIT)") is treated as part of the text."""
  cands = [(int(m.group(1)), m.start(), m.end()) for m in ENTRY_START.finditer(text)]
  kept: list[tuple[int, int, int]] = []
  for i, (num, s, e) in enumerate(cands):
    if not kept:
      # First entry: accept unless the very next candidate is num+1 later on
      # and this one is not followed by it (rare); accept by default.
      kept.append((num, s, e))
      continue
    if num == kept[-1][0] + 1:
      kept.append((num, s, e))
    elif num > kept[-1][0] + 1 and not any(c[0] == kept[-1][0] + 1 for c in cands[i + 1:]):
      # Gap in numbering (entry missing from this PDF): accept if no exact
      # successor appears later.
      kept.append((num, s, e))
  out = []
  for i, (num, s, e) in enumerate(kept):
    end = kept[i + 1][1] if i + 1 < len(kept) else len(text)
    out.append((num, text[e:end]))
  return out


_BRANCH_SUBHEADER = re.compile(r"(?<=\.)\s*\d{1,7} - SUCURSAL[^.]{0,80}\.")


def parse_entry(number: int, raw: str) -> Entry:
  text = normalize_spaces(raw)
  # Branch filings repeat the entry number: "429558 - BANCO X SA. 429558 - SUCURSAL."
  text = _BRANCH_SUBHEADER.sub("", text, count=1)
  headers = list(ACT_HEADER.finditer(text))
  # The company name ends at the "." just before the first act header.
  if headers:
    name_part = text[: headers[0].start()]
  else:
    name_part = text.split(". ", 1)[0]
  company_name = normalize_spaces(name_part).rstrip(" .,:;")
  acts: list[Act] = []
  for i, h in enumerate(headers):
    code = h.lastgroup or ""
    end = headers[i + 1].start() if i + 1 < len(headers) else len(text)
    body = text[h.end():end].strip()
    body = re.sub(r"^[.:]\s*", "", body).strip()
    acts.append(Act(code=code, header=h.group(0), text=body))
  relations: list[dict] = []
  reps: list[dict] = []
  registry: dict = {}
  for act in acts:
    act.fields = act_fields(act.code, act.text)
    if act.code == "DATOS_REGISTRALES":
      registry = act.fields
    if act.code in ROLE_ACTS:
      relations.extend(role_relations(act.text, ROLE_ACTS[act.code]))
      reps.extend(representatives(act.text))
    elif act.code in ("DECLARACION_UNIPERSONALIDAD", "SOCIEDAD_UNIPERSONAL", "SOCIOS_PROFESIONALES"):
      for rel in role_relations(act.text, "MENCION"):
        relations.append(rel)
    elif act.code in ("OTROS_CONCEPTOS", "FE_DE_ERRATAS", "CONSTITUCION"):
      relations.extend(mention_relations(act.text))
  # Normalise sole-shareholder relations coming from labels ("Socio único: X").
  for rel in relations:
    if rel["relation_type"] in ("SOCIO_UNICO", "ACCIONISTA_UNICO", "SOCIO"):
      rel["event_type"] = "MENCION"
      rel["role_title_raw"] = ""
      rel["role_title_code"] = ""
  # Several sole-shareholder mentions in one entry describe a chain of owners
  # ("A … Y POSTERIOR CAMBIO DE SOCIO UNICO, SIENDO ESTE: B"): only the last is current.
  owners = [r for r in relations if r["relation_type"] in ("SOCIO_UNICO", "ACCIONISTA_UNICO")]
  previous_owners = []
  if len({r["owner_name"] for r in owners}) > 1:
    last = owners[-1]["owner_name"]
    previous_owners = [r["owner_name"] for r in owners if r["owner_name"] != last]
    relations = [r for r in relations if r not in owners or r["owner_name"] == last]
  # De-duplicate within the entry.
  seen = set()
  uniq = []
  for rel in relations:
    key = (rel["relation_type"], rel["event_type"], rel["role_title_code"], rel["owner_name"])
    if key not in seen:
      seen.add(key)
      uniq.append(rel)
  return Entry(
    number=number,
    company_name=company_name,
    text=text,
    acts=acts,
    relations=uniq,
    representatives=reps,
    hoja=registry.get("hoja", ""),
    registry=registry,
    previous_owners=previous_owners,
  )


def parse_text(pdf_text: str) -> list[Entry]:
  clean = strip_furniture(pdf_text)
  return [parse_entry(num, raw) for num, raw in split_entries(clean)]
