import { ImageResponse } from "@vercel/og";
import { redis, KEY } from "@/lib/redis";
import { Quote, DEFAULT_QUOTES, QUOTES_KEY, PIN_KEY, slugify } from "@/lib/quotes";
import { encodeReminder, SETTINGS_KEY, Settings } from "@/lib/encode";
import { COND, HEAVY, HEAVY_LIST, breakLines, fitBlock, fitList, lineCount, wordGap } from "@/lib/poster-fit";
import THEME from "@/lib/poster-theme.json";

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

// ── Poster grid ───────────────────────────────────────────────────────────────
// Everything below the lock-screen clock (which ends ~y 640) on a 64 px margin.
const M      = 64;
const INNER  = W - 2 * M;                 // 1078
const TOP    = 690;                       // first rule under the clock
const PHOTO  = { x: M, y: 720, w: 700, h: 960 };
const QUOTE_BOX     = { x: 58, y: 1735, w: 1096, h: 520 };
const QUOTE_BOX_TXT = { x: 58, y: 960,  w: 1096, h: 1295 };   // no photo: the quote takes its place
const FOOT_Y = 2290;
const LIST   = { y: 890, h: 1180 };
const STRIP_Y = 2130;
const MAX_DISPLAY = 6;

const RULE = `3px solid ${THEME.ink}`;
const TZ = "Asia/Kolkata";

// ── Fonts (fontsource on jsDelivr — .woff is what Satori accepts) ─────────────
const FONT_URLS = {
  heavy: "https://cdn.jsdelivr.net/npm/@fontsource/archivo-black@5.2.8/files/archivo-black-latin-400-normal.woff",
  cond:  "https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans-condensed@5.2.8/files/ibm-plex-sans-condensed-latin-600-normal.woff",
  mono:  "https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5.2.7/files/ibm-plex-mono-latin-500-normal.woff",
};
let _fonts: { heavy: ArrayBuffer; cond: ArrayBuffer; mono: ArrayBuffer } | null = null;

async function getFonts() {
  if (_fonts) return _fonts;
  const [heavy, cond, mono] = await Promise.all(
    [FONT_URLS.heavy, FONT_URLS.cond, FONT_URLS.mono].map(u => fetch(u).then(r => r.arrayBuffer())),
  );
  _fonts = { heavy, cond, mono };
  return _fonts;
}

// ── Images from /public, cached per instance as data URIs ─────────────────────
// Backdrop: scripts/generate_backdrop.mjs (dithered, so the navy ramp doesn't band).
// Portraits: scripts/generate_poster_portraits.mjs (700×960 + 300×300 duotone).
const _images = new Map<string, string | null>();

async function loadImage(origin: string, path: string): Promise<string | null> {
  if (_images.has(path)) return _images.get(path) ?? null;
  try {
    const res = await fetch(`${origin}${path}`);
    if (!res.ok) { _images.set(path, null); return null; }
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const mime = path.endsWith(".png") ? "image/png" : "image/jpeg";
    const uri = `data:${mime};base64,${btoa(bin)}`;
    _images.set(path, uri);
    return uri;
  } catch {
    return null;
  }
}

// ── Local calendar: weekday, day of year ─────────────────────────────────────
function calendar(now: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", weekday: "long" })
      .formatToParts(now).map(x => [x.type, x.value]),
  );
  const y = +p.year;
  const t = Date.UTC(y, +p.month - 1, +p.day);
  const dayOfYear  = Math.round((t - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
  const daysInYear = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  return { weekday: p.weekday, dayOfYear, daysInYear };
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
const pad3 = (n: number) => String(n).padStart(3, "0");

// ── Building blocks ───────────────────────────────────────────────────────────
const Cell = ({ label, value, grow }: { label: string; value: string; grow?: number }) => (
  <div style={{ display: "flex", flexDirection: "column", borderTop: RULE, paddingTop: 14, flexGrow: grow ?? 0, flexBasis: grow ? 0 : "auto" }}>
    <span style={{ fontFamily: "Mono", fontSize: 22, letterSpacing: "0.08em", color: THEME.label, marginBottom: 8 }}>{label}</span>
    <span style={{ fontFamily: "Plex", fontSize: 40, lineHeight: 1.05, color: THEME.ink }}>{value}</span>
  </div>
);

// Heavy display text, pre-broken into lines (Satori never re-wraps it) with hand-set word gaps.
type HeavyFace = typeof HEAVY;
const HeavyLines = ({ text, size, maxW, face, lineHeight }: { text: string; size: number; maxW: number; face: HeavyFace; lineHeight: number }) => {
  const lines = breakLines(text, size, maxW, face) ?? [[text]];
  return (
    <div style={{ display: "flex", flexDirection: "column", fontFamily: "Archivo", fontSize: size, lineHeight,
      letterSpacing: `${face.tracking}em` }}>
      {lines.map((words, i) => (
        <div key={i} style={{ display: "flex", whiteSpace: "nowrap" }}>
          {words.map((w, j) => (
            <span key={j} style={{ marginRight: j < words.length - 1 ? Math.round(wordGap(w, size, face)) : 0 }}>{w}</span>
          ))}
        </div>
      ))}
    </div>
  );
};

const Backdrop = ({ src }: { src: string | null }) => src
  ? <img src={src} width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }} />
  : <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex",
      background: `linear-gradient(180deg,${THEME.bg.top} 0%,${THEME.bg.mid} 55%,${THEME.bg.bot} 100%)` }} />;

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const [data, quotesData, pin, settings, fonts, backdrop] = await Promise.all([
    redis.get<Reminder[]>(KEY),
    redis.get<Quote[]>(QUOTES_KEY),
    redis.get<{ id: string }>(PIN_KEY),
    redis.get<Settings>(SETTINGS_KEY),
    getFonts(),
    loadImage(origin, "/backdrops/poster-navy.png"),
  ]);

  const all     = (data ?? []).sort((a, b) => a.order - b.order);
  const sorted  = [...all.filter(r => !r.done), ...all.filter(r => r.done)];
  const pending = sorted.filter(r => !r.done).length;
  const N       = sorted.length;
  const { weekday, dayOfYear, daysInYear } = calendar(new Date());

  // Today's quote — shown full-screen when the list is empty, and in a strip otherwise.
  const allQuotes = quotesData ?? DEFAULT_QUOTES;
  const enabled   = allQuotes.filter(x => !x.disabled);
  const pool      = enabled.length ? enabled : DEFAULT_QUOTES;
  const quote     = (pin && pool.find(x => x.id === pin.id)) || pool[Math.floor(Math.random() * pool.length)];
  const slug      = slugify(quote.c);
  const sameAsSource = quote.s.trim().toLowerCase() === quote.c.trim().toLowerCase();
  const speaker   = titleCase(quote.c);

  const fontList = [
    { name: "Archivo", data: fonts.heavy, style: "normal" as const, weight: 400 as const },
    { name: "Plex",    data: fonts.cond,  style: "normal" as const, weight: 600 as const },
    { name: "Mono",    data: fonts.mono,  style: "normal" as const, weight: 500 as const },
  ];
  const opts = { width: W, height: H, fonts: fontList, headers: { "Cache-Control": "no-store, max-age=0" } };

  // ── QUOTE SCREEN (empty list) ──────────────────────────────────────────────
  if (N === 0) {
    const photo = await loadImage(origin, `/portraits/poster/${slug}.jpg`);
    const text  = quote.q.toUpperCase();
    const box   = photo ? QUOTE_BOX : QUOTE_BOX_TXT;
    const size  = fitBlock(text, box, HEAVY, 0.88, photo ? 154 : 190, 52);
    const cells = [
      ...(sameAsSource ? [] : [{ label: "FROM", value: quote.s }]),
      { label: "SPOKEN BY", value: speaker },
      { label: "TODAY", value: weekday },
    ];
    const number = Math.max(1, allQuotes.findIndex(x => x.id === quote.id) + 1);

    return new ImageResponse(
      (
        <div style={{ width: W, height: H, display: "flex", position: "relative", background: THEME.bg.mid, fontFamily: "Plex", color: THEME.ink }}>
          <Backdrop src={backdrop} />

          {photo ? (
            <>
              <img src={photo} width={PHOTO.w} height={PHOTO.h} style={{ position: "absolute", left: PHOTO.x, top: PHOTO.y }} />
              <div style={{ position: "absolute", left: 820, top: PHOTO.y, width: W - 820 - M, display: "flex", flexDirection: "column", gap: 34 }}>
                {cells.map(c => <Cell key={c.label} label={c.label} value={c.value} />)}
              </div>
            </>
          ) : (
            <div style={{ position: "absolute", left: M, top: PHOTO.y, width: INNER, display: "flex", gap: 28 }}>
              {cells.map(c => <Cell key={c.label} label={c.label} value={c.value} grow={1} />)}
            </div>
          )}

          <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, display: "flex", overflow: "hidden" }}>
            <HeavyLines text={text} size={size} maxW={box.w} face={HEAVY} lineHeight={0.88} />
          </div>

          <div style={{ position: "absolute", left: M, top: FOOT_Y, width: INNER, display: "flex", justifyContent: "space-between",
            borderTop: RULE, paddingTop: 18, fontSize: 30, letterSpacing: "0.22em" }}>
            <span>QUOTE {pad3(number)} / {pad3(allQuotes.length)}</span>
            <span>{dayOfYear} / {daysInYear}</span>
          </div>
        </div>
      ),
      opts,
    );
  }

  // ── REMINDER SCREEN ────────────────────────────────────────────────────────
  // Code mode: reminders render in the coded language (UI/DB stay English).
  const codeOn    = !!settings?.codeMode;
  const shown     = sorted.slice(0, MAX_DISPLAY).map(r => ({ ...r, text: (codeOn ? encodeReminder(r.text) : r.text).toUpperCase() }));
  const hidden    = N - shown.length;
  const size      = fitList(shown.map(r => r.text), hidden > 0, { w: INNER, h: LIST.h }, 230, 74);
  const num       = Math.round(size * 0.26);

  const thumb     = await loadImage(origin, `/portraits/poster/${slug}-sq.jpg`);
  const stripText = `“${quote.q}”`;
  const stripW    = INNER - (thumb ? 180 : 0);
  const stripSize = [40, 34, 30, 26].find(s => lineCount(stripText, s, stripW, COND) <= (s === 40 ? 2 : 3)) ?? 26;
  const stripMeta = sameAsSource ? quote.c : `${quote.c} · ${quote.s.toUpperCase()}`;

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", background: THEME.bg.mid, fontFamily: "Plex", color: THEME.ink }}>
        <Backdrop src={backdrop} />

        <div style={{ position: "absolute", left: M, top: TOP, width: INNER, display: "flex", gap: 28 }}>
          <Cell label="TODAY" value={weekday} grow={1.2} />
          <Cell label="DAY" value={`${dayOfYear} / ${daysInYear}`} grow={1} />
          <Cell label="LEFT" value={`${pending} of ${N}`} grow={1} />
        </div>

        <div style={{ position: "absolute", left: M, top: LIST.y, width: INNER, height: LIST.h, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {shown.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "flex-start", paddingTop: Math.round(size * 0.16), paddingBottom: Math.round(size * 0.2),
              borderBottom: i < shown.length - 1 ? `2px solid ${THEME.faint}` : "none" }}>
              {/* Done items: faded, with DONE in place of the number (Satori's line-through is too heavy) */}
              <span style={{ fontFamily: "Mono", fontSize: num, color: THEME.label, width: Math.round(size * 0.676), flexShrink: 0, marginRight: 26,
                paddingTop: Math.round(size * 0.12) }}>
                {r.done ? "DONE" : String(i + 1).padStart(2, "0")}
              </span>
              <div style={{ display: "flex", flex: 1, opacity: r.done ? 0.28 : 1 }}>
                <HeavyLines text={r.text} size={size} maxW={INNER - Math.round(size * 0.676) - 26} face={HEAVY_LIST} lineHeight={0.9} />
              </div>
            </div>
          ))}
          {hidden > 0 && (
            <span style={{ fontFamily: "Mono", fontSize: Math.round(size * 0.3), letterSpacing: "0.1em", color: THEME.label, paddingTop: Math.round(size * 0.18) }}>
              + {hidden} MORE
            </span>
          )}
        </div>

        <div style={{ position: "absolute", left: M, top: STRIP_Y, width: INNER, display: "flex", alignItems: "center", gap: 30, borderTop: RULE, paddingTop: 26 }}>
          {thumb && <img src={thumb} width={150} height={150} style={{ flexShrink: 0 }} />}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <span style={{ fontSize: stripSize, lineHeight: 1.15, marginBottom: 10 }}>{stripText}</span>
            <span style={{ fontFamily: "Mono", fontSize: 22, letterSpacing: "0.08em", color: THEME.label }}>{stripMeta}</span>
          </div>
        </div>
      </div>
    ),
    opts,
  );
}
