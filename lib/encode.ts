// Reminder encoder — "skeleton + flip" scheme.
// English lives in the UI + Redis; this runs ONLY at wallpaper render time.
//
// Rules:
//  1. lowercase, strip punctuation
//  2. short words (1–5 letters): reverse the letters   (need → deen, at → ta)
//  3. long words (6+ letters): consonant skeleton, NOT reversed
//     (first + last letter, middle consonants deduped, ≤3 middle — ≤5 for 10+
//      letter words; keep one vowel if too few consonants)
//     finish → fnsh, project → prjct, tomorrow → tmrw, meeting → mtng
//  4. reverse the WORD ORDER of the whole line
//  Tokens containing digits/symbols/emoji (5pm, ₹500) pass through untouched.
//
//  "Need to finish project tomorrow"  →  "tmrw prjct fnsh ot deen"
//  "Call mom at 5pm about rent"       →  "tner tuoba 5pm ta mom llac"

const VOWELS = new Set("aeiou");

function dedupeConsecutive(s: string): string {
  let out = "";
  for (const ch of s) if (ch !== out[out.length - 1]) out += ch;
  return out;
}

function skeleton(word: string): string {
  const w = dedupeConsecutive(word);
  const first = w[0];
  const last = w[w.length - 1];
  const middle = w.slice(1, -1);

  const seen = new Set<string>();
  const cons: string[] = [];
  for (const ch of middle) {
    if (!VOWELS.has(ch) && !seen.has(ch)) { cons.push(ch); seen.add(ch); }
  }
  const cap = word.length >= 10 ? 5 : 3;
  let mid = cons.slice(0, cap);
  if (mid.length < 2) {
    const v = [...middle].find(ch => VOWELS.has(ch));
    if (v) mid = [...mid, v];
  }
  return first + mid.join("") + last;
}

export function encodeReminder(text: string): string {
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map(tok => {
      const clean = tok.replace(/[.,!?;:'"“”‘’()[\]{}]/g, "");
      if (!clean) return "";
      if (!/^[a-z]+$/.test(clean)) return clean; // digits / emoji / mixed → untouched
      if (clean.length <= 5) return [...clean].reverse().join("");
      return skeleton(clean);
    })
    .filter(Boolean);
  return words.reverse().join(" ");
}

export const SETTINGS_KEY = "settings";
export interface Settings { codeMode?: boolean }
