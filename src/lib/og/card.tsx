import { ImageResponse } from "next/og";
import { BRAND_MINT, BRAND_TEAL, LogoMark } from "@/components/brand/Logo";

/**
 * Shared social card (Open Graph / X) in the site's design: Source Serif
 * headings, Geist text, teal accent, hairline figures. 1200×630 is what every
 * network crops from; keep content away from the outer ~40px.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const INK = "#111827";
const MUTED = "#4b5563";
const FAINT = "#6b7280";
const HAIRLINE = "#e5e7eb";
const ACCENT_SOFT = "#e6f2f1";

type FontSpec = { name: string; family: string; weight: 400 | 600 };
// Sans is Inter rather than the site's Geist: the renderer misapplies Geist's
// kerning around spaces (visibly uneven word gaps). Inter renders cleanly and is close.
const FONTS: FontSpec[] = [
  { name: "Sans", family: "Inter", weight: 400 },
  { name: "Sans", family: "Inter", weight: 600 },
  { name: "Serif", family: "Source Serif 4", weight: 600 },
];

type LoadedFont = { name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" };
let fontsPromise: Promise<LoadedFont[]> | null = null;

/**
 * TrueType files from Google Fonts (a plain fetch, without a browser UA, gets
 * TTF, which the image renderer needs; it can't read woff2). Cached per server
 * instance. On any failure the card renders with the built-in font instead of erroring.
 */
async function loadFonts(): Promise<LoadedFont[]> {
  const load = async (spec: FontSpec): Promise<LoadedFont | null> => {
    try {
      const family = spec.family.replace(/ /g, "+");
      const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${spec.weight}`, {
        signal: AbortSignal.timeout(4000),
      }).then((r) => (r.ok ? r.text() : ""));
      const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
      if (!url) return null;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      return { name: spec.name, data: await res.arrayBuffer(), weight: spec.weight, style: "normal" };
    } catch {
      return null;
    }
  };
  const fonts = (await Promise.all(FONTS.map(load))).filter((f): f is LoadedFont => f !== null);
  // Don't keep a failed load for the life of the instance: retry on the next card.
  if (fonts.length < FONTS.length) fontsPromise = null;
  return fonts;
}

function getFonts(): Promise<LoadedFont[]> {
  fontsPromise ??= loadFonts();
  return fontsPromise;
}

export interface CardFigure {
  label: string;
  value: string;
}

export interface CardProps {
  /** Small teal label above the title, e.g. "Empresa adjudicatària". */
  eyebrow: string;
  title: string;
  /** One or two plain sentences under the title. */
  summary?: string;
  /** Up to 3 key figures, shown in a hairline row. */
  figures: CardFigure[];
  /** Data source line in the footer. */
  source: string;
}

/** Title size that keeps long names to about two lines. */
function titleSize(title: string): number {
  const n = title.length;
  if (n <= 24) return 76;
  if (n <= 36) return 64;
  if (n <= 52) return 54;
  return 46;
}

/** Shortens at a word boundary, with an ellipsis. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:·]+$/, "")}…`;
}

/** The linked-dots mark, oversized and faint, as a corner motif. */
function CornerMotif() {
  return (
    <svg
      width={420}
      height={420}
      viewBox="0 0 64 64"
      style={{ position: "absolute", right: -110, top: -120, opacity: 0.07 }}
    >
      <path d="M45 20.5A16 16 0 1 0 45 43.5" fill="none" stroke={BRAND_TEAL} strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="45" cy="20.5" r="5.5" fill={BRAND_TEAL} />
      <circle cx="18" cy="32" r="5.5" fill={BRAND_TEAL} />
      <circle cx="45" cy="43.5" r="5.5" fill={BRAND_TEAL} />
    </svg>
  );
}

function Card({ eyebrow, title, summary, figures, source }: CardProps) {
  const shownTitle = clip(title, 80);
  const size = titleSize(shownTitle);
  // Two lines of a large title leave room for about one line of summary
  // (~0.5em average glyph width over the ~1000px text column).
  const titleWraps = shownTitle.length * size * 0.5 > 1000;
  const summaryMax = titleWraps && size >= 60 ? 80 : 150;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
        fontFamily: "Sans",
        color: INK,
      }}
    >
      <div style={{ display: "flex", height: 12, width: "100%" }}>
        <div style={{ display: "flex", flex: 5, background: BRAND_TEAL }} />
        <div style={{ display: "flex", flex: 1, background: BRAND_MINT }} />
      </div>
      <CornerMotif />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "44px 72px 48px" }}>
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <LogoMark size={46} />
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em" }}>
            <span>contractes</span>
            <span style={{ color: BRAND_TEAL }}>.cat</span>
          </div>
        </div>

        {/* Title block */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40, maxWidth: 1000 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              fontSize: 19,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: BRAND_TEAL,
              background: ACCENT_SOFT,
              borderRadius: 999,
              padding: "6px 16px",
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontFamily: "Serif",
              fontWeight: 600,
              fontSize: size,
              lineHeight: 1.08,
              letterSpacing: "-0.01em",
            }}
          >
            {shownTitle}
          </div>
          {summary ? (
            <div style={{ display: "flex", marginTop: 16, fontSize: 26, lineHeight: 1.35, color: MUTED }}>
              {clip(summary, summaryMax)}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        {/* Figures */}
        {figures.length > 0 ? (
          <div style={{ display: "flex", borderTop: `2px solid ${HAIRLINE}`, paddingTop: 22 }}>
            {figures.slice(0, 3).map((figure, i) => (
              <div
                key={figure.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  paddingLeft: i === 0 ? 0 : 28,
                  borderLeft: i === 0 ? "none" : `2px solid ${HAIRLINE}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 17,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: FAINT,
                  }}
                >
                  {figure.label}
                </div>
                <div style={{ display: "flex", marginTop: 6, fontFamily: "Serif", fontWeight: 600, fontSize: 50 }}>
                  {figure.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ display: "flex", marginTop: 22, fontSize: 18, color: FAINT }}>{source}</div>
      </div>
    </div>
  );
}

export async function renderCard(props: CardProps): Promise<ImageResponse> {
  const fonts = await getFonts();
  return new ImageResponse(<Card {...props} />, { ...OG_SIZE, fonts });
}
