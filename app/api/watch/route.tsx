import { ImageResponse } from "@vercel/og";
import { redis, KEY } from "@/lib/redis";
import { Quote, DEFAULT_QUOTES, QUOTES_KEY, PIN_KEY } from "@/lib/quotes";

export const runtime = "edge";

interface Reminder { id: string; text: string; done: boolean; order: number }

// ── Apple Watch Photos-face render (41mm: 352×430) ───────────────────────────
// watchOS draws the clock at the top → top CLOCK_H px stay empty.
// Text-only design: quote, character, and count pill — all center-aligned,
// vertically centered below the clock. Orange bleed matches the iPhone wallpaper.
const W = 352;
const H = 430;
const ORANGE  = "#FF693C";
const PAD     = 20;
const CLOCK_H = 104;

const GABARITO = "https://cdn.jsdelivr.net/npm/@fontsource/gabarito@5.2.8/files/gabarito-latin-700-normal.woff";
const ARIMO    = "https://cdn.jsdelivr.net/npm/@fontsource/arimo@5.2.8/files/arimo-latin-700-normal.woff";
let _gab: ArrayBuffer | null = null;
let _ari: ArrayBuffer | null = null;

// Largest font size whose wrapped text fits the available block height.
// (Satori does the real wrapping; this just estimates line count for sizing.)
function fitFont(text: string): number {
  const availH = H - CLOCK_H - 90 - 24; // minus footer (name+pill) and padding
  const fullW  = W - 2 * PAD;
  for (let F = 34; F >= 14; F -= 1) {
    const LH = F * 1.24;
    const charsPerLine = Math.max(1, Math.floor(fullW / (F * 0.53)));
    const lines = Math.ceil(text.length / charsPerLine) + 1; // +1 wrap slack
    if (lines * LH <= availH) return F;
  }
  return 14;
}

export async function GET() {
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
  const { q, c } = pinned ?? list[Math.floor(Math.random() * list.length)];

  const text = `“${q}”`;
  const F = fitFont(text);

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
          alignItems: "center", justifyContent: "center",
          paddingTop: CLOCK_H, paddingLeft: PAD, paddingRight: PAD, paddingBottom: 24,
        }}>
          {/* quote — Satori wraps and centers natively */}
          <div style={{
            display: "flex", width: "100%", justifyContent: "center",
            fontSize: F, lineHeight: 1.24, color: "#fff", fontWeight: 700,
            textAlign: "center", letterSpacing: "-0.01em",
          }}>
            {text}
          </div>

          {/* character */}
          <span style={{
            fontSize: 14, color: ORANGE, letterSpacing: "0.14em", fontWeight: 700,
            fontFamily: "Arimo", marginTop: 18, textAlign: "center",
          }}>
            {c}
          </span>

          {/* count pill */}
          {pendingCount > 0 ? (
            <div style={{
              display: "flex", alignItems: "center", background: ORANGE,
              borderRadius: 999, padding: "6px 14px", marginTop: 14,
            }}>
              <span style={{ fontSize: 13, color: "#000", fontWeight: 700, letterSpacing: "0.08em", fontFamily: "Arimo" }}>
                {pendingCount} LEFT
              </span>
            </div>
          ) : (
            <div style={{
              display: "flex", alignItems: "center", border: "1.5px solid #2e2e2e",
              borderRadius: 999, padding: "6px 14px", marginTop: 14,
            }}>
              <span style={{ fontSize: 13, color: "#666", fontWeight: 700, letterSpacing: "0.08em", fontFamily: "Arimo" }}>
                ALL DONE
              </span>
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: W, height: H,
      fonts: [
        { name: "Gabarito", data: gab, style: "normal", weight: 700 },
        { name: "Arimo",    data: ari, style: "normal", weight: 700 },
      ],
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
