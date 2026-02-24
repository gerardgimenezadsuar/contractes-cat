/**
 * Utilities for formatting BORME person names.
 *
 * BORME stores names as COGNOMS NOM (surname-first, all uppercase):
 *   "LAPORTA ESTRUCH JOAN"  →  Joan Laporta Estruch
 */

/** Surname particles that should be grouped with the following word(s). */
const PARTICLES = new Set([
  "DE", "DEL", "DE LA", "DE LOS", "DE LAS",
  "VAN", "VAN DE", "VAN DER", "VAN DEN",
  "VON", "DI", "DA", "DOS", "DAS",
  "EL", "AL", "BEN", "LE", "LA",
]);

/** Longest particle word count (for greedy matching). */
const MAX_PARTICLE_WORDS = 3;

/**
 * Tokenise a BORME name into logical groups, collapsing particles with
 * the word that follows them.
 *
 * "DE LA FUENTE GARCIA JUAN" → ["DE LA FUENTE", "GARCIA", "JUAN"]
 * "LAPORTA ESTRUCH JOAN"     → ["LAPORTA", "ESTRUCH", "JOAN"]
 * "VAN DER BERG JOHANNES"    → ["VAN DER BERG", "JOHANNES"]
 */
function tokenise(words: string[]): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < words.length) {
    let matched = false;
    for (let len = Math.min(MAX_PARTICLE_WORDS, words.length - i - 1); len >= 1; len--) {
      const candidate = words.slice(i, i + len).join(" ");
      if (PARTICLES.has(candidate)) {
        const particleParts = words.slice(i, i + len);
        i += len;
        if (i < words.length) {
          tokens.push([...particleParts, words[i]].join(" "));
          i++;
        } else {
          tokens.push(particleParts.join(" "));
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      tokens.push(words[i]);
      i++;
    }
  }

  return tokens;
}

/**
 * Apply title case to a single token, keeping particles lowercase
 * unless forceCapital is true (for given names at the start).
 * Handles hyphens: "MARTINEZ-ALMEIDA" → "Martinez-Almeida".
 */
function titleCaseToken(token: string, forceCapital: boolean): string {
  const parts = token.split(" ");

  let particleLen = 0;
  for (let len = Math.min(MAX_PARTICLE_WORDS, parts.length - 1); len >= 1; len--) {
    const candidate = parts.slice(0, len).join(" ");
    if (PARTICLES.has(candidate)) {
      particleLen = len;
      break;
    }
  }

  return parts.map((part, idx) => {
    const isParticlePart = idx < particleLen;
    if (isParticlePart && !forceCapital) {
      return part.toLowerCase();
    }
    return part
      .split("-")
      .map((seg) => (seg.length > 0 ? seg[0].toUpperCase() + seg.slice(1).toLowerCase() : seg))
      .join("-");
  }).join(" ");
}

/**
 * Convert a string to title case.
 * Consolidated from AdminHistoryTable.tsx and BormeSummaryCard.tsx.
 */
export function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Reorder a BORME-format name (COGNOMS NOM) to display format (Nom Cognoms)
 * and apply title case with particle-aware formatting.
 *
 * Logic:
 * 1. Split into words and group particles with the following word.
 * 2. First 2 tokens = cognoms, rest = nom(s) (Spanish/Catalan convention).
 *    - 1 token  → just the name (no reorder)
 *    - 2 tokens → 1 cognom + 1 nom
 *    - 3+ tokens → first 2 = cognoms, rest = nom(s)
 * 3. Apply title case, keeping particles lowercase in cognoms.
 *
 * Examples:
 *   "LAPORTA ESTRUCH JOAN"            → "Joan Laporta Estruch"
 *   "GARCIA LOPEZ MARIA TERESA"       → "Maria Teresa Garcia Lopez"
 *   "DE LA FUENTE GARCIA JUAN"        → "Juan de la Fuente Garcia"
 *   "VAN DER BERG JOHANNES"           → "Johannes van der Berg"
 *   "MARTINEZ-ALMEIDA NAVASQUES JOSE" → "Jose Martinez-Almeida Navasques"
 *   "GARCIA JOAN"                     → "Joan Garcia"
 *   "JOAN"                            → "Joan"
 */
export function formatPersonDisplayName(bormeName: string): string {
  const trimmed = bormeName.trim();
  if (!trimmed) return "";

  const words = trimmed.split(/\s+/);
  const tokens = tokenise(words);

  if (tokens.length <= 1) {
    return titleCaseToken(tokens[0], true);
  }

  let cognoms: string[];
  let noms: string[];

  if (tokens.length === 2) {
    cognoms = [tokens[0]];
    noms = [tokens[1]];
  } else {
    cognoms = tokens.slice(0, 2);
    noms = tokens.slice(2);
  }

  const formattedNoms = noms.map((t) => titleCaseToken(t, true)).join(" ");
  const formattedCognoms = cognoms.map((t) => titleCaseToken(t, false)).join(" ");

  return `${formattedNoms} ${formattedCognoms}`.trim();
}
