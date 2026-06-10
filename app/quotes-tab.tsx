"use client";

import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/lib/quotes";
import { slugify } from "@/lib/quotes";

interface QuotesData {
  quotes: Quote[];
  pin: { id: string } | null;
  portraits: Record<string, string>;
}

// ── Client-side dot-portrait generator ─────────────────────────────────────────
// Same algorithm as scripts/generate_portraits.py: 68-col luminance grid,
// white dots sized by brightness, circular mask with radial fade.
function makePortrait(
  img: HTMLImageElement,
  opts: { contrast: number; zoom: number; offsetY: number },
): string {
  const COLS = 68, OUT = 760, GAMMA = 0.85, FADE = 0.72, MIN_V = 0.06;
  const sample = document.createElement("canvas");
  sample.width = COLS; sample.height = COLS;
  const sx = sample.getContext("2d")!;
  sx.fillStyle = "#000"; sx.fillRect(0, 0, COLS, COLS);
  const side = Math.min(img.width, img.height) / opts.zoom;
  const cx = img.width / 2;
  const cy = img.height * (0.40 + opts.offsetY);
  sx.drawImage(
    img,
    Math.max(0, Math.min(img.width  - side, cx - side / 2)),
    Math.max(0, Math.min(img.height - side, cy - side / 2)),
    side, side, 0, 0, COLS, COLS,
  );
  const d = sx.getImageData(0, 0, COLS, COLS).data;
  const out = document.createElement("canvas");
  out.width = OUT; out.height = OUT;
  const ox = out.getContext("2d")!;
  const cell = OUT / COLS, R = OUT / 2;
  for (let y = 0; y < COLS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = (y * COLS + x) * 4;
      let v = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      v = Math.min(1, Math.max(0, (v - 0.5) * opts.contrast + 0.5));
      v = Math.pow(v, GAMMA);
      const px = x * cell + cell / 2, py = y * cell + cell / 2;
      const dist = Math.hypot(px - R, py - R) / R;
      if (dist > 1) continue;
      if (dist > FADE) v *= Math.pow(Math.max(0, 1 - (dist - FADE) / (1 - FADE)), 1.4);
      if (v < MIN_V) continue;
      const r = v * cell * 0.6;
      if (r < 0.5) continue;
      ox.fillStyle = `rgba(255,255,255,${(0.24 + 0.76 * v).toFixed(3)})`;
      ox.beginPath(); ox.arc(px, py, r, 0, 7); ox.fill();
    }
  }
  return out.toDataURL("image/png");
}

function Thumb({ slug, portraits }: { slug: string; portraits: Record<string, string> }) {
  const [err, setErr] = useState(false);
  const src = portraits[slug] ?? `/portraits/${slug}.png`;
  if (err) return (
    <div className="w-12 h-12 rounded-full bg-[#111] flex items-center justify-center text-[#333] text-xs shrink-0">?</div>
  );
  return (
    <img src={src} onError={() => setErr(true)} alt=""
      className="w-12 h-12 rounded-full bg-black object-cover shrink-0" />
  );
}

export default function QuotesTab() {
  const [data, setData]       = useState<QuotesData | null>(null);
  const [busy, setBusy]       = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // add form
  const [fq, setFq] = useState(""); const [fc, setFc] = useState(""); const [fs, setFs] = useState("");
  const [imgEl, setImgEl]       = useState<HTMLImageElement | null>(null);
  const [contrast, setContrast] = useState(1.6);
  const [zoom, setZoom]         = useState(1.4);
  const [offsetY, setOffsetY]   = useState(0);
  const [preview, setPreview]   = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => fetch("/api/quotes").then(r => r.json()).then(setData).catch(() => setData(null));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!imgEl) { setPreview(null); return; }
    setPreview(makePortrait(imgEl, { contrast, zoom, offsetY }));
  }, [imgEl, contrast, zoom, offsetY]);

  function onFile(f: File | undefined) {
    if (!f) return;
    const img = new Image();
    img.onload = () => setImgEl(img);
    img.src = URL.createObjectURL(f);
  }

  async function patch(body: object) {
    await fetch("/api/quotes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await load();
    setBusy(null);
  }

  async function remove(id: string) {
    setBusy(id);
    await fetch("/api/quotes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await load();
    setBusy(null);
  }

  async function addQuote() {
    if (!fq.trim() || !fc.trim()) return;
    setSaving(true);
    await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: fq, c: fc, s: fs, portrait: preview ?? undefined }),
    });
    setFq(""); setFc(""); setFs(""); setImgEl(null); setPreview(null); setShowAdd(false);
    if (fileRef.current) fileRef.current.value = "";
    await load();
    setSaving(false);
  }

  if (!data) return <p className="text-[#333] text-sm text-center py-16">Loading…</p>;
  const pinId = data.pin?.id ?? null;

  return (
    <div>
      {/* Add quote */}
      <div className="mb-8">
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)}
            className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-4 text-left text-[#282828] text-base hover:border-[#FF693C]/40 transition-colors">
            Add your own quote…
          </button>
        ) : (
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 space-y-3">
            <textarea value={fq} onChange={e => setFq(e.target.value)} rows={2}
              placeholder="Quote text…"
              className="w-full bg-transparent text-white placeholder-[#282828] text-base outline-none resize-none" />
            <div className="flex gap-3">
              <input value={fc} onChange={e => setFc(e.target.value)} placeholder="Character / person"
                className="flex-1 bg-transparent text-white placeholder-[#282828] text-sm outline-none border-b border-[#1a1a1a] pb-1" />
              <input value={fs} onChange={e => setFs(e.target.value)} placeholder="Show / source (optional)"
                className="flex-1 bg-transparent text-white placeholder-[#282828] text-sm outline-none border-b border-[#1a1a1a] pb-1" />
            </div>

            {/* Portrait upload + live dot preview */}
            <div className="flex gap-4 items-start pt-1">
              <div className="flex-1 space-y-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={e => onFile(e.target.files?.[0])}
                  className="text-xs text-[#555] file:bg-[#1a1a1a] file:text-[#999] file:border-0 file:rounded file:px-3 file:py-1.5 file:mr-3" />
                {imgEl && (
                  <div className="space-y-1.5 text-[10px] text-[#555]">
                    <label className="flex items-center gap-2">ZOOM
                      <input type="range" min={1} max={3} step={0.05} value={zoom}
                        onChange={e => setZoom(+e.target.value)} className="flex-1 accent-[#FF693C]" /></label>
                    <label className="flex items-center gap-2">FACE ↑↓
                      <input type="range" min={-0.25} max={0.25} step={0.01} value={offsetY}
                        onChange={e => setOffsetY(+e.target.value)} className="flex-1 accent-[#FF693C]" /></label>
                    <label className="flex items-center gap-2">CONTRAST
                      <input type="range" min={0.8} max={2.6} step={0.05} value={contrast}
                        onChange={e => setContrast(+e.target.value)} className="flex-1 accent-[#FF693C]" /></label>
                  </div>
                )}
              </div>
              {preview && (
                <img src={preview} alt="portrait preview" className="w-28 h-28 rounded-full bg-black shrink-0" />
              )}
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowAdd(false)}
                className="text-xs text-[#555] px-3 py-2">Cancel</button>
              <button onClick={addQuote} disabled={!fq.trim() || !fc.trim() || saving}
                className="bg-[#FF693C] text-black text-xs font-bold tracking-wider px-4 py-2 rounded-lg disabled:opacity-20 active:scale-95 transition-all">
                {saving ? "SAVING…" : "ADD QUOTE"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <ul className="space-y-1">
        {data.quotes.map(qt => {
          const slug = slugify(qt.c);
          const pinned = pinId === qt.id;
          return (
            <li key={qt.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 border transition-colors ${
                pinned ? "border-[#FF693C]/40 bg-[#FF693C]/5"
                       : "border-transparent hover:border-[#1a1a1a]"
              } ${qt.disabled ? "opacity-35" : ""}`}>
              <Thumb slug={slug} portraits={data.portraits} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">&ldquo;{qt.q}&rdquo;</p>
                <p className="text-[11px] text-[#666] tracking-wider mt-0.5">
                  {qt.c} <span className="text-[#333]">· {qt.s.toUpperCase()}</span>
                  {qt.custom && <span className="text-[#FF693C]/60 ml-2">CUSTOM</span>}
                </p>
              </div>
              <button title={pinned ? "Unpin" : "Pin — always show this quote"}
                onClick={() => { setBusy(qt.id); patch({ pin: pinned ? null : qt.id }); }}
                disabled={busy === qt.id || qt.disabled}
                className={`text-xs px-2 py-1 rounded ${pinned ? "text-[#FF693C]" : "text-[#444] hover:text-[#999]"}`}>
                {pinned ? "★" : "☆"}
              </button>
              <button title={qt.disabled ? "Enable" : "Disable"}
                onClick={() => { setBusy(qt.id); patch({ id: qt.id, disabled: !qt.disabled }); }}
                disabled={busy === qt.id}
                className="text-xs text-[#444] hover:text-[#999] px-2 py-1 rounded">
                {qt.disabled ? "OFF" : "ON"}
              </button>
              {qt.custom && (
                <button title="Delete" onClick={() => remove(qt.id)} disabled={busy === qt.id}
                  className="text-xs text-[#444] hover:text-red-400 px-2 py-1 rounded">✕</button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] text-[#333] mt-6 text-center">
        ★ pinned quote always shows on the wallpaper · OFF removes a quote from rotation
      </p>
    </div>
  );
}
