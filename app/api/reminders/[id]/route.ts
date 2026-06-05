import { NextResponse } from "next/server";
import { redis, KEY } from "@/lib/redis";
import type { Reminder } from "../route";

async function getAll(): Promise<Reminder[]> {
  const data = await redis.get<Reminder[]>(KEY);
  return data ?? [];
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const reminders = await getAll();
  const idx = reminders.findIndex((r) => r.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  reminders[idx] = { ...reminders[idx], ...body };
  await redis.set(KEY, reminders);
  return NextResponse.json(reminders[idx]);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const reminders = await getAll();
  const filtered = reminders.filter((r) => r.id !== id);
  await redis.set(KEY, filtered);
  return NextResponse.json({ ok: true });
}
