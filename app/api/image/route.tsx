import { ImageResponse } from "@vercel/og";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

export const runtime = "edge";

interface Reminder {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

const W = 1179;
const H = 2556;

const TOP_PAD = 980;   // safely below clock on any iPhone lock screen
const SIDE_PAD = 80;
const BOTTOM_PAD = 220;

const ORANGE = "#FF693C";
const WHITE = "#FFFFFF";
const DONE_COL = "#1E1E1E";
const DIVIDER = "#101010";
const FOOTER_COL = "#1A1A1A";

export async function GET(request: NextRequest) {
  // Load bundled Inter Bold (woff v1 — works with Satori)
  const origin = new URL(request.url).origin;
  let fontData: ArrayBuffer | null = null;
  try {
    const res = await fetch(`${origin}/fonts/Inter-Bold.woff`);
    if (res.ok) fontData = await res.arrayBuffer();
  } catch {
    // render without custom font
  }

  const redis = Redis.fromEnv();
  const data = await redis.get<Reminder[]>("reminders");
  const reminders: Reminder[] = (data ?? []).sort((a, b) => a.order - b.order);

  const pending = reminders.filter((r) => !r.done);
  const done    = reminders.filter((r) => r.done);
  const all     = [...pending, ...done].slice(0, 5);

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
  });

  // Dynamic row height — fewer items = more space per item, always in-your-face
  const HEADER_H = 110;
  const usable   = H - TOP_PAD - BOTTOM_PAD - HEADER_H;
  const count    = Math.max(all.length, 1);
  const ITEM_H   = Math.floor(usable / Math.min(count, 5));

  // Font size scales with item height — bigger when fewer items
  const TEXT_SIZE = Math.min(Math.floor(ITEM_H * 0.52), 110);
  const NUM_SIZE  = Math.floor(TEXT_SIZE * 0.25);

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
          fontFamily: fontData ? "Inter" : "sans-serif",
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <span style={{ fontSize: 20, color: ORANGE, letterSpacing: "0.32em", fontWeight: 700 }}>
            REMINDERS
          </span>
          <span style={{ fontSize: 20, color: pending.length > 0 ? ORANGE : FOOTER_COL, letterSpacing: "0.1em", fontWeight: 700, opacity: 0.85 }}>
            {pending.length} left
          </span>
        </div>
        <div style={{ height: 1, background: ORANGE, opacity: 0.18, display: "flex" }} />

        {/* ── Items ── */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          {all.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <span style={{ fontSize: 90, color: DONE_COL, fontWeight: 700 }}>nothing.</span>
            </div>
          ) : (
            all.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  height: ITEM_H,
                  borderBottom: `1px solid ${DIVIDER}`,
                  paddingLeft: 4,
                  gap: 4,
                  opacity: r.done ? 0.18 : 1,
                }}
              >
                <span style={{ fontSize: NUM_SIZE, color: ORANGE, fontWeight: 700, letterSpacing: "0.12em", lineHeight: 1 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    fontSize: TEXT_SIZE,
                    color: r.done ? DONE_COL : WHITE,
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                    textDecoration: r.done ? "line-through" : "none",
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
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 18 }}>
          <span style={{ fontSize: 18, color: FOOTER_COL, letterSpacing: "0.06em" }}>
            {timeStr}
          </span>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: fontData
        ? [{ name: "Inter", data: fontData, style: "normal", weight: 700 }]
        : [],
    }
  );
}
