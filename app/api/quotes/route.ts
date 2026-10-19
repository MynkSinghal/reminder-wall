import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { redis } from "@/lib/redis";
import {
  Quote, DEFAULT_QUOTES, QUOTES_KEY, PIN_KEY, PORTRAIT_KEY, POSTER_PHOTO_KEY, POSTER_THUMB_KEY, slugify,
} from "@/lib/quotes";

const JPEG = "data:image/jpeg;base64,";
const MAX_PHOTO = 600_000; // chars of data URI

async function getQuotes(): Promise<Quote[]> {
  const data = await redis.get<Quote[]>(QUOTES_KEY);
  if (data && data.length) return data;
  await redis.set(QUOTES_KEY, DEFAULT_QUOTES); // first run: seed
  return DEFAULT_QUOTES;
}

// GET → { quotes, pin, thumbs: { slug: dataUri } }  (thumbs = uploaded poster photos)
export async function GET() {
  const [quotes, pin] = await Promise.all([getQuotes(), redis.get<{ id: string }>(PIN_KEY)]);
  const customSlugs = [...new Set(quotes.filter(q => q.custom).map(q => slugify(q.c)))];
  const thumbs: Record<string, string> = {};
  const loaded = await Promise.all(
    customSlugs.map(async slug => [slug, await redis.get<string>(POSTER_THUMB_KEY(slug))] as const),
  );
  for (const [slug, p] of loaded) if (p) thumbs[slug] = p;
  return NextResponse.json({ quotes, pin: pin ?? null, thumbs });
}

// POST { q, c, s, photo?, thumb? } → add custom quote (+ optional poster photo, JPEG data URIs)
export async function POST(req: Request) {
  const { q, c, s, photo, thumb } = await req.json();
  if (!q?.trim() || !c?.trim()) {
    return NextResponse.json({ error: "quote and character required" }, { status: 400 });
  }
  const quotes = await getQuotes();
  const quote: Quote = {
    id: nanoid(), q: q.trim(), c: c.trim().toUpperCase(),
    s: (s ?? "").trim() || c.trim(), custom: true,
  };
  quotes.push(quote);
  await redis.set(QUOTES_KEY, quotes);
  const valid = (x: unknown): x is string => typeof x === "string" && x.startsWith(JPEG) && x.length <= MAX_PHOTO;
  if (valid(photo) && valid(thumb)) {
    const slug = slugify(quote.c);
    await Promise.all([redis.set(POSTER_PHOTO_KEY(slug), photo), redis.set(POSTER_THUMB_KEY(slug), thumb)]);
  }
  return NextResponse.json(quote, { status: 201 });
}

// PATCH { id, disabled?, q?, c?, s? } → update | { pin: id | null } → pin/unpin
export async function PATCH(req: Request) {
  const body = await req.json();
  if ("pin" in body) {
    if (body.pin === null) await redis.del(PIN_KEY);
    else await redis.set(PIN_KEY, { id: body.pin });
    return NextResponse.json({ ok: true });
  }
  const { id, disabled, q, c, s } = body;
  const quotes = await getQuotes();
  const idx = quotes.findIndex(x => x.id === id);
  if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });
  const cur = { ...quotes[idx] };
  if (disabled !== undefined) cur.disabled = !!disabled;
  if (typeof q === "string" && q.trim()) cur.q = q.trim();
  if (typeof c === "string" && c.trim()) {
    // keep the portrait reachable if the character is renamed
    const oldSlug = slugify(cur.c), newSlug = slugify(c.trim().toUpperCase());
    if (oldSlug !== newSlug) {
      for (const key of [PORTRAIT_KEY, POSTER_PHOTO_KEY, POSTER_THUMB_KEY]) {
        const p = await redis.get<string>(key(oldSlug));
        if (p) await redis.set(key(newSlug), p);
      }
    }
    cur.c = c.trim().toUpperCase();
  }
  if (typeof s === "string") cur.s = s.trim() || cur.s;
  quotes[idx] = cur;
  await redis.set(QUOTES_KEY, quotes);
  return NextResponse.json(cur);
}

// DELETE { id } → remove a custom quote (built-ins can only be disabled)
export async function DELETE(req: Request) {
  const { id } = await req.json();
  const quotes = await getQuotes();
  const target = quotes.find(x => x.id === id);
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!target.custom) return NextResponse.json({ error: "built-in quotes can only be disabled" }, { status: 400 });
  const filtered = quotes.filter(x => x.id !== id);
  await redis.set(QUOTES_KEY, filtered);
  // drop the portrait only if no other quote uses this character
  const slug = slugify(target.c);
  if (!filtered.some(x => slugify(x.c) === slug)) {
    await redis.del(PORTRAIT_KEY(slug), POSTER_PHOTO_KEY(slug), POSTER_THUMB_KEY(slug));
  }
  const pin = await redis.get<{ id: string }>(PIN_KEY);
  if (pin?.id === id) await redis.del(PIN_KEY);
  return NextResponse.json({ ok: true });
}
