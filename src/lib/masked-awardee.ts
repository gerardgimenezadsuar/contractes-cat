/**
 * Identity for awardees whose id is an anonymised DNI/NIE ("*** 0721 **").
 *
 * The open-data portal masks personal ids (mostly autònoms, also some foreign
 * VAT numbers), keeping only 4 digits. Only 10,000 values exist, so unrelated
 * people collide on the same masked id, and the same person shows up under
 * several mask layouts ("*** 0721 **", "*****0721****") and many spellings
 * ("XALABARDER MIRAMANDA, AVEL·LI", "AVELINO XALABARDER MIRAMANDA").
 *
 * Grouping by the masked id alone merges different people; grouping by exact
 * name splits one person into many. Instead, an awardee is identified by its
 * 4 digits plus a cluster of names judged to be the same person or company.
 *
 * Pure functions with no imports so they can be unit-tested with the Node
 * test runner directly (see tests/unit/masked-awardee.test.ts).
 */

/** The 4 digits kept by the mask, or null when the id is not a 4-digit mask. */
export function maskedDigits(id: string): string | null {
  if (!id.includes("*")) return null;
  const digits = id.replace(/\D/g, "");
  return digits.length === 4 ? digits : null;
}

// Legal-form tokens (after dots are removed, so "S.L." -> "SL", "B.V." -> "BV").
const LEGAL_FORMS = new Set([
  "SL", "SLU", "SLL", "SLP", "SA", "SAU", "SAL", "SCP", "SC", "SCCL", "CB", "COOP",
  "BV", "NV", "PLC", "LTD", "LIMITED", "LLC", "INC", "CORP", "GMBH", "AG", "KG",
  "SAS", "SARL", "SRL", "SPA", "AB", "OY", "AS", "APS", "LDA", "SPZOO",
]);

// Particles that carry no identity ("de", "i", "del"...).
const STOP_WORDS = new Set([
  "DE", "DEL", "DELS", "LA", "LES", "LOS", "LAS", "EL", "ELS", "I", "Y", "E",
  "DA", "DAS", "DO", "DOS", "VAN", "DER", "VON", "THE", "AND",
]);

export interface NameProfile {
  /** Significant tokens: folded, no particles, no legal forms, no numeric codes. */
  tokens: Set<string>;
  /** True when the name carries a legal form (SL, BV, PLC...). */
  company: boolean;
}

export function profileName(name: string): NameProfile {
  const folded = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    // "AVEL·LI" / "AVEL.LI" -> "AVELLI"; "S.L." -> "SL"
    .replace(/[·.’']/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  const tokens = new Set<string>();
  let company = false;
  for (const token of folded.split(" ")) {
    if (!token) continue;
    if (LEGAL_FORMS.has(token)) {
      company = true;
      continue;
    }
    if (STOP_WORDS.has(token) || /^\d+$/.test(token) || token.length < 2) continue;
    tokens.add(token);
  }
  return { tokens, company };
}

/** "AVELLI" ~ "AVELINO", "JOSE" ~ "JOSEP", "MIRAMAN" ~ "MIRAMANDA". */
function tokensCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  let common = 0;
  while (common < a.length && common < b.length && a[common] === b[common]) common++;
  return common >= 4 || (common >= 3 && common === Math.min(a.length, b.length));
}

/**
 * Whether two names that share the same masked digits belong to the same awardee.
 *
 * - People: at least two shared tokens (typically both surnames), and whatever
 *   is left over (the given name) must not contradict: one side has nothing
 *   left, or each leftover token of the shorter side has a compatible token on
 *   the other side. "GARCIA MARTINEZ JORDI" and "GARCIA MARTINEZ ANNA" stay apart.
 * - Companies: when either name has a legal form, one token set contained in
 *   the other is enough ("ABCAM" ~ "ABCAM (NETHERLANDS) B.V.").
 */
export function sameMaskedAwardee(a: NameProfile, b: NameProfile): boolean {
  const shared = [...a.tokens].filter((t) => b.tokens.has(t));
  if (shared.length === 0) return false;

  const leftA = [...a.tokens].filter((t) => !b.tokens.has(t));
  const leftB = [...b.tokens].filter((t) => !a.tokens.has(t));

  if (a.company || b.company) {
    const distinctive = shared.some((t) => t.length >= 4);
    if (distinctive && (leftA.length === 0 || leftB.length === 0)) return true;
  }

  if (shared.length < 2) return false;
  if (leftA.length === 0 || leftB.length === 0) return true;
  const [shorter, longer] = leftA.length <= leftB.length ? [leftA, leftB] : [leftB, leftA];
  return shorter.every((t) => longer.some((u) => tokensCompatible(t, u)));
}

export interface MaskedNameGroup {
  /** Raw masked id as published ("*** 0721 **"). */
  id: string;
  name: string;
  contracts: number;
  total: number;
}

export interface MaskedAwardeeCluster {
  digits: string;
  /** Most-used spelling, used as display name. */
  name: string;
  /** Masked id of the most-used spelling (for links). */
  id: string;
  /** Every (id, name) pair in the cluster. */
  members: MaskedNameGroup[];
  contracts: number;
  total: number;
}

/**
 * Cluster the (masked id, name) groups that share the same 4 digits.
 * Groups must all have the same digits. Clusters come out largest first.
 */
export function clusterMaskedAwardees(digits: string, groups: MaskedNameGroup[]): MaskedAwardeeCluster[] {
  // Same spelling (case/spacing/punctuation-insensitive) is always the same awardee,
  // whatever the mask layout: collapse those first, then compare distinct spellings.
  const bySpelling = new Map<string, MaskedNameGroup[]>();
  for (const group of groups) {
    const key = [...profileName(group.name).tokens].sort().join(" ") || group.name.trim().toUpperCase();
    const list = bySpelling.get(key);
    if (list) list.push(group);
    else bySpelling.set(key, [group]);
  }
  const spellings = [...bySpelling.values()];
  const profiles = spellings.map((list) => {
    // Profile of the spelling's largest group; `company` is true if any variant has a legal form.
    const base = profileName(list[0].name);
    return { tokens: base.tokens, company: list.some((g) => profileName(g.name).company) };
  });

  const parent = spellings.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < spellings.length; i++) {
    for (let j = i + 1; j < spellings.length; j++) {
      if (find(i) !== find(j) && sameMaskedAwardee(profiles[i], profiles[j])) {
        parent[find(i)] = find(j);
      }
    }
  }

  const clusters = new Map<number, MaskedNameGroup[]>();
  spellings.forEach((list, i) => {
    const root = find(i);
    const members = clusters.get(root);
    if (members) members.push(...list);
    else clusters.set(root, [...list]);
  });

  return [...clusters.values()]
    .map((members) => {
      const top = members.reduce((best, m) => (m.contracts > best.contracts ? m : best));
      return {
        digits,
        name: top.name,
        id: top.id,
        members,
        contracts: members.reduce((sum, m) => sum + m.contracts, 0),
        total: members.reduce((sum, m) => sum + m.total, 0),
      };
    })
    .sort((a, b) => b.contracts - a.contracts || b.total - a.total);
}

/**
 * The cluster a requested name belongs to: exact spelling first, then the
 * same-awardee rule. Without a name, the largest cluster.
 */
export function pickMaskedCluster(
  clusters: MaskedAwardeeCluster[],
  name?: string
): MaskedAwardeeCluster | null {
  if (clusters.length === 0) return null;
  const wanted = (name || "").trim();
  if (!wanted) return clusters[0];
  const upper = wanted.replace(/\s+/g, " ").toUpperCase();
  const exact = clusters.find((c) =>
    c.members.some((m) => m.name.trim().replace(/\s+/g, " ").toUpperCase() === upper)
  );
  if (exact) return exact;
  const profile = profileName(wanted);
  return clusters.find((c) => c.members.some((m) => sameMaskedAwardee(profile, profileName(m.name)))) ?? null;
}
