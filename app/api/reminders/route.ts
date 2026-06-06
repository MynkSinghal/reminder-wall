import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { redis, KEY } from "@/lib/redis";

export interface Reminder {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

async function getAll(): Promise<Reminder[]> {
  const data = await redis.get<Reminder[]>(KEY);
  return data ?? [];
}

export async function GET() {
  const reminders = await getAll();
  return NextResponse.json(reminders);
}

export async function POST(req: Request) {
  const { text } = await req.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  const reminders = await getAll();
  const maxOrder = reminders.reduce((m, r) => Math.max(m, r.order), -1);
  const newReminder: Reminder = {
    id: nanoid(),
    text: text.trim(),
    done: false,
    order: maxOrder + 1,
  };
  reminders.push(newReminder);
  await redis.set(KEY, reminders);
  return NextResponse.json(newReminder, { status: 201 });
}

// Batch delete — accepts { ids: string[] } and removes all matching items in
// one atomic read-filter-write. Prevents the race condition where concurrent
// individual DELETEs all read the same blob, each removing only their own item,
// with the last write winning and restoring everything else.
export async function DELETE(req: Request) {
  const { ids } = await req.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }
  const idSet = new Set(ids);
  const reminders = await getAll();
  const filtered = reminders.filter((r) => !idSet.has(r.id));
  await redis.set(KEY, filtered);
  return NextResponse.json({ ok: true, removed: ids.length });
}

// Batch reorder — accepts { orderedIds: string[] } and assigns sequential
// order values in one atomic Redis write, avoiding race conditions from
// firing concurrent individual PATCHes.
export async function PUT(req: Request) {
  const { orderedIds } = await req.json() as { orderedIds: string[] };
  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "orderedIds array required" }, { status: 400 });
  }
  const reminders = await getAll();
  const posMap = new Map(orderedIds.map((id, i) => [id, i]));
  const updated = reminders.map((r) => ({
    ...r,
    order: posMap.has(r.id) ? posMap.get(r.id)! : r.order,
  }));
  await redis.set(KEY, updated);
  return NextResponse.json(updated);
}
