import { ImageResponse } from "@vercel/og";
import { Redis } from "@upstash/redis";

export const runtime = "edge";

interface Reminder {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

// iPhone 14 Pro native resolution
const W = 1179;
const H = 2556;

// Matching The-Day-Grid layout math exactly:
// grid start_y = (H/2) - (grid_h/2) + 150 ≈ 798
// We start our content exactly there so it sits in the same visual zone as the dots.
const TOP_PAD = 798;
const SIDE_PAD = 88;
const BOTTOM_PAD = 160;

const ORANGE = "#FF693C";
const ORANGE_DIM = "#7A3018";
const WHITE = "#FFFFFF";
const GRAY = "#1E1E1E";      // done text
const DIVIDER = "#141414";
const FOOTER = "#1A1A1A";

export async function GET() {
  const redis = Redis.fromEnv();
  const data = await redis.get<Reminder[]>("reminders");
  const reminders: Reminder[] = (data ?? []).sort((a, b) => a.order - b.order);

  const pending = reminders.filter((r) => !r.done);
  const done = reminders.filter((r) => r.done);
  const all = [...pending, ...done];

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  // Each row = 96px; usable height below TOP_PAD minus BOTTOM_PAD minus header
  const ITEM_H = 96;
  const HEADER_H = 108;
  const usable = H - TOP_PAD - BOTTOM_PAD - HEADER_H;
  const maxItems = Math.floor(usable / ITEM_H);
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
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <span
            style={{
              fontSize: 24,
              color: ORANGE,
              letterSpacing: "0.30em",
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            REMINDERS
          </span>
          <span
            style={{
              fontSize: 28,
              color: pending.length > 0 ? ORANGE : GRAY,
              letterSpacing: "0.05em",
              lineHeight: 1,
              opacity: 0.9,
            }}
          >
            {pending.length} left
          </span>
        </div>

        {/* Orange rule */}
        <div
          style={{
            height: 1,
            background: ORANGE,
            opacity: 0.25,
            marginBottom: 12,
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
                height: ITEM_H * 2,
                gap: 28,
              }}
            >
              <span
                style={{ fontSize: 52, color: GRAY, letterSpacing: "0.02em" }}
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
                  alignItems: "center",
                  height: ITEM_H,
                  gap: 32,
                  borderBottom: `1px solid ${DIVIDER}`,
                  opacity: r.done ? 0.22 : 1,
                }}
              >
                {/* Number — orange for pending */}
                <span
                  style={{
                    fontSize: 30,
                    color: r.done ? GRAY : ORANGE_DIM,
                    width: 48,
                    textAlign: "right",
                    flexShrink: 0,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Reminder text */}
                <span
                  style={{
                    fontSize: 52,
                    color: r.done ? GRAY : WHITE,
                    fontWeight: r.done ? 400 : 600,
                    textDecoration: r.done ? "line-through" : "none",
                    flex: 1,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {r.text}
                </span>

                {/* Done checkmark */}
                {r.done && (
                  <span
                    style={{
                      fontSize: 28,
                      color: ORANGE,
                      flexShrink: 0,
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
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 28,
          }}
        >
          <span
            style={{
              fontSize: 22,
              color: FOOTER,
              letterSpacing: "0.05em",
            }}
          >
            {dateStr}
          </span>
          <span
            style={{
              fontSize: 22,
              color: FOOTER,
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
