import { ImageResponse } from "@vercel/og";
import { redis, KEY } from "@/lib/redis";
import { Quote, DEFAULT_QUOTES, QUOTES_KEY, PIN_KEY, PORTRAIT_KEY, slugify } from "@/lib/quotes";

export const runtime = "edge";

interface Reminder { id: string; text: string; done: boolean; order: number }

// ── Apple Watch Photos-face render (41mm: 352×430) ───────────────────────────
// watchOS draws the clock at the top → top CLOCK_H px stay empty.
// Magazine-lede layout: small portrait top-left, quote starts beside it and
// wraps full-width underneath. Same design language as the iPhone wallpaper:
// Gabarito quote, Arimo meta, orange bottom bleed, orange pill for the count.
const W = 352;
const H = 430;
const ORANGE  = "#FF693C";
const PAD     = 18;
const CLOCK_H = 108;
const FACE    = 118;
const FACE_MR = 14;
const FOOTER_H = 54;

const GABARITO = "https://cdn.jsdelivr.net/npm/@fontsource/gabarito@5.2.8/files/gabarito-latin-400-normal.woff";
const ARIMO    = "https://cdn.jsdelivr.net/npm/@fontsource/arimo@5.2.8/files/arimo-latin-700-normal.woff";
let _gab: ArrayBuffer | null = null;
let _ari: ArrayBuffer | null = null;

const _portraits = new Map<string, string | null>();
async function loadPortrait(origin: string, character: string): Promise<string | null> {
  const slug = slugify(character);
  if (!slug) return null;
  if (_portraits.has(slug)) return _portraits.get(slug) ?? null;
  try {
    const [custom, res] = await Promise.all([
      redis.get<string>(PORTRAIT_KEY(slug)),
      fetch(`${origin}/portraits/${slug}.png`),
    ]);
    if (custom) { _portraits.set(slug, custom); return custom; }
    if (!res.ok) { _portraits.set(slug, null); return null; }
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const uri = `data:image/png;base64,${btoa(bin)}`;
    _portraits.set(slug, uri);
    return uri;
  } catch { _portraits.set(slug, null); return null; }
}

// Greedy two-zone wrap (lines beside the face, then full-width lines).
function wrap(text: string, F: number, besideLines: number, besideW: number, fullW: number): [string[], string[]] {
  const cw = F * 0.50; // Gabarito 400 avg advance
  const beside: string[] = [], below: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    const inBeside = beside.length < besideLines;
    const maxW = inBeside ? besideW : fullW;
    const t = cur ? `${cur} ${word}` : word;
    if (t.length * cw > maxW && cur) {
      (inBeside ? beside : below).push(cur);
      cur = word;
    } else cur = t;
  }
  if (cur) (beside.length < besideLines ? beside : below).push(cur);
  return [beside, below];
}

// Largest font size whose wrapped quote fits the available height.
function fitQuote(text: string, hasFace: boolean) {
  const availH = H - CLOCK_H - FOOTER_H - 16;
  const besideW = W - 2 * PAD - (hasFace ? FACE + FACE_MR : 0);
  const fullW   = W - 2 * PAD;
  for (let F = 34; F >= 14; F -= 1) {
    const LH = Math.round(F * 1.22);
    const besideLines = hasFace ? Math.ceil(FACE / LH) : 0;
    const [beside, below] = wrap(text, F, besideLines, besideW, fullW);
    const usedH = Math.max(hasFace ? FACE : 0, beside.length * LH) + below.length * LH;
    if (usedH <= availH) return { F, LH, beside, below };
  }
  const LH = 17;
  const besideLines = hasFace ? Math.ceil(FACE / LH) : 0;
  const [beside, below] = wrap(text, 14, besideLines, besideW, fullW);
  return { F: 14, LH, beside, below };
}

export async function GET(req: Request) {
  const [reminders, quotesData, pin, gab, ari] = await Promise.all([
    redis.get<Reminder[]>(KEY),
    redis.get<Quote[]>(QUOTES_KEY),
    redis.get<{ id: string }>(PIN_KEY),
    _gab ?? fetch(GABARITO).then(r => r.arrayBuffer()),
    _ari ?? fetch(ARIMO).then(r => r.arrayBuffer()),
  ]);
  _gab = gab; _ari = ari;

  const pendingCount = (reminders ?? []).filter(r => !r.done).length;
  const allQuotes = quotesData ?? DEFAULT_QUOTES;
  const pool = allQuotes.filter(x => !x.disabled);
  const list = pool.length ? pool : DEFAULT_QUOTES;
  const pinned = pin ? list.find(x => x.id === pin.id) : undefined;
  const day = Math.floor(Date.now() / 86_400_000);
  const { q, c } = pinned ?? list[day % list.length];

  const portrait = await loadPortrait(new URL(req.url).origin, c);
  const { F, LH, beside, below } = fitQuote(`“${q}”`, !!portrait);

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, background: "#000", display: "flex",
        flexDirection: "column", position: "relative", fontFamily: "Gabarito",
      }}>
        {/* orange bottom bleed — same as the iPhone wallpaper */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 230, display: "flex",
          background: "linear-gradient(to top, rgba(255,105,60,0.30) 0%, rgba(255,105,60,0.12) 40%, rgba(255,105,60,0.03) 70%, rgba(255,105,60,0) 100%)",
        }} />

        <div style={{
          display: "flex", flexDirection: "column", flexGrow: 1, position: "relative",
          paddingTop: CLOCK_H, paddingLeft: PAD, paddingRight: PAD,
        }}>
          {/* portrait + quote-start */}
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            {portrait && <img src={portrait} width={FACE} height={FACE} style={{ marginRight: FACE_MR, flexShrink: 0 }} />}
            <div style={{ display: "flex", flexDirection: "column", paddingTop: 4 }}>
              {beside.map((ln, i) => (
                <span key={i} style={{ fontSize: F, lineHeight: `${LH}px`, color: "#fff", letterSpacing: "-0.01em" }}>{ln}</span>
              ))}
            </div>
          </div>
          {/* quote continues full-width */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {below.map((ln, i) => (
              <span key={i} style={{ fontSize: F, lineHeight: `${LH}px`, color: "#fff", letterSpacing: "-0.01em" }}>{ln}</span>
            ))}
          </div>

          {/* footer: character + count pill */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: "auto", paddingBottom: 22,
          }}>
            <span style={{ fontSize: 14, color: ORANGE, letterSpacing: "0.12em", fontWeight: 700, fontFamily: "Arimo" }}>
              — {c}
            </span>
            {pendingCount > 0 ? (
              <div style={{
                display: "flex", alignItems: "center", background: ORANGE,
                borderRadius: 999, padding: "5px 12px",
              }}>
                <span style={{ fontSize: 13, color: "#000", fontWeight: 700, letterSpacing: "0.08em", fontFamily: "Arimo" }}>
                  {pendingCount} LEFT
                </span>
              </div>
            ) : (
              <div style={{
                display: "flex", alignItems: "center", border: "1.5px solid #2e2e2e",
                borderRadius: 999, padding: "5px 12px",
              }}>
                <span style={{ fontSize: 13, color: "#666", fontWeight: 700, letterSpacing: "0.08em", fontFamily: "Arimo" }}>
                  ALL DONE
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      width: W, height: H,
      fonts: [
        { name: "Gabarito", data: gab, style: "normal", weight: 400 },
        { name: "Arimo",    data: ari, style: "normal", weight: 700 },
      ],
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
