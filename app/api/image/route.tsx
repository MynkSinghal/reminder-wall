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
const TOP_PAD = 220;
const BOTTOM_PAD = 140;
const SIDE_PAD = 88;

export async function GET() {
  const redis = Redis.fromEnv();
  const data = await redis.get<Reminder[]>("reminders");
  const reminders: Reminder[] = (data ?? []).sort((a, b) => a.order - b.order);

  const pending = reminders.filter((r) => !r.done);
  const done = reminders.filter((r) => r.done);
  const all = [...pending, ...done];

  let fontData: ArrayBuffer | null = null;
  try {
    const res = await fetch(
      "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2"
    );
    fontData = await res.arrayBuffer();
  } catch {
    // fallback to system font
  }

  const now = new Date();
  const updatedStr = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const COL_PENDING = "#ffffff";
  const COL_DONE = "#3a3a3a";
  const COL_NUM_PENDING = "#4a4a4a";
  const COL_NUM_DONE = "#2a2a2a";
  const COL_LABEL = "#2a2a2a";
  const COL_FOOTER = "#222222";

  const FONT_LABEL = 26;
  const FONT_ITEM = 44;
  const FONT_NUMBER = 30;
  const FONT_FOOTER = 22;
  const LINE_HEIGHT = 80;

  const availableHeight = H - TOP_PAD - BOTTOM_PAD;
  const headerHeight = 100;
  const maxItems = Math.floor((availableHeight - headerHeight) / LINE_HEIGHT);
  const visible = all.slice(0, maxItems);

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          background: "#000000",
          display: "flex",
          flexDirection: "column",
          padding: `${TOP_PAD}px ${SIDE_PAD}px ${BOTTOM_PAD}px`,
          fontFamily: fontData ? "Inter" : "sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 20,
            marginBottom: 56,
          }}
        >
          <span
            style={{
              fontSize: FONT_LABEL,
              color: COL_LABEL,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              fontWeight: 400,
            }}
          >
            REMINDERS
          </span>
          {reminders.length > 0 && (
            <span
              style={{
                fontSize: FONT_LABEL - 4,
                color: COL_LABEL,
                letterSpacing: "0.1em",
              }}
            >
              {pending.length}/{reminders.length}
            </span>
          )}
        </div>

        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          {visible.length === 0 ? (
            <span
              style={{
                fontSize: FONT_ITEM,
                color: COL_DONE,
                fontWeight: 300,
                letterSpacing: "0.02em",
              }}
            >
              Nothing here yet.
            </span>
          ) : (
            visible.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 28,
                  height: LINE_HEIGHT,
                  borderBottom:
                    i < visible.length - 1 ? "1px solid #111" : "none",
                }}
              >
                <span
                  style={{
                    fontSize: FONT_NUMBER,
                    color: r.done ? COL_NUM_DONE : COL_NUM_PENDING,
                    width: 40,
                    textAlign: "right",
                    flexShrink: 0,
                    fontWeight: 300,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    fontSize: FONT_ITEM,
                    color: r.done ? COL_DONE : COL_PENDING,
                    fontWeight: r.done ? 300 : 400,
                    textDecoration: r.done ? "line-through" : "none",
                    flex: 1,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.text}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 32 }}>
          <span
            style={{
              fontSize: FONT_FOOTER,
              color: COL_FOOTER,
              letterSpacing: "0.08em",
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
      fonts: fontData
        ? [{ name: "Inter", data: fontData, style: "normal", weight: 400 }]
        : [],
    }
  );
}
