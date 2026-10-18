// Text fitting for the Poster wallpaper. Satori can't measure text, so we
// estimate line breaks from real glyph advances (measured once in a browser at
// 1000 px) and pick the largest size whose wrapped text fits its box.

// Archivo Black — advance widths per 1000 em.
const ARCHIVO: Record<string, number> = {
  " ": 333, A: 778, B: 778, C: 778, D: 778, E: 722, F: 667, G: 833, H: 833, I: 389, J: 667, K: 833, L: 667, M: 944,
  N: 833, O: 833, P: 722, Q: 833, R: 778, S: 722, T: 722, U: 833, V: 778, W: 1000, X: 778, Y: 778, Z: 722,
  "0": 667, "1": 667, "2": 667, "3": 667, "4": 667, "5": 667, "6": 667, "7": 667, "8": 667, "9": 667,
  ".": 333, ",": 333, ";": 333, ":": 333, "'": 278, '"': 500, "!": 333, "?": 611, "-": 333, "–": 500, "—": 1000,
  "’": 278, "‘": 278, "“": 500, "”": 500, "&": 889, "(": 389, ")": 389, "/": 278, "%": 1000, "+": 660, "@": 740, "#": 660, "*": 556,
};
// IBM Plex Sans Condensed 600.
const PLEX: Record<string, number> = {
  " ": 212, A: 606, B: 600, C: 581, D: 625, E: 544, F: 523, G: 641, H: 651, I: 387, J: 494, K: 614, L: 473, M: 737,
  N: 651, O: 642, P: 583, Q: 642, R: 601, S: 546, T: 524, U: 624, V: 583, W: 861, X: 595, Y: 566, Z: 540,
  a: 507, b: 544, c: 464, d: 544, e: 505, f: 328, g: 492, h: 532, i: 252, j: 255, k: 511, l: 268, m: 802, n: 532,
  o: 506, p: 544, q: 544, r: 357, s: 449, t: 334, u: 533, v: 476, w: 739, x: 488, y: 483, z: 452,
  "0": 540, "1": 540, "2": 540, "3": 540, "4": 540, "5": 540, "6": 540, "7": 540, "8": 540, "9": 540,
  ".": 274, ",": 274, ";": 282, ":": 282, "'": 235, '"': 429, "!": 284, "?": 447, "-": 362, "–": 528, "—": 702,
  "’": 269, "‘": 269, "“": 474, "”": 474, "&": 644, "(": 303, ")": 303, "/": 401, "%": 870, "+": 540, "@": 811, "#": 582, "*": 514,
};

type Face = { table: Record<string, number>; fallback: number; tracking: number };
export const HEAVY: Face = { table: ARCHIVO, fallback: 780, tracking: -0.035 };
export const HEAVY_LIST: Face = { table: ARCHIVO, fallback: 780, tracking: -0.03 };
export const COND: Face = { table: PLEX, fallback: 540, tracking: 0 };

const SAFETY = 0.97; // margin for glyph-width rounding

function width(text: string, size: number, f: Face): number {
  let w = 0;
  for (const ch of text) w += (f.table[ch] ?? f.fallback) + f.tracking * 1000;
  return (w / 1000) * size;
}

// Satori doesn't apply the font's kerning, so a space after an open-sided
// capital (PAY RENT, MERCY. THERE) looks doubled. Lines we break ourselves are
// drawn word by word with this gap instead of a space glyph.
// Archivo Black's own space (0.333 em) also reads loose at display sizes, so
// heavy text uses a tighter base gap.
const OPEN_RIGHT: Record<string, number> = { Y: 0.07, V: 0.05, W: 0.04, T: 0.04, K: 0.03, ".": 0.02, ",": 0.02 };
export function wordGap(word: string, size: number, f: Face): number {
  const last = word.slice(-1), prev = word.slice(-2, -1);
  const open = Math.max(OPEN_RIGHT[last] ?? 0, /[.,]/.test(last) ? (OPEN_RIGHT[prev] ?? 0) : 0);
  const base = f.table === ARCHIVO ? 0.24 * size : width(" ", size, f);
  return base - open * size;
}

/** Greedy line breaks for `text` inside `maxW`; null if one word alone is too wide. */
export function breakLines(text: string, size: number, maxW: number, f: Face): string[][] | null {
  const words = text.split(/\s+/).filter(Boolean);
  const limit = maxW * SAFETY;
  const lines: string[][] = [];
  let cur: string[] = [], curW = 0;
  for (const w of words) {
    const ww = width(w, size, f);
    if (ww > limit) return null;
    const gap = cur.length ? wordGap(cur[cur.length - 1], size, f) : 0;
    if (cur.length && curW + gap + ww > limit) { lines.push(cur); cur = [w]; curW = ww; }
    else { cur.push(w); curW += gap + ww; }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

/** Number of lines `text` wraps to inside `maxW`, or Infinity if one word alone is too wide. */
export function lineCount(text: string, size: number, maxW: number, f: Face): number {
  return breakLines(text, size, maxW, f)?.length ?? Infinity;
}

/** Largest size (stepping by 2) whose wrapped text fits a box. */
export function fitBlock(text: string, box: { w: number; h: number }, f: Face, lineHeight: number, max: number, min: number): number {
  for (let s = max; s >= min; s -= 2) {
    if (lineCount(text, s, box.w, f) * lineHeight * s <= box.h) return s;
  }
  return min;
}

/** Reminder list: largest size where every row (number + text, padding, rule) fits the column. */
export function fitList(texts: string[], hasMore: boolean, box: { w: number; h: number }, max: number, min: number): number {
  for (let s = max; s >= min; s -= 2) {
    const textW = box.w - 0.676 * s - 26;
    let h = 0;
    for (const t of texts) h += lineCount(t, s, textW, HEAVY_LIST) * 0.9 * s + 0.36 * s + 2;
    if (hasMore) h += 0.48 * s;
    if (h <= box.h) return s;
  }
  return min;
}
