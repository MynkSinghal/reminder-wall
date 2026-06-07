import { ImageResponse } from "@vercel/og";
import { redis, KEY } from "@/lib/redis";

export const runtime = "edge";

interface Reminder {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

// ── Canvas ────────────────────────────────────────────────────────────────────
const W = 1179;
const H = 2556;

// ── Palette ───────────────────────────────────────────────────────────────────
const ORANGE = "#FF693C";
const WHITE  = "#FFFFFF";
const DONE_C = "#484848";

// ── Safe zone ─────────────────────────────────────────────────────────────────
const SAFE_TOP    = 780;
const SAFE_BOTTOM = 2280;

// ── Layout ───────────────────────────────────────────────────────────────────
const SIDE_PAD = 68;
const BAR_W    = 4;
const BAR_MR   = 18;
const NUM_W    = 60;
const COL_GAP  = 20;
const TEXT_W   = W - 2 * SIDE_PAD - BAR_W - BAR_MR - NUM_W - COL_GAP; // 941 px

const HEADER_H  = 86;
const FOOTER_H  = 260;

const FONT_MAX   = 118;
const FONT_MIN   = 34;
const CHAR_RATIO = 0.62;
const RATIO_1LN  = 1.40;
const RATIO_2LN  = 2.70;
const RATIO_3LN  = 4.00;   // 3 lines of text + padding

// ── Display cap — prevents cramped layouts with many items ────────────────────
const MAX_DISPLAY    = 6;   // max items rendered on screen
const OVERFLOW_ROW_H = 56;  // height reserved for "+ X more" indicator

// ── Quotes (shown when reminder list is empty) ────────────────────────────────
const QUOTES = [
  { q: "The road to power is paved with hypocrisy, and casualties.", c: "FRANK UNDERWOOD", s: "House of Cards" },
  { q: "For those of us climbing to the top of the food chain, there can be no mercy. There is but one rule: hunt or be hunted.", c: "FRANK UNDERWOOD", s: "House of Cards" },
  { q: "You are entitled to nothing.", c: "FRANK UNDERWOOD", s: "House of Cards" },
  { q: "Proximity to power deludes some into thinking they wield it.", c: "FRANK UNDERWOOD", s: "House of Cards" },
  { q: "I've always loathed the necessity of sleep. Like death, it puts even the most powerful men on their backs.", c: "FRANK UNDERWOOD", s: "House of Cards" },
  { q: "When you're backed against the wall, break the goddamn thing down.", c: "HARVEY SPECTER", s: "Suits" },
  { q: "I don't get lucky. I make my own luck.", c: "HARVEY SPECTER", s: "Suits" },
  { q: "Anyone can do my job, but no one can be me.", c: "HARVEY SPECTER", s: "Suits" },
  { q: "Win a no-win situation by rewriting the rules.", c: "HARVEY SPECTER", s: "Suits" },
  { q: "Don't raise your voice. Improve your argument.", c: "HARVEY SPECTER", s: "Suits" },
  { q: "I am the one who knocks.", c: "WALTER WHITE", s: "Breaking Bad" },
  { q: "I'm not in the meth business. I'm in the empire business.", c: "WALTER WHITE", s: "Breaking Bad" },
  { q: "No more half measures.", c: "MIKE EHRMANTRAUT", s: "Breaking Bad" },
  { q: "I did it for me. I liked it. I was good at it. And I was really alive.", c: "WALTER WHITE", s: "Breaking Bad" },
  { q: "By order of the Peaky Blinders.", c: "TOMMY SHELBY", s: "Peaky Blinders" },
  { q: "I don't pay for suits. My suits are on the house, or the house burns down.", c: "TOMMY SHELBY", s: "Peaky Blinders" },
  { q: "There's no rest for those who want to live by their own rules.", c: "TOMMY SHELBY", s: "Peaky Blinders" },
  { q: "Never forget what you are. The rest of the world will not. Wear it like armor, and it can never be used to hurt you.", c: "TYRION LANNISTER", s: "Game of Thrones" },
  { q: "A mind needs books as a sword needs a whetstone, if it is to keep its edge.", c: "TYRION LANNISTER", s: "Game of Thrones" },
  { q: "When you play the game of thrones, you win or you die.", c: "CERSEI LANNISTER", s: "Game of Thrones" },
  { q: "Make it simple, but significant.", c: "DON DRAPER", s: "Mad Men" },
  { q: "People tell you who they are, but we ignore it because we want them to be who we want them to be.", c: "DON DRAPER", s: "Mad Men" },
  { q: "You are not serious people.", c: "LOGAN ROY", s: "Succession" },
  { q: "I love you, but you are not serious people.", c: "LOGAN ROY", s: "Succession" },
  { q: "What's the point of having 'fuck you money' if you never say 'fuck you'?", c: "BOBBY AXELROD", s: "Billions" },
  { q: "The key to having everything is making sure you don't let anyone take it from you.", c: "BOBBY AXELROD", s: "Billions" },
  { q: "A man's gotta have a code.", c: "OMAR LITTLE", s: "The Wire" },
  { q: "All in the game, yo. All in the game.", c: "OMAR LITTLE", s: "The Wire" },
  { q: "I'm gonna make him an offer he can't refuse.", c: "DON CORLEONE", s: "The Godfather" },
  { q: "Keep your friends close, but your enemies closer.", c: "MICHAEL CORLEONE", s: "The Godfather" },
  { q: "You see, in this world there's two kinds of people, my friend: those with loaded guns and those who dig. You dig.", c: "BLONDIE", s: "The Good, the Bad and the Ugly" },
  { q: "You either die a hero or live long enough to see yourself become the villain.", c: "HARVEY DENT", s: "The Dark Knight" },
  { q: "The devil doesn't come dressed in a red cape and pointy horns. He comes as everything you've ever wished for.", c: "TUCKER MAX", s: "Tucker Max" },
  { q: "Money is a scoreboard where you can rank how you're doing against other people.", c: "MARK CUBAN", s: "Mark Cuban" },
  { q: "People don't want the truth because they don't want their illusions destroyed.", c: "FRIEDRICH NIETZSCHE", s: "Nietzsche" },
  { q: "Nearly all men can stand adversity, but if you want to test a man's character, give him power.", c: "ABRAHAM LINCOLN", s: "Abraham Lincoln" },
  { q: "The man who reads nothing at all is better educated than the man who reads nothing but newspapers.", c: "THOMAS JEFFERSON", s: "Thomas Jefferson" },
  { q: "A cynic is a man who knows the price of everything and the value of nothing.", c: "OSCAR WILDE", s: "Oscar Wilde" },
  { q: "Man is least himself when he talks in his own person. Give him a mask, and he will tell you the truth.", c: "OSCAR WILDE", s: "Oscar Wilde" },
  { q: "The stupid neither forgive nor forget; the naive forgive and forget; the wise forgive but do not forget.", c: "THOMAS SZASZ", s: "Thomas Szasz" },
];

// ── Assets ────────────────────────────────────────────────────────────────────
const SIGN_B64 = "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PEb4ws+TlnY207Wa642SfuELX/jCF77wa8EPeWGHxM0rQvjCL4tvcDZHSr/whS984Qtf+HXlByccC4iJL3zhD8LXjubhPmezrfqFL3zhC1/4wq+cH1vLYwtztfELX/hV8bWz+Z+Uo3mZ7yutTfqFL3zhC1/4wq8jP9piMldGJoQvfFdY0us+lKdWsy36hS984Qtf+MKvlJ+tCnVlLiTjeat0hS/8svja4XTGb7N+4Qtf+MIXvvAr5bteznkt5ljhC1/4whe+8IUvfOG3kB+aYNazdXm6g6QlfOELX/jCF77whS/89vG9cF+CgwgWvvCFL3zhC1/4whd++/mlAvJUyQpf+MIXvvCFL3zhC7/Z/KADs2H9/237B86M8IUvfOELX/jCF77w28v3gV1VsL79IRkQvvCFL3zhC1/4whd+e/hxESOExKQpfOELX/jCF77whS/89vK9VkaiMccJX/jCF77whS984Qu/+fzCM+k6bhiFJHzhC1/4whe+8IUv/Or4zoSyv12Q0GrYvNWywhe+8IUvfOELX/jCbyY/VyJFmvCFL3zhC1/4whe+8EeIbwK42uwHFSR84Qtf+MIXvvCFL/wR5PugIccN4hkLX/jCF77whS984Qu/xfx+xKqqWYUvfOELX/jCF77whd8yfujBRXvMwhe+8IUvfOELX/jCbym/SO846U0eteRLX/jCF77whS984Qtf+CPED40c6wWHtuULX/jCF77whS984Qu/HfwoC/WQy8qE8IUvfOELX/jCF77wG8w3RRrUq405TvjCF77whS984Qtf+O3jF5phX/zQqlzhC1/4whe+8IUvfOG3g58rsdgq25j0hS984Qtf+MIXvvCF3y5+qVZ1hoQvfOELX/jCF77whd9AfjaRkP4ARQoXvvCFL3zhC1/4whd+/flBGRumdyx84Qtf+MIXvvCFL/x28P8/x79eAhwoU5YAAAAASUVORK5CYII=";

// ── Font loading ─────────────────────────────────────────────────────────────
// Gabarito (body text, display weights) + Arimo (header/numbers, metric-identical
// to Liberation Sans — same designer Steve Matteson, same proportions, CDN-stable).
// Both served as .woff from jsDelivr/fontsource — the only format Satori supports
// besides TTF/OTF.
const GABARITO_BASE  = "https://cdn.jsdelivr.net/npm/@fontsource/gabarito@5.2.8/files";
const ARIMO_BASE     = "https://cdn.jsdelivr.net/npm/@fontsource/arimo@5.2.8/files";
const IBM_MONO_BASE  = "https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5.2.7/files";

let _fontGabarito: ArrayBuffer | null = null;  // Gabarito 900     — body text
let _fontArimo:    ArrayBuffer | null = null;  // Arimo 700        — header, meta
let _fontMono:     ArrayBuffer | null = null;  // IBM Plex Mono 700 — item numbers

async function getFonts(): Promise<{ gabarito: ArrayBuffer; arimo: ArrayBuffer; mono: ArrayBuffer }> {
  const [gabarito, arimo, mono] = await Promise.all([
    _fontGabarito ?? fetch(`${GABARITO_BASE}/gabarito-latin-900-normal.woff`).then(r => r.arrayBuffer()),
    _fontArimo    ?? fetch(`${ARIMO_BASE}/arimo-latin-700-normal.woff`).then(r => r.arrayBuffer()),
    _fontMono     ?? fetch(`${IBM_MONO_BASE}/ibm-plex-mono-latin-700-normal.woff`).then(r => r.arrayBuffer()),
  ]);
  _fontGabarito = gabarito;
  _fontArimo    = arimo;
  _fontMono     = mono;
  return { gabarito, arimo, mono };
}

// ── Font-size algorithm (reminder mode) ───────────────────────────────────────
function computeLayout(
  items: { text: string }[],
  textW: number,
  availH: number,
): { fontSize: number; itemHeights: number[] } {
  if (items.length === 0) return { fontSize: FONT_MAX, itemHeights: [] };
  const lineRatio = (lines: number) =>
    lines === 1 ? RATIO_1LN : lines === 2 ? RATIO_2LN : RATIO_3LN;
  for (let F = FONT_MAX; F >= FONT_MIN; F -= 2) {
    const cpl     = Math.max(1, Math.floor(textW / (F * CHAR_RATIO)));
    const heights = items.map(({ text }) => {
      const lines = Math.min(3, Math.max(1, Math.ceil(text.length / cpl)));
      return Math.round(F * lineRatio(lines));
    });
    if (heights.reduce((a, b) => a + b, 0) <= availH) {
      return { fontSize: F, itemHeights: heights };
    }
  }
  const cpl = Math.max(1, Math.floor(textW / (FONT_MIN * CHAR_RATIO)));
  return {
    fontSize: FONT_MIN,
    itemHeights: items.map(({ text }) => {
      const lines = Math.min(3, Math.max(1, Math.ceil(text.length / cpl)));
      return Math.round(FONT_MIN * lineRatio(lines));
    }),
  };
}

// ── Quote font size — fixed regardless of length ──────────────────────────────
const QUOTE_FONT = 72;

// ── Signature — pre-rotated by user, source 667×374 ──────────────────────────
const SIGN_W = 400;
const SIGN_H = 224;

const SignatureEl = () => (
  <img
    src={`data:image/png;base64,${SIGN_B64}`}
    style={{ width: SIGN_W, height: SIGN_H, opacity: 1.0 }}
  />
);

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET() {
  const data    = await redis.get<Reminder[]>(KEY);
  const all     = (data ?? []).sort((a, b) => a.order - b.order);
  const sorted  = [...all.filter(r => !r.done), ...all.filter(r => r.done)];
  const pending = sorted.filter(r => !r.done);
  const N       = sorted.length;

  const now     = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const { gabarito: fontGabarito, arimo: fontArimo, mono: fontMono } = await getFonts();

  // ── EMPTY STATE: show a daily rotating quote ───────────────────────────────
  if (N === 0) {
    const dayIdx = Math.floor(Math.random() * QUOTES.length);
    const { q, c, s } = QUOTES[dayIdx];
    const qFont  = QUOTE_FONT;
    const qLines = Math.max(1, Math.ceil(q.length / Math.floor(TEXT_W / (qFont * 0.54))));
    const quoteBlockH = qLines * qFont * 1.18 + 60 + 38 + 16 + 28; // text + gap + character + gap + show
    const safeH  = SAFE_BOTTOM - SAFE_TOP;
    const qTop   = SAFE_TOP + Math.max(0, Math.floor((safeH - FOOTER_H - quoteBlockH) / 2));

    return new ImageResponse(
      (
        <div style={{ width: W, height: H, background: "#000", display: "flex", fontFamily: "Gabarito", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex",
            background: "linear-gradient(180deg,#000 0%,#060606 45%,#030303 70%,#000 100%)" }} />

          {/* Bottom bleed */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1100, display: "flex",
            background: "linear-gradient(to top,rgba(255,105,60,0.28) 0%,rgba(255,105,60,0.10) 35%,rgba(255,105,60,0.02) 65%,transparent 100%)" }} />

          <div style={{ display: "flex", flexDirection: "column", paddingTop: qTop,
            paddingLeft: SIDE_PAD, paddingRight: SIDE_PAD, width: "100%", position: "relative" }}>

            {/* Quote text */}
            <span style={{
              fontSize: qFont, color: WHITE, fontFamily: "Gabarito", fontWeight: 900,
              letterSpacing: qFont > 72 ? "-0.04em" : "-0.02em",
              lineHeight: 1.18, marginBottom: 60,
            }}>
              &ldquo;{q}&rdquo;
            </span>

            {/* Character — orange, prominent */}
            <span style={{
              fontSize: 34, color: ORANGE, fontFamily: "Arimo", fontWeight: 700,
              letterSpacing: "0.12em", marginBottom: 16,
            }}>
              — {c}
            </span>

            {/* Show name — small, dimmed */}
            <span style={{
              fontSize: 24, color: "#555555", fontFamily: "Arimo", fontWeight: 700, letterSpacing: "0.18em",
            }}>
              {s.toUpperCase()}
            </span>
          </div>

          {/* Footer: timestamp + signature */}
          <div style={{ position: "absolute", bottom: H - SAFE_BOTTOM + 10,
            left: SIDE_PAD, right: SIDE_PAD,
            display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <span style={{ fontSize: 17, color: "#1c1c1c", fontFamily: "Arimo", fontWeight: 700, letterSpacing: "0.08em" }}>{timeStr}</span>
            <SignatureEl />
          </div>
        </div>
      ),
      {
        width: W, height: H,
        fonts: [
          { name: "Gabarito",      data: fontGabarito, style: "normal", weight: 900 },
          { name: "Arimo",         data: fontArimo,    style: "normal", weight: 700 },
          { name: "IBM Plex Mono", data: fontMono,     style: "normal", weight: 700 },
        ],
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }

  // ── REMINDER MODE ─────────────────────────────────────────────────────────
  const displayed   = sorted.slice(0, MAX_DISPLAY);
  const hiddenCount = Math.max(0, sorted.length - MAX_DISPLAY);
  const hasOverflow = hiddenCount > 0;
  const availH  = SAFE_BOTTOM - SAFE_TOP - HEADER_H - FOOTER_H - (hasOverflow ? OVERFLOW_ROW_H : 0);
  const { fontSize, itemHeights } = computeLayout(displayed, TEXT_W, availH);
  const NUM_PX  = Math.max(22, Math.round(fontSize * 0.35));
  const totalItemH = itemHeights.reduce((a, b) => a + b, 0);
  const blockH  = HEADER_H + totalItemH + (hasOverflow ? OVERFLOW_ROW_H : 0) + FOOTER_H;
  const topPad  = Math.max(SAFE_TOP, Math.min(Math.floor(H / 2 - blockH / 2), SAFE_BOTTOM - blockH));
  const textLS  = fontSize > 72 ? "-0.04em" : fontSize > 50 ? "-0.02em" : "-0.01em";
  const DN      = displayed.length;

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, background: "#000", display: "flex", fontFamily: "Gabarito", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex",
          background: "linear-gradient(180deg,#000 0%,#060606 45%,#030303 70%,#000 100%)" }} />

        {/* Bottom bleed */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1100, display: "flex",
          background: "linear-gradient(to top,rgba(255,105,60,0.28) 0%,rgba(255,105,60,0.10) 35%,rgba(255,105,60,0.02) 65%,transparent 100%)" }} />

        <div style={{ display: "flex", flexDirection: "column", paddingTop: topPad,
          paddingLeft: SIDE_PAD, paddingRight: SIDE_PAD, width: "100%", position: "relative" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 50, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 7, height: 7, background: ORANGE, borderRadius: "50%", display: "flex", flexShrink: 0 }} />
              <span style={{ fontSize: 26, color: ORANGE, letterSpacing: "0.40em", fontFamily: "Arimo", fontWeight: 700 }}>{dayName}</span>
            </div>
            <span style={{ fontSize: 26, color: pending.length > 0 ? ORANGE : "#2e2e2e", letterSpacing: "0.08em", fontFamily: "Arimo", fontWeight: 700 }}>
              {pending.length > 0 ? `${pending.length} left` : "all done  ✓"}
            </span>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: ORANGE, opacity: 0.2, marginBottom: 22, display: "flex" }} />

          {/* Reminder rows — capped at MAX_DISPLAY */}
          {displayed.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", height: itemHeights[i],
              borderBottom: (i < DN - 1 || hasOverflow) ? "1px solid #0A0A0A" : "none" }}>
              <div style={{ width: BAR_W, alignSelf: "stretch",
                background: r.done ? "transparent" : ORANGE,
                borderRadius: 2, flexShrink: 0, marginRight: BAR_MR }} />
              <span style={{ fontSize: NUM_PX, color: ORANGE, fontFamily: "IBM Plex Mono", fontWeight: 700, letterSpacing: "0.06em",
                width: NUM_W, textAlign: "right", flexShrink: 0, opacity: r.done ? 0.25 : 1, lineHeight: 1,
                textShadow: r.done ? "none" : "0 0 14px rgba(255,105,60,0.75)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div style={{ width: COL_GAP, flexShrink: 0 }} />
              <span style={{ fontSize, color: r.done ? DONE_C : WHITE, fontFamily: "Gabarito", fontWeight: 900, letterSpacing: textLS,
                textDecoration: r.done ? "line-through" : "none", flex: 1, lineHeight: 1.15 }}>
                {r.text}
              </span>
            </div>
          ))}

          {/* Overflow indicator — shown when total items > MAX_DISPLAY */}
          {hasOverflow && (
            <div style={{ display: "flex", alignItems: "center", height: OVERFLOW_ROW_H }}>
              <div style={{ width: BAR_W, flexShrink: 0, marginRight: BAR_MR }} />
              <div style={{ width: NUM_W, flexShrink: 0 }} />
              <div style={{ width: COL_GAP, flexShrink: 0 }} />
              <span style={{ fontSize: Math.max(28, Math.round(fontSize * 0.40)), color: "#2e2e2e",
                fontFamily: "Arimo", fontWeight: 700, letterSpacing: "0.10em" }}>
                + {hiddenCount} more
              </span>
            </div>
          )}

          {/* Footer — absolutely pinned, never moves with reminder count */}
          <div style={{ position: "absolute", bottom: H - SAFE_BOTTOM + 10,
            left: SIDE_PAD, right: SIDE_PAD,
            display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <span style={{ fontSize: 17, color: "#1c1c1c", fontFamily: "Arimo", fontWeight: 700, letterSpacing: "0.08em" }}>{timeStr}</span>
            <SignatureEl />
          </div>
        </div>
      </div>
    ),
    {
      width: W, height: H,
      fonts: [
        { name: "Gabarito",      data: fontGabarito, style: "normal", weight: 900 },
        { name: "Arimo",         data: fontArimo,    style: "normal", weight: 700 },
        { name: "IBM Plex Mono", data: fontMono,     style: "normal", weight: 700 },
      ],
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
