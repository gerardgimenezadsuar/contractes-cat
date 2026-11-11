/**
 * Page-level A/B split. Entity pages are ISR-cached and shared by every visitor,
 * so the variant is a pure function of the page (not of the visitor): no cookies,
 * no cache fragmentation, and each page always renders the same way.
 */
export type Variant = "a" | "b";

/**
 * FNV-1a 32-bit plus the murmur3 finalizer. Plain FNV-1a's low bit is just the
 * parity of the input's characters, so without the final mix `% 2` would split
 * pages by letter parity instead of at random.
 */
function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** Variant for a page key; the experiment name salts the hash so tests don't share splits. */
export function pageVariant(experiment: string, pageKey: string): Variant {
  return hash32(`${experiment}:${pageKey}`) % 2 === 0 ? "a" : "b";
}

// Past tests: person_strip (Nov 2026, person pages, top-companies strip) -> b shipped.
