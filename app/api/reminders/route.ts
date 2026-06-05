import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

export interface Reminder {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

const KEY = "reminders";

async function getAll(): Promise<Reminder[]> {
  const data = await kv.get<Reminder[]>(KEY);
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
  await kv.set(KEY, reminders);
  return NextResponse.json(newReminder, { status: 201 });
}
