// Reminder encoder — "alternating flip + skeleton + reversed order".
// English lives in the UI + Redis; this runs ONLY at wallpaper render time.
//
// Rules:
//  1. lowercase, strip punctuation
//  2. alternate by word position: 1st word letter-REVERSED, 2nd kept,
//     3rd REVERSED, 4th kept, ... (odd positions flip, even stay)
//  3. words of 5+ letters are then compressed to a skeleton:
//     first + last letter kept, middle consonants deduped (≤3, or ≤5 for very
//     long words), one middle vowel kept in place if consonants run short
//  4. finally the whole line's WORD ORDER is reversed
//  Tokens containing digits/symbols (5pm, ₹500) pass through untouched.
//
//  "Hello He Has Houses"             →  "hoss sah he olh"
//  "Need to finish project tomorrow" →  "wrmt prjct hsnf to deen"
//  "Call mom at 5pm about rent"      →  "tner about 5pm ta mom llac"

const VOWELS = new Set("aeiou");

function dedupeConsecutive(s: string): string {
  let out = "";
  for (const ch of s) if (ch !== out[out.length - 1]) out += ch;
  return out;
}

function skeleton(w0: string): string {
  const w = dedupeConsecutive(w0);
  if (w.length <= 3) return w;
  const first = w[0];
  const last = w[w.length - 1];
  const middle = w.slice(1, -1);

  const seen = new Set<string>();
  let picks: Array<[string, number]> = [];
  for (let i = 0; i < middle.length; i++) {
    const ch = middle[i];
    if (!VOWELS.has(ch) && !seen.has(ch)) { picks.push([ch, i]); seen.add(ch); }
  }
  const cap = w0.length >= 10 ? 5 : 3;
  picks = picks.slice(0, cap);
  if (picks.length < 2) {
    const vi = [...middle].findIndex(ch => VOWELS.has(ch));
    if (vi >= 0) {
      picks.push([middle[vi], vi]);
      picks.sort((a, b) => a[1] - b[1]);
    }
  }
  return first + picks.map(p => p[0]).join("") + last;
}

export function encodeReminder(text: string): string {
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map(tok => tok.replace(/[.,!?;:'"“”‘’()[\]{}]/g, ""))
    .filter(Boolean)
    .map((clean, i) => {
      if (!/^[a-z]+$/.test(clean)) return clean; // digits / symbols → untouched
      const flipped = i % 2 === 0 ? [...clean].reverse().join("") : clean;
      return clean.length >= 5 ? skeleton(flipped) : flipped;
    });
  return words.reverse().join(" ");
}

export const SETTINGS_KEY = "settings";
export interface Settings { codeMode?: boolean }
