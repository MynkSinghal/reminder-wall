// Browser-side version of scripts/generate_poster_portraits.mjs, for photos
// uploaded from the dashboard: crop, hard S-curve, grain, navy duotone.
// Produces the same 700×960 photo and 300×300 thumb the wallpaper expects.
import THEME from "@/lib/poster-theme.json";

export interface Framing { zoom: number; x: number; y: number }   // zoom ≥ 1, x/y in −1…1

const TALL = { w: 700, h: 960 };
const curve = (v: number) => 1 / (1 + Math.exp(-8 * (v - 0.5)));
const LO = curve(0), HI = curve(1);

function grade(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h), p = img.data;
  const [dr, dg, db] = THEME.photo.dark, [lr, lg, lb] = THEME.photo.light;
  let s = 12345;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < p.length; i += 4) {
    const L = (0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]) / 255;
    const t = Math.min(1, Math.max(0, (curve(L) - LO) / (HI - LO) + (rnd() - 0.5) * 0.045));
    p[i] = dr + (lr - dr) * t; p[i + 1] = dg + (lg - dg) * t; p[i + 2] = db + (lb - db) * t;
  }
  ctx.putImageData(img, 0, 0);
}

/** The tall crop box (source pixels) for a framing. */
export function tallBox(img: HTMLImageElement, f: Framing) {
  const aspect = TALL.w / TALL.h;
  let h = img.height / f.zoom, w = h * aspect;
  if (w > img.width / f.zoom) { w = img.width / f.zoom; h = w / aspect; }
  const x = (img.width - w) / 2 + f.x * (img.width - w) / 2;
  const y = (img.height - h) / 2 + f.y * (img.height - h) / 2;
  return { x, y, w, h };
}

function render(img: HTMLImageElement, box: { x: number; y: number; w: number; h: number }, W: number, H: number) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, W, H);
  grade(ctx, W, H);
  return c.toDataURL("image/jpeg", 0.84);
}

/** Photo + thumb as JPEG data URIs. The thumb is a square from the upper part of the crop, where the face usually is. */
export function makePosterPhoto(img: HTMLImageElement, f: Framing) {
  const t = tallBox(img, f);
  const side = t.w * 0.86;
  const sq = { x: t.x + (t.w - side) / 2, y: t.y + t.h * 0.06, w: side, h: side };
  return { photo: render(img, t, TALL.w, TALL.h), thumb: render(img, sq, 300, 300) };
}
