/**
 * contractes.cat brand. The mark is a "c" drawn as a chain of three linked
 * companies: the arc is the link, the dots are the companies. Geometry is
 * shared with scripts/generate-icons.mjs, which renders the favicon and app
 * icons from MARK_SVG; keep both in sync.
 */

export const BRAND_TEAL = "#0f5e63";
export const BRAND_MINT = "#9fe0dc";

/** Standalone SVG of the mark (64×64), for icon generation and OG images. */
export const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="${BRAND_TEAL}"/><path d="M45 20.5A16 16 0 1 0 45 43.5" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/><circle cx="45" cy="20.5" r="5.5" fill="${BRAND_MINT}"/><circle cx="18" cy="32" r="5.5" fill="#fff"/><circle cx="45" cy="43.5" r="5.5" fill="${BRAND_MINT}"/></svg>`;

export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={className}>
      <rect width="64" height="64" rx="15" fill={BRAND_TEAL} />
      <path d="M45 20.5A16 16 0 1 0 45 43.5" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="45" cy="20.5" r="5.5" fill={BRAND_MINT} />
      <circle cx="18" cy="32" r="5.5" fill="#fff" />
      <circle cx="45" cy="43.5" r="5.5" fill={BRAND_MINT} />
    </svg>
  );
}

/** Mark + wordmark, as used in the header. */
export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="text-[1.3rem] font-bold leading-none tracking-[-0.035em] text-gray-900 md:text-[1.4rem]">
        contractes<span className="text-accent">.cat</span>
      </span>
    </span>
  );
}
