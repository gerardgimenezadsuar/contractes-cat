// Renders the favicon and app icons from the brand mark.
// Usage: node scripts/generate-icons.mjs
// The mark geometry mirrors src/components/brand/Logo.tsx; keep both in sync.
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const TEAL = "#0f5e63";
const MINT = "#9fe0dc";
const GLYPH = `<path d="M45 20.5A16 16 0 1 0 45 43.5" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/><circle cx="45" cy="20.5" r="5.5" fill="${MINT}"/><circle cx="18" cy="32" r="5.5" fill="#fff"/><circle cx="45" cy="43.5" r="5.5" fill="${MINT}"/>`;

// Rounded tile: browser tabs, PWA "any" icons, and the SVG favicon.
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="${TEAL}"/>${GLYPH}</svg>`;
// Full-bleed square: the platform applies its own mask (iOS, Android maskable).
// Maskable keeps the glyph inside the central 80 % safe zone.
const square = (scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${TEAL}"/><g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${GLYPH}</g></svg>`;

const png = (svg, size) => sharp(Buffer.from(svg), { density: 72 * (size / 64) * 4 }).resize(size, size).png().toBuffer();

/** ICO container holding PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

await writeFile("public/icon.svg", rounded);
await writeFile("public/icons/icon-192.png", await png(rounded, 192));
await writeFile("public/icons/icon-512.png", await png(rounded, 512));
await writeFile("public/icons/icon-512-maskable.png", await png(square(0.78), 512));
await writeFile("public/icons/apple-touch-icon.png", await png(square(0.86), 180));
const sizes = [16, 32, 48];
await writeFile("src/app/favicon.ico", ico(await Promise.all(sizes.map(async (size) => ({ size, data: await png(rounded, size) })))));
console.log("icons written");
