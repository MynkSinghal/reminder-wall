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
const SIDE_PAD = 80;

const ORANGE  = "#FF693C";
const WHITE   = "#FFFFFF";
const DONE    = "#202020";
const DIVIDER = "#0F0F0F";
const MUTED   = "#161616";

export async function GET(request: NextRequest) {
  // Load bundled Inter Bold woff (v1 — Satori compatible)
  const origin = new URL(request.url).origin;
  let fontData: ArrayBuffer | null = null;
  try {
    const res = await fetch(`${origin}/fonts/Inter-Bold.woff`);
    if (res.ok) fontData = await res.arrayBuffer();
  } catch { /* render with system font */ }

  const redis = Redis.fromEnv();
  const data  = await redis.get<Reminder[]>("reminders");
  const all   = (data ?? [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 5);

  const pending = all.filter((r) => !r.done);
  const sorted  = [...pending, ...all.filter((r) => r.done)];

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
  });

  // ── Layout math ──────────────────────────────────────────────
  // Each item = one compact line: "[01]  reminder text"
  const ITEM_H   = 140;   // height per row
  const TEXT_PX  = 110;   // reminder text size
  const NUM_PX   = 38;    // "01" number size — bigger & aligned
  const HEADER_H = 100;   // "REMINDERS  ·  N left" + rule
  const GAP      = 0;     // no extra gap — divider lines are enough

  const count      = sorted.length;
  const blockH     = HEADER_H + count * ITEM_H + GAP * Math.max(count - 1, 0);
  // Center block in middle of screen (H/2), but never start above y=700
  const topPad     = Math.max(Math.floor(H / 2 - blockH / 2), 700);

  return new ImageResponse(
    (
      <div
        style={{
          width: W, height: H,
          background: "#000",
          display: "flex",
          flexDirection: "column",
          paddingTop: topPad,
          paddingLeft: SIDE_PAD,
          paddingRight: SIDE_PAD,
          fontFamily: fontData ? "Inter" : "sans-serif",
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, height: 50 }}>
          <span style={{ fontSize: 26, color: ORANGE, letterSpacing: "0.35em", fontWeight: 700 }}>
            REMINDERS
          </span>
          <span style={{ fontSize: 26, color: pending.length > 0 ? ORANGE : MUTED, letterSpacing: "0.1em", fontWeight: 700 }}>
            {pending.length} left
          </span>
        </div>

        {/* Orange rule */}
        <div style={{ height: 1, background: ORANGE, opacity: 0.2, marginBottom: 28, display: "flex" }} />

        {/* ── Shopping list ── */}
        {sorted.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", height: ITEM_H }}>
            <span style={{ fontSize: TEXT_PX, color: DONE, fontWeight: 700, letterSpacing: "-0.03em" }}>
              nothing.
            </span>
          </div>
        ) : (
          sorted.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "baseline",
                height: ITEM_H,
                gap: 28,
                borderBottom: `1px solid ${DIVIDER}`,
                opacity: r.done ? 0.2 : 1,
              }}
            >
              {/* Number */}
              <span
                style={{
                  fontSize: NUM_PX,
                  color: ORANGE,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  width: 64,
                  textAlign: "right",
                  flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              {/* Text */}
              <span
                style={{
                  fontSize: TEXT_PX,
                  color: r.done ? DONE : WHITE,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  textDecoration: r.done ? "line-through" : "none",
                  flex: 1,
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

        {/* ── Timestamp ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
          <span style={{ fontSize: 16, color: MUTED, letterSpacing: "0.06em" }}>
            {timeStr}
          </span>
        </div>
      </div>
    ),
    {
      width: W, height: H,
      fonts: fontData
        ? [{ name: "Inter", data: fontData, style: "normal", weight: 700 }]
        : [],
    }
  );
}
