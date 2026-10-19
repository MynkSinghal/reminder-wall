"use client";

import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/lib/quotes";
import { slugify } from "@/lib/quotes";
import { makePosterPhoto, type Framing } from "@/lib/poster-photo";
import { Action, Icon, SectionLabel, Sheet } from "./ui";

interface QuotesData {
  quotes: Quote[];
  pin: { id: string } | null;
  thumbs: Record<string, string>;   // uploaded poster photos for custom quotes
}

type Filter = "all" | "on" | "off" | "custom";
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

function Thumb({ q, thumbs, size = 52 }: { q: Quote; thumbs: Record<string, string>; size?: number }) {
  const slug = slugify(q.c);
  const [err, setErr] = useState(false);
  const src = thumbs[slug] ?? `/portraits/poster/${slug}-sq.jpg`;
  const initials = q.c.split(/\s+/).map(w => w[0]).slice(0, 2).join("");
  return err ? (
    <div className="flex shrink-0 items-center justify-center bg-white/[0.06] font-display text-[15px] text-label" style={{ width: size, height: size }}>{initials}</div>
  ) : (
    <img src={src} alt="" onError={() => setErr(true)} className="shrink-0 bg-navy-deep object-cover" style={{ width: size, height: size }} />
  );
}

const field = "w-full rounded-[12px] border border-line bg-white/[0.04] px-3.5 py-3 text-[17px] outline-none placeholder:text-faint focus:border-label/60";

export default function QuotesTab() {
  const [data, setData]       = useState<QuotesData | null>(null);
  const [failed, setFailed]   = useState(false);
  const [filter, setFilter]   = useState<Filter>("all");
  const [activeId, setActive] = useState<string | null>(null);     // action sheet
  const [editId, setEditId]   = useState<string | null>(null);     // edit sheet
  const [adding, setAdding]   = useState(false);                   // add sheet

  const load = () => fetch("/api/quotes").then(r => r.json()).then(d => { setData(d); setFailed(false); }).catch(() => setFailed(true));
  useEffect(() => { load(); }, []);

  // fire-and-forget PATCH; UI is already updated optimistically
  const patch = (body: object) =>
    fetch("/api/quotes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(load);

  function setPin(id: string | null) {
    setData(d => d && { ...d, pin: id ? { id } : null });
    patch({ pin: id });
  }
  function setDisabled(id: string, disabled: boolean) {
    setData(d => d && { ...d, quotes: d.quotes.map(x => (x.id === id ? { ...x, disabled } : x)), pin: disabled && d.pin?.id === id ? null : d.pin });
    patch({ id, disabled });
    if (disabled && data?.pin?.id === id) patch({ pin: null });
  }
  function remove(id: string) {
    setData(d => d && { ...d, quotes: d.quotes.filter(x => x.id !== id), pin: d.pin?.id === id ? null : d.pin });
    fetch("/api/quotes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(load);
  }
  function saveEdit(id: string, q: string, c: string, s: string) {
    setData(d => d && { ...d, quotes: d.quotes.map(x => (x.id === id ? { ...x, q: q.trim(), c: c.trim().toUpperCase(), s: s.trim() || x.s } : x)) });
    patch({ id, q, c, s });
  }

  if (failed) return <p className="pt-10 text-[17px] text-dim">Couldn&apos;t load quotes. Check your connection, then switch tabs to retry.</p>;
  if (!data) return (
    <div className="flex flex-col gap-2 pt-2" aria-label="Loading quotes">
      {[0, 1, 2, 3].map(i => <div key={i} className="h-[76px] animate-pulse rounded-[14px] bg-white/[0.05]" />)}
    </div>
  );

  const pinId = data.pin?.id ?? null;
  const pinned = data.quotes.find(q => q.id === pinId);
  const offCount = data.quotes.filter(q => q.disabled).length;
  const shown = data.quotes.filter(q =>
    filter === "all" ? true : filter === "on" ? !q.disabled : filter === "off" ? q.disabled : q.custom);
  const active = data.quotes.find(q => q.id === activeId);
  const editing = data.quotes.find(q => q.id === editId);

  return (
    <div className="flex flex-col gap-6 pb-32">
      {/* Pinned quote — shows every night until unpinned */}
      {pinned ? (
        <section className="overflow-hidden rounded-[18px] border border-label/40 bg-label/[0.08]">
          <div className="flex items-center justify-between px-4 pt-3.5">
            <span className="font-mono text-[11px] tracking-[0.12em] text-label">PINNED · SHOWS EVERY NIGHT</span>
            <button onClick={() => setPin(null)} className="-my-2 px-2 py-2 font-mono text-[11px] tracking-[0.1em] text-label active:opacity-60">UNPIN</button>
          </div>
          <div className="flex gap-4 p-4">
            <Thumb q={pinned} thumbs={data.thumbs} size={72} />
            <div className="min-w-0">
              <p className="font-display text-[20px] uppercase leading-[0.95] tracking-[-0.02em]">{pinned.q}</p>
              <p className="mt-2 font-mono text-[11px] tracking-[0.06em] text-label">{pinned.c}</p>
            </div>
          </div>
        </section>
      ) : (
        <p className="text-[15px] leading-snug text-dim">A random quote from the ones that are on shows each night, full screen when your list is empty and in a strip otherwise. Pin one to show it every night.</p>
      )}

      <section className="flex flex-col gap-3">
        <SectionLabel right={
          <button onClick={() => setAdding(true)} className="-my-2 flex items-center gap-1 px-2 py-2 font-mono text-[11px] tracking-[0.1em] text-label active:opacity-60">
            <span className="text-[15px] leading-none">+</span> ADD QUOTE
          </button>
        }>{data.quotes.length} QUOTES{offCount ? ` · ${offCount} OFF` : ""}</SectionLabel>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filter quotes">
          {(["all", "on", "off", "custom"] as Filter[]).map(f => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
                filter === f ? "border-ink bg-ink text-navy-deep" : "border-line text-dim"}`}>
              {f}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="py-8 text-[15px] text-dim">{filter === "custom" ? "No quotes of your own yet. Tap Add quote to write one." : "Nothing here."}</p>
        ) : (
          <ul className="flex flex-col">
            {shown.map(q => (
              <li key={q.id}>
                <button onClick={() => setActive(q.id)}
                  className={`flex w-full items-center gap-3.5 border-b border-line py-3 text-left transition-opacity active:opacity-60 ${q.disabled ? "opacity-40" : ""}`}>
                  <Thumb q={q} thumbs={data.thumbs} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[16px] font-semibold leading-snug">“{q.q}”</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[11px] tracking-[0.05em] text-label">
                      {titleCase(q.c)}
                      {q.id === pinId && <span className="text-ice">· PINNED</span>}
                      {q.disabled && <span className="text-faint">· OFF</span>}
                      {q.custom && <span className="text-faint">· YOURS</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Actions for one quote */}
      <Sheet open={!!active} onClose={() => setActive(null)}>
        {active && (
          <>
            <div className="mb-5 flex gap-4">
              <Thumb q={active} thumbs={data.thumbs} size={64} />
              <div className="min-w-0">
                <p className="font-display text-[19px] uppercase leading-[0.95] tracking-[-0.02em]">{active.q}</p>
                <p className="mt-2 font-mono text-[11px] tracking-[0.06em] text-label">{active.c} · {active.s.toUpperCase()}</p>
              </div>
            </div>
            <Action icon={Icon.star(active.id === pinId)} label={active.id === pinId ? "Unpin" : "Pin — show every night"}
              disabled={active.disabled} onClick={() => { setPin(active.id === pinId ? null : active.id); setActive(null); }} />
            <Action icon={Icon.eye(!!active.disabled)} label={active.disabled ? "Turn on" : "Turn off — skip in rotation"}
              onClick={() => { setDisabled(active.id, !active.disabled); setActive(null); }} />
            <Action icon={<Icon.edit />} label="Edit" onClick={() => { setEditId(active.id); setActive(null); }} />
            {active.custom && <Action icon={<Icon.trash />} label="Delete" danger onClick={() => { remove(active.id); setActive(null); }} />}
          </>
        )}
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditId(null)} title="Edit quote">
        {editing && <QuoteForm initial={editing} submitLabel="Save" onSubmit={async (q, c, s) => { saveEdit(editing.id, q, c, s); setEditId(null); }} />}
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="New quote">
        <QuoteForm withPhoto submitLabel="Add quote" onSubmit={async (q, c, s, photo) => {
          await fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q, c, s, ...photo }) });
          await load();
          setAdding(false);
        }} />
      </Sheet>
    </div>
  );
}

// ── Add / edit form ───────────────────────────────────────────────────────────
function QuoteForm({ initial, withPhoto, submitLabel, onSubmit }: {
  initial?: Quote; withPhoto?: boolean; submitLabel: string;
  onSubmit: (q: string, c: string, s: string, photo?: { photo: string; thumb: string }) => Promise<void>;
}) {
  const [q, setQ] = useState(initial?.q ?? "");
  const [c, setC] = useState(initial ? titleCase(initial.c) : "");
  const [s, setS] = useState(initial?.s ?? "");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState<Framing>({ zoom: 1.2, x: 0, y: -0.4 });
  const [preview, setPreview] = useState<{ photo: string; thumb: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setPreview(img ? makePosterPhoto(img, frame) : null); }, [img, frame]);

  function onFile(f?: File) {
    if (!f) return;
    const el = new Image();
    el.onload = () => setImg(el);
    el.src = URL.createObjectURL(f);
  }

  const ok = q.trim() && c.trim() && !saving;
  return (
    <form className="flex flex-col gap-3" onSubmit={async e => {
      e.preventDefault();
      if (!ok) return;
      setSaving(true);
      try { await onSubmit(q, c, s, preview ?? undefined); } finally { setSaving(false); }
    }}>
      <textarea value={q} onChange={e => setQ(e.target.value)} rows={3} placeholder="The quote" aria-label="Quote" className={`${field} resize-none leading-snug`} />
      <input value={c} onChange={e => setC(e.target.value)} placeholder="Who said it" aria-label="Who said it" className={field} />
      <input value={s} onChange={e => setS(e.target.value)} placeholder="From (show, book, film) — optional" aria-label="Source" className={field} />

      {withPhoto && (
        <div className="flex flex-col gap-3 rounded-[14px] border border-line p-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
          {!preview ? (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-3 py-1 text-left text-[16px] font-semibold active:opacity-60">
              <span className="text-label"><Icon.photo /></span>
              <span>Add a photo <span className="block text-[14px] font-normal text-dim">Optional. Toned navy for the wallpaper; without one the quote gets the full screen.</span></span>
            </button>
          ) : (
            <div className="flex gap-4">
              <img src={preview.photo} alt="Photo preview" className="w-[104px] shrink-0" style={{ aspectRatio: "700 / 960" }} />
              <div className="flex min-w-0 flex-1 flex-col gap-2.5 font-mono text-[11px] tracking-[0.08em] text-label">
                {([["ZOOM", "zoom", 1, 3], ["LEFT ↔ RIGHT", "x", -1, 1], ["UP ↕ DOWN", "y", -1, 1]] as const).map(([label, key, min, max]) => (
                  <label key={key} className="flex flex-col gap-1">{label}
                    <input type="range" min={min} max={max} step={0.01} value={frame[key]} className="accent-[#8FB7D2]"
                      onChange={e => setFrame(f => ({ ...f, [key]: +e.target.value }))} />
                  </label>
                ))}
                <button type="button" onClick={() => { setImg(null); if (fileRef.current) fileRef.current.value = ""; }} className="self-start py-1 text-faint">REMOVE PHOTO</button>
              </div>
            </div>
          )}
        </div>
      )}

      <button type="submit" disabled={!ok}
        className="mt-2 rounded-full bg-label py-3.5 font-display text-[15px] uppercase tracking-[0.02em] text-navy-deep transition-transform active:scale-[0.98] disabled:opacity-30">
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
