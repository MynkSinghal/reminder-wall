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

// Pushed lower — well below the clock zone
const TOP_PAD = 960;
const SIDE_PAD = 80;
const BOTTOM_PAD = 200;

const ORANGE = "#FF693C";
const WHITE = "#FFFFFF";
const DONE_COL = "#252525";
const DIVIDER = "#111111";
const FOOTER_COL = "#1C1C1C";

export async function GET() {
  const redis = Redis.fromEnv();
  const data = await redis.get<Reminder[]>("reminders");
  const reminders: Reminder[] = (data ?? []).sort((a, b) => a.order - b.order);

  const pending = reminders.filter((r) => !r.done);
  const done = reminders.filter((r) => r.done);
  const all = [...pending, ...done];

  // Cap at 5 — caller won't add more than that anyway
  const visible = all.slice(0, 5);

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Spread 5 items across the usable zone
  const usable = H - TOP_PAD - BOTTOM_PAD - 130; // 130 = header + rule
  const ITEM_H = Math.floor(usable / 5); // ~233px per slot

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
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <span
            style={{
              fontSize: 22,
              color: ORANGE,
              letterSpacing: "0.32em",
              fontWeight: 700,
            }}
          >
            REMINDERS
          </span>
          <span
            style={{
              fontSize: 22,
              color: pending.length > 0 ? ORANGE : FOOTER_COL,
              letterSpacing: "0.08em",
              fontWeight: 600,
              opacity: 0.8,
            }}
          >
            {pending.length} pending
          </span>
        </div>

        {/* Orange rule */}
        <div
          style={{
            height: 1,
            background: ORANGE,
            opacity: 0.2,
            marginBottom: 0,
            display: "flex",
          }}
        />

        {/* ── Items ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
          }}
        >
          {visible.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flex: 1,
              }}
            >
              <span
                style={{
                  fontSize: 72,
                  color: DONE_COL,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                nothing yet.
              </span>
            </div>
          ) : (
            visible.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  height: ITEM_H,
                  borderBottom: `1px solid ${DIVIDER}`,
                  gap: 6,
                  opacity: r.done ? 0.2 : 1,
                }}
              >
                {/* Number */}
                <span
                  style={{
                    fontSize: 22,
                    color: ORANGE,
                    letterSpacing: "0.15em",
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Text — the big one */}
                <span
                  style={{
                    fontSize: 82,
                    color: r.done ? DONE_COL : WHITE,
                    fontWeight: 800,
                    textDecoration: r.done ? "line-through" : "none",
                    letterSpacing: "-0.025em",
                    lineHeight: 1,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.text}
                </span>
              </div>
            ))
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            paddingTop: 20,
          }}
        >
          <span
            style={{
              fontSize: 20,
              color: FOOTER_COL,
              letterSpacing: "0.05em",
            }}
          >
            {timeStr}
          </span>
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
