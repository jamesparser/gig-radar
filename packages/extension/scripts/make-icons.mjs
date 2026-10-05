// Renders the GigRadar radar mark to PNG icons. One-off: the PNGs are committed in src/icons.
// Needs `sharp` (installed transitively by Next.js).  Usage: node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "../src/icons");
mkdirSync(out, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#0a0f12"/>
  <circle cx="64" cy="64" r="48" fill="none" stroke="#2dd4bf" stroke-width="7"/>
  <circle cx="64" cy="64" r="28" fill="none" stroke="#2dd4bf" stroke-opacity=".55" stroke-width="7"/>
  <path d="M64 64 L98 30" stroke="#2dd4bf" stroke-width="9" stroke-linecap="round"/>
  <circle cx="64" cy="64" r="8" fill="#2dd4bf"/>
  <circle cx="92" cy="82" r="6" fill="#7ee787"/>
</svg>`;
writeFileSync(join(out, "icon.svg"), svg);
for (const size of [16, 32, 48, 128]) {
  await sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toFile(join(out, `icon-${size}.png`));
}
console.log("icons written to", out);
