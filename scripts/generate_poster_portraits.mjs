// Poster portraits → public/portraits/poster/<slug>.jpg (700×960) and <slug>-sq.jpg (300×300)
//
// For every person in scripts/poster-portraits.json:
//   1. find the face with Apple Vision (scripts/detect_faces.swift)
//   2. crop head-and-shoulders (tall) and a tight square around it
//   3. grade: hard S-curve, film grain, then duotone in the palette's photo colours
// Faces are cached in scripts/poster-faces.json; add "crop": [x, y, w, h] to a
// person in poster-portraits.json to override the tall crop by hand.
//
//   node scripts/generate_poster_portraits.mjs [slug ...]
//
// macOS only (uses sips + swift). No npm dependencies.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { encodePNG, decodeBMP } from "./lib/png.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/poster-portraits.json"), "utf8"));
const THEME = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/poster-theme.json"), "utf8"));
const FACES = path.join(ROOT, "scripts/poster-faces.json");
const OUT = path.join(ROOT, "public/portraits/poster");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "poster-"));

const TALL = { w: 700, h: 960 };
const SQ = 300;

const only = process.argv.slice(2);
const people = MANIFEST.people.filter(p => !only.length || only.includes(p.slug));
const srcOf = p => path.join(ROOT, "portrait-src", p.commons ? `poster/${p.slug}.jpg` : p.local);

// ── 1. faces (cached) ──
const faces = fs.existsSync(FACES) ? JSON.parse(fs.readFileSync(FACES, "utf8")) : {};
const missing = people.filter(p => !faces[p.slug]);
if (missing.length) {
  const out = execFileSync("swift", [path.join(ROOT, "scripts/detect_faces.swift"), ...missing.map(srcOf)], { encoding: "utf8" });
  out.trim().split("\n").map(l => JSON.parse(l)).forEach((r, i) => {
    if (!r.face) throw new Error(`no face found in ${r.file} — add "crop" to its manifest entry`);
    faces[missing[i].slug] = { w: r.w, h: r.h, face: r.face };
  });
  fs.writeFileSync(FACES, JSON.stringify(faces, null, 2) + "\n");
}

// ── 2. crops ──
function fit(cx, top, W, H, imgW, imgH) {
  if (W > imgW) { H *= imgW / W; W = imgW; }
  if (H > imgH) { W *= imgH / H; H = imgH; }
  const x = Math.min(Math.max(0, cx - W / 2), imgW - W), y = Math.min(Math.max(0, top), imgH - H);
  return [Math.round(x), Math.round(y), Math.round(W), Math.round(H)];
}
function crops(p) {
  const { w, h, face: [fx, fy, fw, fh] } = faces[p.slug];
  const cx = fx + fw / 2;
  const tallH = fh * 2.9;
  const tall = p.crop ?? fit(cx, fy - fh * 0.62, tallH * TALL.w / TALL.h, tallH, w, h);
  const s = fh * 1.7;
  const sq = fit(cx, fy + fh * 0.48 - s / 2, s, s, w, h);
  return { tall, sq };
}

// ── 3. grade ──
const curve = (v, k) => 1 / (1 + Math.exp(-k * (v - 0.5)));
const lo = curve(0, 8), hi = curve(1, 8);
function grade({ w, h, rgb }, seed) {
  const [dr, dg, db] = THEME.photo.dark, [lr, lg, lb] = THEME.photo.light;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const L = (0.3 * rgb[i * 3] + 0.59 * rgb[i * 3 + 1] + 0.11 * rgb[i * 3 + 2]) / 255;
    let t = (curve(L, 8) - lo) / (hi - lo) + (rnd() - 0.5) * 0.045;
    t = Math.min(1, Math.max(0, t));
    out[i * 3] = dr + (lr - dr) * t; out[i * 3 + 1] = dg + (lg - dg) * t; out[i * 3 + 2] = db + (lb - db) * t;
  }
  return out;
}

const sips = (...a) => execFileSync("sips", a, { stdio: "ignore" });
function render(src, [x, y, w, h], outW, outH, dest, seed) {
  const cropJpg = path.join(TMP, "crop.jpg"), bmp = path.join(TMP, "crop.bmp"), png = path.join(TMP, "out.png");
  sips("-s", "format", "jpeg", "-c", String(h), String(w), "--cropOffset", String(y), String(x), src, "--out", cropJpg);
  sips("-z", String(outH), String(outW), "-s", "format", "bmp", cropJpg, "--out", bmp);
  const img = decodeBMP(fs.readFileSync(bmp));
  fs.writeFileSync(png, encodePNG(img.w, img.h, grade(img, seed)));
  sips("-s", "format", "jpeg", "-s", "formatOptions", "84", png, "--out", dest);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [n, p] of people.entries()) {
  const { tall, sq } = crops(p);
  const seed = 1000 + [...p.slug].reduce((a, c) => a + c.charCodeAt(0), 0);
  render(srcOf(p), tall, TALL.w, TALL.h, path.join(OUT, `${p.slug}.jpg`), seed);
  render(srcOf(p), sq, SQ, SQ, path.join(OUT, `${p.slug}-sq.jpg`), seed + 1);
  console.log(`${String(n + 1).padStart(2)}/${people.length} ${p.slug}  tall ${tall.join(",")}  sq ${sq.join(",")}`);
}

// ── credits ──
const lines = MANIFEST.people.map(p => {
  const file = p.commons ?? (p.author.match(/Commons: ([^)]+)\)/)?.[1]);
  const link = file ? `[${file.replace(/_/g, " ")}](https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)})` : p.local;
  return `| ${p.slug} | ${link} | ${p.author.replace(/ \(Wikimedia Commons:.*\)/, "")} | ${p.license} |`;
});
fs.writeFileSync(path.join(ROOT, "CREDITS.md"), `# Photo credits

Speaker photos on the wallpaper are cropped and toned versions of the files below
(generated by \`scripts/generate_poster_portraits.mjs\`). Licences apply to the
derived images in \`public/portraits/poster/\` too.

| Speaker | Source | Author | Licence |
|---|---|---|---|
${lines.join("\n")}
`);
fs.rmSync(TMP, { recursive: true, force: true });
console.log("wrote CREDITS.md");
