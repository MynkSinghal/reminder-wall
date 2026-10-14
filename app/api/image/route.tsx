import { ImageResponse } from "@vercel/og";
import { redis, KEY } from "@/lib/redis";
import { Quote, DEFAULT_QUOTES, QUOTES_KEY, PIN_KEY, PORTRAIT_KEY, slugify } from "@/lib/quotes";
import { encodeReminder, SETTINGS_KEY, Settings } from "@/lib/encode";

export const runtime = "edge";

interface Reminder {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

// ── Canvas — iPhone 18 Pro (1206 × 2622) ─────────────────────────────────────
const W = 1206;
const H = 2622;

// ── Palette — "Frost horizon", matched to the iPhone 18 Pro Glacier finish ────
// Apple publishes no hex for Glacier; these are eyeballed silver-blues.
const FROST  = "#CFE3F0";  // header, numbers, character name
const ICE    = "#9FCBEA";  // bars, progress fill
const STEEL  = "#8FB7D2";  // progress labels
const DIM    = "#6C8597";  // show name
const MUTED  = "#2A3B49";  // "all done", "+ X more"
const WHITE  = "#F2F7FA";
const DONE_C = "#3E5162";
const GLOW   = "rgba(159,203,234,0.55)";
const ROW_LINE = "rgba(159,203,234,0.07)";

// Day name + day-of-year are computed in local time, not the edge server's UTC.
const TZ = "Asia/Kolkata";

// ── Safe zone ─────────────────────────────────────────────────────────────────
const SAFE_TOP    = 800;
const SAFE_BOTTOM = 2340;

// ── Layout ───────────────────────────────────────────────────────────────────
const SIDE_PAD = 70;
const BAR_W    = 4;
const BAR_MR   = 18;
const NUM_W    = 60;
const COL_GAP  = 20;
const TEXT_W   = W - 2 * SIDE_PAD - BAR_W - BAR_MR - NUM_W - COL_GAP; // 964 px

const PROGRESS_H = 44;   // "DAY 287 ━━━━ WK 42" row under the divider
const HEADER_H   = 86 + PROGRESS_H;
const FOOTER_H   = 267;

const FONT_MAX   = 72;
const FONT_MIN   = 34;
const CHAR_RATIO = 0.62;
const RATIO_1LN  = 1.60;
const RATIO_2LN  = 2.70;
const RATIO_3LN  = 4.00;   // 3 lines of text + padding

// ── Display cap — prevents cramped layouts with many items ────────────────────
const MAX_DISPLAY    = 6;   // max items rendered on screen
const OVERFLOW_ROW_H = 56;  // height reserved for "+ X more" indicator

// Quotes now live in lib/quotes.ts + Redis (managed from the dashboard).

// ── Assets ────────────────────────────────────────────────────────────────────
const SIGN_B64 = "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";

// ── Font loading ─────────────────────────────────────────────────────────────
// Gabarito (body text, display weights) + Arimo (header/numbers, metric-identical
// to Liberation Sans — same designer Steve Matteson, same proportions, CDN-stable).
// Both served as .woff from jsDelivr/fontsource — the only format Satori supports
// besides TTF/OTF.
const GABARITO_BASE  = "https://cdn.jsdelivr.net/npm/@fontsource/gabarito@5.2.8/files";
const ARIMO_BASE     = "https://cdn.jsdelivr.net/npm/@fontsource/arimo@5.2.8/files";
const IBM_MONO_BASE  = "https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5.2.7/files";

let _fontGabarito:    ArrayBuffer | null = null;  // Gabarito 900     — quote text
let _fontGabaritoReg: ArrayBuffer | null = null;  // Gabarito 400     — reminder items
let _fontArimo:       ArrayBuffer | null = null;  // Arimo 700        — header, meta
let _fontMono:        ArrayBuffer | null = null;  // IBM Plex Mono 700 — item numbers

async function getFonts(): Promise<{ gabarito: ArrayBuffer; gabaritoReg: ArrayBuffer; arimo: ArrayBuffer; mono: ArrayBuffer }> {
  const [gabarito, gabaritoReg, arimo, mono] = await Promise.all([
    _fontGabarito    ?? fetch(`${GABARITO_BASE}/gabarito-latin-900-normal.woff`).then(r => r.arrayBuffer()),
    _fontGabaritoReg ?? fetch(`${GABARITO_BASE}/gabarito-latin-400-normal.woff`).then(r => r.arrayBuffer()),
    _fontArimo       ?? fetch(`${ARIMO_BASE}/arimo-latin-700-normal.woff`).then(r => r.arrayBuffer()),
    _fontMono        ?? fetch(`${IBM_MONO_BASE}/ibm-plex-mono-latin-700-normal.woff`).then(r => r.arrayBuffer()),
  ]);
  _fontGabarito    = gabarito;
  _fontGabaritoReg = gabaritoReg;
  _fontArimo       = arimo;
  _fontMono        = mono;
  return { gabarito, gabaritoReg, arimo, mono };
}

// ── Font-size algorithm (reminder mode) ───────────────────────────────────────
function computeLayout(
  items: { text: string }[],
  textW: number,
  availH: number,
): { fontSize: number; itemHeights: number[]; lineCounts: number[] } {
  if (items.length === 0) return { fontSize: FONT_MAX, itemHeights: [], lineCounts: [] };
  const lineRatio = (lines: number) =>
    lines === 1 ? RATIO_1LN : lines === 2 ? RATIO_2LN : RATIO_3LN;
  for (let F = FONT_MAX; F >= FONT_MIN; F -= 2) {
    const cpl    = Math.max(1, Math.floor(textW / (F * CHAR_RATIO)));
    const counts = items.map(({ text }) => Math.min(3, Math.max(1, Math.ceil(text.length / cpl))));
    const heights = counts.map(lines => Math.round(F * lineRatio(lines)));
    if (heights.reduce((a, b) => a + b, 0) <= availH) {
      return { fontSize: F, itemHeights: heights, lineCounts: counts };
    }
  }
  const cpl    = Math.max(1, Math.floor(textW / (FONT_MIN * CHAR_RATIO)));
  const counts = items.map(({ text }) => Math.min(3, Math.max(1, Math.ceil(text.length / cpl))));
  return {
    fontSize: FONT_MIN,
    itemHeights: counts.map(lines => Math.round(FONT_MIN * lineRatio(lines))),
    lineCounts: counts,
  };
}

// ── Quote font size — fixed regardless of length ──────────────────────────────
const QUOTE_FONT = 72;

// ── Dot portraits (quote mode) ────────────────────────────────────────────────
// Generated by scripts/generate_portraits.py → public/portraits/<slug>.png
// White circular halftone, 760px source, transparent bg, shown at FACE_PX.
const FACE_PX  = 380;
const FACE_GAP = 56;
// Custom portraits (dashboard uploads) live in Redis as data URIs.
// Built-in portraits are PNGs in public/portraits/<slug>.png.
const _portraitCache = new Map<string, string | null>();

async function loadPortrait(origin: string, character: string): Promise<string | null> {
  const slug = slugify(character);
  if (!slug) return null;
  if (_portraitCache.has(slug)) return _portraitCache.get(slug) ?? null;
  try {
    // fetch both sources in parallel; custom (dashboard upload) wins
    const [custom, res] = await Promise.all([
      redis.get<string>(PORTRAIT_KEY(slug)),
      fetch(`${origin}/portraits/${slug}.png`),
    ]);
    if (custom) { _portraitCache.set(slug, custom); return custom; }
    if (!res.ok) { _portraitCache.set(slug, null); return null; }
    const dataUri = pngDataUri(await res.arrayBuffer());
    _portraitCache.set(slug, dataUri);
    return dataUri;
  } catch {
    _portraitCache.set(slug, null);
    return null;
  }
}

function pngDataUri(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return `data:image/png;base64,${btoa(bin)}`;
}

// ── Dithered backdrop ─────────────────────────────────────────────────────────
// Satori draws CSS gradients in 8-bit, which bands badly in dark navy. The real
// backdrop is pre-rendered + dithered by scripts/generate_backdrop.mjs into
// public/backdrops/frost-horizon.png; the CSS <Backdrop /> is only a fallback.
let _backdrop: string | null = null;

async function loadBackdrop(origin: string): Promise<string | null> {
  if (_backdrop) return _backdrop;
  try {
    const res = await fetch(`${origin}/backdrops/frost-horizon.png`);
    if (!res.ok) return null;
    _backdrop = pngDataUri(await res.arrayBuffer());
    return _backdrop;
  } catch {
    return null;
  }
}

// ── Signature — pre-rotated by user, source 667×374 ──────────────────────────
const SIGN_W = 400;
const SIGN_H = 224;

const SignatureEl = () => (
  <img
    src={`data:image/png;base64,${SIGN_B64}`}
    style={{ width: SIGN_W, height: SIGN_H, opacity: 1.0 }}
  />
);

// ── Frost horizon backdrop — navy-black rising into a glacier glow ────────────
const Backdrop = ({ src }: { src: string | null }) => src ? (
  <img src={src} width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }} />
) : (
  <>
    <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex",
      background: "linear-gradient(180deg,#030507 0%,#050A0F 38%,#08131C 58%,#0E2333 76%,#1A3B50 90%,#2B5670 100%)" }} />
    {/* Horizon glow */}
    <div style={{ position: "absolute", left: -200, bottom: -380, width: W + 400, height: 1100, display: "flex",
      background: "radial-gradient(ellipse at center,rgba(214,234,246,0.55) 0%,rgba(159,203,234,0.22) 32%,rgba(159,203,234,0) 53%)" }} />
    {/* Faint ice streaks, fading upward */}
    <div style={{ position: "absolute", left: 0, bottom: 0, width: W, height: 520, display: "flex",
      backgroundImage: "repeating-linear-gradient(168deg,rgba(255,255,255,0.035) 0px,rgba(255,255,255,0.035) 2px,transparent 2px,transparent 46px)",
      maskImage: "linear-gradient(to top,black,transparent)" }} />
  </>
);

// ── Local calendar: day of year + ISO week ───────────────────────────────────
function calendar(now: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(now).map(x => [x.type, x.value]),
  );
  const y = +p.year;
  const t = Date.UTC(y, +p.month - 1, +p.day);
  const DAY = 86_400_000;
  const dayOfYear  = Math.round((t - Date.UTC(y, 0, 1)) / DAY) + 1;
  const daysInYear = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  const thursday   = new Date(t + (4 - (new Date(t).getUTCDay() || 7)) * DAY);
  const week = Math.ceil(((thursday.getTime() - Date.UTC(thursday.getUTCFullYear(), 0, 1)) / DAY + 1) / 7);
  return { dayOfYear, daysInYear, week };
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  // One parallel burst: reminders + quote data + fonts (no serial round-trips)
  const [data, quotesData, pin, settings, fonts, backdrop] = await Promise.all([
    redis.get<Reminder[]>(KEY),
    redis.get<Quote[]>(QUOTES_KEY),
    redis.get<{ id: string }>(PIN_KEY),
    redis.get<Settings>(SETTINGS_KEY),
    getFonts(),
    loadBackdrop(new URL(req.url).origin),
  ]);
  const all     = (data ?? []).sort((a, b) => a.order - b.order);
  const sorted  = [...all.filter(r => !r.done), ...all.filter(r => r.done)];
  const pending = sorted.filter(r => !r.done);
  const N       = sorted.length;

  const now     = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const dayName = now.toLocaleDateString("en-US", { weekday: "long", timeZone: TZ }).toUpperCase();
  const { dayOfYear, daysInYear, week } = calendar(now);
  const { gabarito: fontGabarito, gabaritoReg: fontGabaritoReg, arimo: fontArimo, mono: fontMono } = fonts;

  // ── EMPTY STATE: show a daily rotating quote ───────────────────────────────
  if (N === 0) {
    const allQuotes = quotesData ?? DEFAULT_QUOTES;
    const enabled   = allQuotes.filter(x => !x.disabled);
    const pool      = enabled.length ? enabled : DEFAULT_QUOTES;
    const pinned    = pin ? pool.find(x => x.id === pin.id) : undefined;
    const { q, c, s } = pinned ?? pool[Math.floor(Math.random() * pool.length)];
    const portrait = await loadPortrait(new URL(req.url).origin, c);
    const qFont  = QUOTE_FONT;
    const qLines = Math.max(1, Math.ceil(q.length / Math.floor(TEXT_W / (qFont * 0.54))));
    const faceH  = portrait ? FACE_PX + FACE_GAP : 0;
    const quoteBlockH = faceH + qLines * qFont * 1.18 + 60 + 38 + 16 + 28; // face + text + gap + character + gap + show
    const safeH  = SAFE_BOTTOM - SAFE_TOP;
    const qTop   = SAFE_TOP + Math.max(0, Math.floor((safeH - FOOTER_H - quoteBlockH) / 2));

    return new ImageResponse(
      (
        <div style={{ width: W, height: H, background: "#000", display: "flex", fontFamily: "Gabarito", position: "relative" }}>
          <Backdrop src={backdrop} />

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: qTop,
            paddingLeft: SIDE_PAD, paddingRight: SIDE_PAD, width: "100%", position: "relative" }}>

            {/* Dot portrait — centered above the quote */}
            {portrait && (
              <div style={{ display: "flex", justifyContent: "center", width: "100%", marginBottom: FACE_GAP }}>
                <img src={portrait} width={FACE_PX} height={FACE_PX} />
              </div>
            )}

            {/* Quote text — centered (monument layout) */}
            <span style={{
              fontSize: qFont, color: WHITE, fontFamily: "GabaritoReg", fontWeight: 400,
              letterSpacing: qFont > 72 ? "-0.04em" : "-0.02em",
              lineHeight: 1.18, marginBottom: 60, textAlign: "center",
            }}>
              &ldquo;{q}&rdquo;
            </span>

            {/* Character — frost, prominent */}
            <span style={{
              fontSize: 34, color: FROST, fontFamily: "Arimo", fontWeight: 700,
              letterSpacing: "0.12em", marginBottom: 16, textAlign: "center",
              textShadow: `0 0 18px ${GLOW}`,
            }}>
              {c}
            </span>

            {/* Show name — small, dimmed */}
            <span style={{
              fontSize: 24, color: DIM, fontFamily: "Arimo", fontWeight: 700, letterSpacing: "0.18em",
              textAlign: "center",
            }}>
              {s.toUpperCase()}
            </span>
          </div>

          {/* Footer: signature centered */}
          <div style={{ position: "absolute", bottom: H - SAFE_BOTTOM + 10,
            left: 0, right: 0,
            display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
            <SignatureEl />
          </div>
        </div>
      ),
      {
        width: W, height: H,
        fonts: [
          { name: "Gabarito",      data: fontGabarito,    style: "normal", weight: 900 },
          { name: "GabaritoReg",   data: fontGabaritoReg, style: "normal", weight: 400 },
          { name: "Arimo",         data: fontArimo,       style: "normal", weight: 700 },
          { name: "IBM Plex Mono", data: fontMono,        style: "normal", weight: 700 },
        ],
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }

  // ── REMINDER MODE ─────────────────────────────────────────────────────────
  // Code mode: reminders render in the coded language (UI/DB stay English).
  const codeOn      = !!settings?.codeMode;
  const displayed   = sorted.slice(0, MAX_DISPLAY)
    .map(r => codeOn ? { ...r, text: encodeReminder(r.text) } : r);
  const hiddenCount = Math.max(0, sorted.length - MAX_DISPLAY);
  const hasOverflow = hiddenCount > 0;
  const availH  = SAFE_BOTTOM - SAFE_TOP - HEADER_H - FOOTER_H - (hasOverflow ? OVERFLOW_ROW_H : 0);
  const { fontSize, itemHeights, lineCounts } = computeLayout(displayed, TEXT_W, availH);
  const NUM_PX  = Math.max(22, Math.round(fontSize * 0.35));
  const totalItemH = itemHeights.reduce((a, b) => a + b, 0);
  const blockH  = HEADER_H + totalItemH + (hasOverflow ? OVERFLOW_ROW_H : 0) + FOOTER_H;
  const topPad  = Math.max(SAFE_TOP, Math.min(Math.floor(H / 2 - blockH / 2), SAFE_BOTTOM - blockH));
  const textLS  = fontSize > 72 ? "-0.04em" : fontSize > 50 ? "-0.02em" : "-0.01em";
  const DN      = displayed.length;

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, background: "#000", display: "flex", fontFamily: "Gabarito", position: "relative" }}>
        <Backdrop src={backdrop} />

        <div style={{ display: "flex", flexDirection: "column", paddingTop: topPad,
          paddingLeft: SIDE_PAD, paddingRight: SIDE_PAD, width: "100%", position: "relative" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 50, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 7, height: 7, background: FROST, borderRadius: "50%", display: "flex", flexShrink: 0 }} />
              <span style={{ fontSize: 26, color: FROST, letterSpacing: "0.40em", fontFamily: "Arimo", fontWeight: 700 }}>{dayName}</span>
            </div>
            <span style={{ fontSize: 26, color: pending.length > 0 ? FROST : MUTED, letterSpacing: "0.08em", fontFamily: "Arimo", fontWeight: 700 }}>
              {pending.length > 0 ? `${pending.length} left` : "all done  ✓"}
            </span>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: FROST, opacity: 0.22, marginBottom: 22, display: "flex" }} />

          {/* Year progress */}
          <div style={{ display: "flex", alignItems: "center", height: 22, marginTop: -4, marginBottom: PROGRESS_H - 18 }}>
            <span style={{ fontSize: 22, color: STEEL, fontFamily: "IBM Plex Mono", fontWeight: 700, letterSpacing: "0.10em", lineHeight: 1 }}>
              DAY {dayOfYear}
            </span>
            <div style={{ display: "flex", flex: 1, height: 4, borderRadius: 2, marginLeft: 20, marginRight: 20,
              background: "rgba(159,203,234,0.14)" }}>
              <div style={{ display: "flex", width: `${(dayOfYear / daysInYear) * 100}%`, height: 4, borderRadius: 2, background: ICE }} />
            </div>
            <span style={{ fontSize: 22, color: STEEL, fontFamily: "IBM Plex Mono", fontWeight: 700, letterSpacing: "0.10em", lineHeight: 1 }}>
              WK {week}
            </span>
          </div>

          {/* Reminder rows — capped at MAX_DISPLAY */}
          {displayed.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", height: itemHeights[i],
              borderBottom: (i < DN - 1 || hasOverflow) ? `1px solid ${ROW_LINE}` : "none" }}>
              <div style={{ width: BAR_W, height: Math.round(lineCounts[i] * fontSize * 1.15),
                background: r.done ? "transparent" : ICE,
                borderRadius: 2, flexShrink: 0, marginRight: BAR_MR }} />
              <span style={{ fontSize: NUM_PX, color: FROST, fontFamily: "IBM Plex Mono", fontWeight: 700, letterSpacing: "0.06em",
                width: NUM_W, textAlign: "right", flexShrink: 0, opacity: r.done ? 0.3 : 1, lineHeight: 1,
                textShadow: r.done ? "none" : `0 0 14px ${GLOW}` }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div style={{ width: COL_GAP, flexShrink: 0 }} />
              <span style={{ fontSize, color: r.done ? DONE_C : WHITE, fontFamily: "GabaritoReg", fontWeight: 400, letterSpacing: textLS,
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
              <span style={{ fontSize: Math.max(28, Math.round(fontSize * 0.40)), color: MUTED,
                fontFamily: "Arimo", fontWeight: 700, letterSpacing: "0.10em" }}>
                + {hiddenCount} more
              </span>
            </div>
          )}

          {/* Footer: signature centered */}
          <div style={{ position: "absolute", bottom: H - SAFE_BOTTOM + 10,
            left: 0, right: 0,
            display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
            <SignatureEl />
          </div>
        </div>
      </div>
    ),
    {
      width: W, height: H,
      fonts: [
        { name: "Gabarito",      data: fontGabarito,    style: "normal", weight: 900 },
        { name: "GabaritoReg",   data: fontGabaritoReg, style: "normal", weight: 400 },
        { name: "Arimo",         data: fontArimo,       style: "normal", weight: 700 },
        { name: "IBM Plex Mono", data: fontMono,     style: "normal", weight: 700 },
      ],
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
