import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { SETTINGS_KEY, Settings } from "@/lib/encode";

export async function GET() {
  const s = await redis.get<Settings>(SETTINGS_KEY);
  return NextResponse.json({ codeMode: !!s?.codeMode });
}

export async function PATCH(req: Request) {
  const { codeMode } = await req.json();
  const s = (await redis.get<Settings>(SETTINGS_KEY)) ?? {};
  s.codeMode = !!codeMode;
  await redis.set(SETTINGS_KEY, s);
  return NextResponse.json({ codeMode: s.codeMode });
}
