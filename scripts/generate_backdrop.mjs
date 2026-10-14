// Frost horizon backdrop → public/backdrops/frost-horizon.png
//
// Satori renders CSS gradients straight to 8-bit, and a dark navy gradient only
// has ~40 shades to spread over 2622 px, so it bands into visible stripes. This
// script computes the same backdrop in floating point and dithers it (TPDF noise,
// ±1 level) before rounding, so the eye averages the noise into a smooth ramp.
// Stops are joined with monotone cubic curves instead of straight segments,
// which also removes the creases at each stop.
//
//   node scripts/generate_backdrop.mjs [--amp 1] [--no-dither] [--out path]
//
// No dependencies: a minimal PNG encoder lives at the bottom.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? dflt : process.argv[i + 1];
};
const W = 1206, H = 2622;                       // iPhone 18 Pro
const AMP = process.argv.includes("--no-dither") ? 0 : +arg("amp", 1);
const OUT = arg("out", path.join(import.meta.dirname, "../public/backdrops/frost-horizon.png"));

// ── Vertical base: navy-black rising into glacier blue ───────────────────────
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const STOPS = [
  [0.00, "#030507"], [0.38, "#050A0F"], [0.58, "#08131C"],
  [0.76, "#0E2333"], [0.90, "#1A3B50"], [1.00, "#2B5670"],
].map(([t, c]) => [t, hex(c)]);

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
const base = [0, 1, 2].map(c => monotone(STOPS.map(s => s[0]), STOPS.map(s => s[1][c])));

// ── Horizon glow: ellipse centred below the screen's bottom edge ─────────────
const GLOW = { cx: W / 2, cy: H - 170, rx: 1136 * 0.53, ry: 778 * 0.53, alpha: 0.55,
               inner: [214, 234, 246], outer: [159, 203, 234] };

// ── Ice streaks: 2px lines every 46px at 168°, fading out upward ─────────────
const STREAK = { period: 46, width: 2, alpha: 0.035, height: 520,
                 dx: Math.sin(168 * Math.PI / 180), dy: -Math.cos(168 * Math.PI / 180) };

const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

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
  const ty = (y + 0.5) / H;
  const row = base.map(f => f(ty));
  for (let x = 0; x < W; x++) {
    let [r, g, b] = row;

    // glow (alpha-over, in sRGB like the browser)
    const ex = (x + 0.5 - GLOW.cx) / GLOW.rx, ey = (y + 0.5 - GLOW.cy) / GLOW.ry;
    const d = Math.sqrt(ex * ex + ey * ey);
    if (d < 1) {
      const a = GLOW.alpha * (1 - d * d) ** 2;
      const k = smooth(d);
      r += (GLOW.inner[0] + (GLOW.outer[0] - GLOW.inner[0]) * k - r) * a;
      g += (GLOW.inner[1] + (GLOW.outer[1] - GLOW.inner[1]) * k - g) * a;
      b += (GLOW.inner[2] + (GLOW.outer[2] - GLOW.inner[2]) * k - b) * a;
    }

    // streaks (4× supersampled along the stripe axis for clean edges)
    const fromBottom = H - y;
    if (fromBottom < STREAK.height) {
      let cover = 0;
      for (let s = 0; s < 4; s++) {
        const p = (x + 0.5) * STREAK.dx + (y + 0.125 + s * 0.25) * STREAK.dy;
        if (((p % STREAK.period) + STREAK.period) % STREAK.period < STREAK.width) cover += 0.25;
      }
      const a = STREAK.alpha * cover * (1 - fromBottom / STREAK.height);
      r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a;
    }

    // TPDF dither, then quantise
    const i = (y * W + x) * 3;
    px[i]     = Math.max(0, Math.min(255, Math.round(r + AMP * (rand() - rand()))));
    px[i + 1] = Math.max(0, Math.min(255, Math.round(g + AMP * (rand() - rand()))));
    px[i + 2] = Math.max(0, Math.min(255, Math.round(b + AMP * (rand() - rand()))));
  }
}

// ── PNG encode (RGB8, Paeth filter on every row) ─────────────────────────────
function encodePNG(w, h, rgb) {
  const stride = w * 3, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 4;
    for (let x = 0; x < stride; x++) {
      const v = rgb[y * stride + x];
      const a = x >= 3 ? rgb[y * stride + x - 3] : 0;
      const b = y ? rgb[(y - 1) * stride + x] : 0;
      const c = x >= 3 && y ? rgb[(y - 1) * stride + x - 3] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      raw[y * (stride + 1) + 1 + x] = (v - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
    }
  }
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
  });
  const crc = buf => { let c = ~0; for (const v of buf) c = table[(c ^ v) & 255] ^ (c >>> 8); return ~c >>> 0; };
  const chunk = (type, data) => {
    const t = Buffer.from(type), len = Buffer.alloc(4), sum = Buffer.alloc(4);
    len.writeUInt32BE(data.length); sum.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const png = encodePNG(W, H, px);
fs.writeFileSync(OUT, png);
console.log(`${OUT}  ${W}×${H}  dither ±${AMP}  ${(png.length / 1024).toFixed(0)} KB`);
