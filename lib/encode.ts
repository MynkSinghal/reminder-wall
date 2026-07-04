// "Reverse + Abbreviate" reminder encoder.
// English lives in the UI + Redis; this runs ONLY at wallpaper render time.
//
// Algorithm (per spec):
//  1. lowercase, strip punctuation
//  2. reverse every word
//  3. words of 1–6 letters: keep reversed as-is
//     words of 7+ letters: abbreviate the reversed word to a 4–5 letter skeleton:
//       – keep first + last letter of the reversed word
//       – collapse repeated letters
//       – drop middle vowels (keep one only if too few consonants remain)
//       – keep 2–3 prominent middle consonants (up to 5 for very long words)
//  Tokens containing digits/symbols/emoji (5pm, ₹500, e-mail) pass through untouched.

const VOWELS = new Set("aeiou");

// User-approved baselines — always exact.
const DICT: Record<string, string> = {
  tomorrow: "wrmot",
  meeting: "gntm",
  project: "tcjp",
};

function dedupeConsecutive(s: string): string {
  let out = "";
  for (const ch of s) if (ch !== out[out.length - 1]) out += ch;
  return out;
}

function abbreviate(reversed: string, origLen: number): string {
  const r = dedupeConsecutive(reversed);
  const first = r[0];
  const last = r[r.length - 1];
  const middle = r.slice(1, -1);

  const seen = new Set<string>();
  const cons: string[] = [];
  for (const ch of middle) {
    if (!VOWELS.has(ch) && !seen.has(ch)) { cons.push(ch); seen.add(ch); }
  }
  const cap = origLen >= 10 ? 5 : 3;
  let mid = cons.slice(0, cap);
  if (mid.length < 2) {
    const v = [...middle].find(ch => VOWELS.has(ch));
    if (v) mid = [...mid, v];
  }
  return first + mid.join("") + last;
}

export function encodeReminder(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map(tok => {
      const clean = tok.replace(/[.,!?;:'"“”‘’()[\]{}]/g, "");
      if (!clean) return "";
      if (!/^[a-z]+$/.test(clean)) return clean; // digits / emoji / mixed → untouched
      if (DICT[clean]) return DICT[clean];
      const rev = [...clean].reverse().join("");
      return clean.length <= 6 ? rev : abbreviate(rev, clean.length);
    })
    .filter(Boolean)
    .join(" ");
}

export const SETTINGS_KEY = "settings";
export interface Settings { codeMode?: boolean }
