// Wallpaper backdrops → public/backdrops/<preset>.png
//
// Satori renders CSS gradients straight to 8-bit, and a dark navy gradient only
// has a few dozen shades to spread over 2622 px, so it bands into visible
// stripes. This script computes the backdrop in floating point and dithers it
// (TPDF noise, ±1 level) before rounding, so the eye averages the noise into a
// smooth ramp. Stops are joined with monotone cubic curves instead of straight
// segments, which also removes the creases at each stop.
//
//   node scripts/generate_backdrop.mjs [--preset poster-navy|frost-horizon] [--amp 1] [--no-dither] [--out path]
//
// poster-navy reads its colours from lib/poster-theme.json.

import fs from "node:fs";
import path from "node:path";
import { encodePNG } from "./lib/png.mjs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? dflt : process.argv[i + 1];
};
const W = 1206, H = 2622;                       // iPhone 18 Pro
const PRESET = arg("preset", "poster-navy");
const AMP = process.argv.includes("--no-dither") ? 0 : +arg("amp", 1);
const OUT = arg("out", path.join(import.meta.dirname, `../public/backdrops/${PRESET}.png`));
const THEME = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../lib/poster-theme.json"), "utf8"));

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

// Fritsch–Carlson monotone cubic: smooth through the stops, never overshoots.
function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
         + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const ramp = stops => {
  const s = stops.map(([t, c]) => [t, hex(c)]);
  const f = [0, 1, 2].map(c => monotone(s.map(x => x[0]), s.map(x => x[1][c])));
  return t => f.map(g => g(t));
};
const over = (px, col, a) => { px[0] += (col[0] - px[0]) * a; px[1] += (col[1] - px[1]) * a; px[2] += (col[2] - px[2]) * a; };

const PRESETS = {
  // Navy poster: vertical navy ramp + one faint diagonal sheen, like light across a panel.
  "poster-navy": () => {
    const base = ramp([[0, THEME.bg.top], [0.55, THEME.bg.mid], [1, THEME.bg.bot]]);
    const ang = 118 * Math.PI / 180, dx = Math.sin(ang), dy = -Math.cos(ang);
    const len = Math.abs(W * dx) + Math.abs(H * dy);
    return (x, y) => {
      const px = base((y + 0.5) / H);
      const t = ((x + 0.5 - W / 2) * dx + (y + 0.5 - H / 2) * dy) / len + 0.5;
      const a = THEME.bg.sheen * (t < 0.47 ? smooth((t - 0.30) / 0.17) : smooth((0.64 - t) / 0.17));
      if (a > 0) over(px, [255, 255, 255], a);
      return px;
    };
  },

  // Frost horizon (previous design): navy-black rising into a glacier glow, with ice streaks.
  "frost-horizon": () => {
    const base = ramp([[0, "#030507"], [0.38, "#050A0F"], [0.58, "#08131C"], [0.76, "#0E2333"], [0.90, "#1A3B50"], [1, "#2B5670"]]);
    const G = { cx: W / 2, cy: H - 170, rx: 602, ry: 412, alpha: 0.55, inner: [214, 234, 246], outer: [159, 203, 234] };
    const S = { period: 46, width: 2, alpha: 0.035, height: 520, dx: Math.sin(168 * Math.PI / 180), dy: -Math.cos(168 * Math.PI / 180) };
    return (x, y) => {
      const px = base((y + 0.5) / H);
      const ex = (x + 0.5 - G.cx) / G.rx, ey = (y + 0.5 - G.cy) / G.ry, d = Math.sqrt(ex * ex + ey * ey);
      if (d < 1) {
        const k = smooth(d);
        over(px, G.inner.map((v, i) => v + (G.outer[i] - v) * k), G.alpha * (1 - d * d) ** 2);
      }
      const fromBottom = H - y;
      if (fromBottom < S.height) {
        let cover = 0;
        for (let s = 0; s < 4; s++) {
          const p = (x + 0.5) * S.dx + (y + 0.125 + s * 0.25) * S.dy;
          if (((p % S.period) + S.period) % S.period < S.width) cover += 0.25;
        }
        over(px, [255, 255, 255], S.alpha * cover * (1 - fromBottom / S.height));
      }
      return px;
    };
  },
};

if (!PRESETS[PRESET]) throw new Error(`unknown preset ${PRESET}; try ${Object.keys(PRESETS).join(", ")}`);
const shade = PRESETS[PRESET]();

// Deterministic PRNG so the file is reproducible.
let seed = 0x9e3779b9;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const px = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const [r, g, b] = shade(x, y), i = (y * W + x) * 3;
    px[i]     = Math.max(0, Math.min(255, Math.round(r + AMP * (rand() - rand()))));
    px[i + 1] = Math.max(0, Math.min(255, Math.round(g + AMP * (rand() - rand()))));
    px[i + 2] = Math.max(0, Math.min(255, Math.round(b + AMP * (rand() - rand()))));
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const png = encodePNG(W, H, px);
fs.writeFileSync(OUT, png);
console.log(`${OUT}  ${W}×${H}  ${PRESET}  dither ±${AMP}  ${(png.length / 1024).toFixed(0)} KB`);
