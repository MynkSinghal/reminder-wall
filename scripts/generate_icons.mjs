// App icons from lib/logo-mark.json — the one source for the mark.
//
//   app/icon.svg          vector favicon for modern browsers
//   app/favicon.ico       16 / 32 / 48 px (PNG-in-ICO) for everything else
//   app/apple-icon.png    180 px, full-bleed square (iOS rounds the corners itself)
//   public/icon-192.png   web manifest
//   public/icon-512.png   web manifest
//
//   node scripts/generate_icons.mjs
//
// The mark is plain rectangles, so it's rasterised here directly (4×4
// supersampling) instead of pulling in an image library.

import fs from "node:fs";
import path from "node:path";
import { encodePNG } from "./lib/png.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const MARK = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/logo-mark.json"), "utf8"));
const G = MARK.grid;
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const TOP = hex(MARK.tile.top), BOT = hex(MARK.tile.bottom), INK = hex(MARK.ink);

// ── SVG ──
const svg = (radius) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${G} ${G}">
  <defs>
    <linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${MARK.tile.top}"/><stop offset="1" stop-color="${MARK.tile.bottom}"/></linearGradient>
    <clipPath id="c"><rect width="${G}" height="${G}" rx="${radius}"/></clipPath>
  </defs>
  <rect width="${G}" height="${G}" rx="${radius}" fill="url(#t)"/>
  <g clip-path="url(#c)" fill="${MARK.ink}">
${MARK.bars.map(b => `    <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"${b.opacity < 1 ? ` opacity="${b.opacity}"` : ""}/>`).join("\n")}
  </g>
</svg>
`;

// ── raster ──
function insideRounded(x, y, r) {
  if (r <= 0) return x >= 0 && y >= 0 && x < G && y < G;
  const cx = Math.min(Math.max(x, r), G - r), cy = Math.min(Math.max(y, r), G - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function raster(size, radius) {
  const out = Buffer.alloc(size * size * 4), SS = 4, k = G / size;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const x = (px + (sx + 0.5) / SS) * k, y = (py + (sy + 0.5) / SS) * k;
      if (!insideRounded(x, y, radius)) continue;
      const t = y / G;
      let c = TOP.map((v, i) => v + (BOT[i] - v) * t);
      for (const bar of MARK.bars)
        if (x >= bar.x && x < bar.x + bar.w && y >= bar.y && y < bar.y + bar.h)
          c = c.map((v, i) => v + (INK[i] - v) * bar.opacity);
      r += c[0]; g += c[1]; b += c[2]; a += 1;
    }
    const i = (py * size + px) * 4;
    if (a) { out[i] = r / a; out[i + 1] = g / a; out[i + 2] = b / a; }   // colour = mean of covered samples
    out[i + 3] = (a / (SS * SS)) * 255;
  }
  return encodePNG(size, size, out, 4);
}

// ── ICO (PNG entries) ──
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head[e] = size >= 256 ? 0 : size; head[e + 1] = size >= 256 ? 0 : size;
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map(p => p.data)]);
}

const write = (rel, data) => { fs.writeFileSync(path.join(ROOT, rel), data); console.log(`${rel}  ${(data.length / 1024).toFixed(1)} KB`); };
write("app/icon.svg", svg(MARK.radius));
write("app/favicon.ico", ico([16, 32, 48].map(size => ({ size, data: raster(size, MARK.radius) }))));
write("app/apple-icon.png", raster(180, 0));
write("public/icon-192.png", raster(192, MARK.radius));
write("public/icon-512.png", raster(512, MARK.radius));
