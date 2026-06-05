import { ImageResponse } from "@vercel/og";
import { Redis } from "@upstash/redis";

export const runtime = "edge";

interface Reminder {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

const W = 1179;
const H = 2556;

const ORANGE = "#FF6930";
const WHITE = "#FFFFFF";
const DONE_TEXT = "#2e2e2e";
const DONE_NUM = "#1e1e1e";
const LABEL_COLOR = "#FF6930";
const DIVIDER = "#151515";
const FOOTER_COLOR = "#1c1c1c";

export async function GET() {
  const redis = Redis.fromEnv();
  const data = await redis.get<Reminder[]>("reminders");
  const reminders: Reminder[] = (data ?? []).sort((a, b) => a.order - b.order);

  const pending = reminders.filter((r) => !r.done);
  const done = reminders.filter((r) => r.done);
  const all = [...pending, ...done];

  // Load a handwritten font from Google Fonts
  let caveatFont: ArrayBuffer | null = null;
  try {
    // Fetch CSS with a modern UA to get woff2
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Caveat:wght@400;700",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }
    ).then((r) => r.text());

    const urlMatch = css.match(
      /src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/
    );
    if (urlMatch?.[1]) {
      const fontRes = await fetch(urlMatch[1]);
      if (fontRes.ok) caveatFont = await fontRes.arrayBuffer();
    }
  } catch {
    // fall through to default
  }

  const fonts = caveatFont
    ? [{ name: "Caveat", data: caveatFont, style: "normal" as const, weight: 400 as const }]
    : [];

  const fontFamily = caveatFont ? "Caveat" : "sans-serif";

  const now = new Date();
  const updatedStr = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Layout constants — iPhone 14 Pro safe zones
  const TOP_PAD = 210; // below Dynamic Island + time
  const SIDE_PAD = 80;
  const BOTTOM_PAD = 150;
  const ITEM_H = 90;
  const HEADER_H = 120;

  const usableH = H - TOP_PAD - BOTTOM_PAD - HEADER_H;
  const maxItems = Math.floor(usableH / ITEM_H);
  const visible = all.slice(0, maxItems);

  const fontSize = caveatFont ? 56 : 44;
  const numSize = caveatFont ? 36 : 28;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          background: "#000000",
          display: "flex",
          flexDirection: "column",
          paddingTop: TOP_PAD,
          paddingLeft: SIDE_PAD,
          paddingRight: SIDE_PAD,
          paddingBottom: BOTTOM_PAD,
          fontFamily,
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: 48,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 28,
                color: LABEL_COLOR,
                letterSpacing: "0.28em",
                fontWeight: 700,
              }}
            >
              REMINDERS
            </span>
            <span
              style={{
                fontSize: 22,
                color: pending.length > 0 ? ORANGE : DONE_NUM,
                letterSpacing: "0.1em",
                opacity: 0.7,
              }}
            >
              {pending.length} pending
            </span>
          </div>

          {/* Orange underline */}
          <div
            style={{
              height: 1,
              background: ORANGE,
              marginTop: 18,
              opacity: 0.35,
              display: "flex",
            }}
          />
        </div>

        {/* ── Reminder Items ── */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          {visible.length === 0 ? (
            <span
              style={{
                fontSize: fontSize,
                color: DONE_TEXT,
                opacity: 0.4,
                marginTop: 24,
              }}
            >
              nothing yet.
            </span>
          ) : (
            visible.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: ITEM_H,
                  gap: 32,
                  borderBottom: `1px solid ${DIVIDER}`,
                  opacity: r.done ? 0.35 : 1,
                }}
              >
                {/* Number */}
                <span
                  style={{
                    fontSize: numSize,
                    color: r.done ? DONE_NUM : ORANGE,
                    width: 44,
                    textAlign: "right",
                    flexShrink: 0,
                    fontWeight: 400,
                    letterSpacing: "0.02em",
                  }}
                >
                  {i + 1}
                </span>

                {/* Text */}
                <span
                  style={{
                    fontSize: fontSize,
                    color: r.done ? DONE_TEXT : WHITE,
                    textDecoration: r.done ? "line-through" : "none",
                    fontWeight: 400,
                    flex: 1,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    letterSpacing: caveatFont ? "0.01em" : "0",
                  }}
                >
                  {r.text}
                </span>

                {/* Done checkmark */}
                {r.done && (
                  <span
                    style={{
                      fontSize: 20,
                      color: ORANGE,
                      flexShrink: 0,
                      opacity: 0.5,
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            paddingTop: 28,
          }}
        >
          <span
            style={{
              fontSize: 20,
              color: FOOTER_COLOR,
              letterSpacing: "0.06em",
            }}
          >
            {updatedStr}
          </span>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts,
    }
  );
}
