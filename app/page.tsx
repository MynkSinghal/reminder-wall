"use client";

import { useState, useEffect, useRef } from "react";

interface Reminder {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

export default function Home() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/reminders")
      .then((r) => r.json())
      .then((data) => { setReminders(data); setLoading(false); });
  }, []);

  const sorted = [...reminders].sort((a, b) => a.order - b.order);
  const pending = sorted.filter((r) => !r.done);
  const done = sorted.filter((r) => r.done);

  async function addReminder() {
    const text = input.trim();
    if (!text || adding) return;
    setAdding(true);
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const created = await res.json();
    setReminders((prev) => [...prev, created]);
    setInput("");
    setAdding(false);
    inputRef.current?.focus();
  }

  async function toggleDone(id: string) {
    const r = reminders.find((x) => x.id === id)!;
    const res = await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !r.done }),
    });
    const updated = await res.json();
    setReminders((prev) => prev.map((x) => (x.id === id ? updated : x)));
  }

  async function deleteReminder(id: string) {
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    setReminders((prev) => prev.filter((x) => x.id !== id));
  }

  async function move(id: string, direction: "up" | "down") {
    const s = sorted;
    const idx = s.findIndex((x) => x.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= s.length) return;
    const a = s[idx], b = s[swapIdx];
    const [resA, resB] = await Promise.all([
      fetch(`/api/reminders/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: b.order }) }),
      fetch(`/api/reminders/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: a.order }) }),
    ]);
    const [updA, updB] = await Promise.all([resA.json(), resB.json()]);
    setReminders((prev) => prev.map((x) => x.id === updA.id ? updA : x.id === updB.id ? updB : x));
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* ── Top bar ── */}
      <div className="border-b border-[#111] px-5 py-4 flex items-center justify-between">
        <span className="text-[#FF693C] text-xs font-bold tracking-[0.3em] uppercase">Reminder Wall</span>
        <div className="flex items-center gap-3">
          <span className="text-[#252525] text-xs tabular-nums">
            {pending.length} pending · {done.length} done
          </span>
          <a
            href="/api/image"
            target="_blank"
            className="text-xs text-[#FF693C] border border-[#FF693C]/30 rounded px-3 py-1.5 hover:bg-[#FF693C]/10 transition-colors"
          >
            Wallpaper ↗
          </a>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 py-8">

        {/* ── Add input ── */}
        <div className="mb-8">
          <div className="flex gap-3 items-center bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-4 focus-within:border-[#FF693C]/40 transition-colors">
            <input
              ref={inputRef}
              className="flex-1 bg-transparent text-white placeholder-[#282828] text-base outline-none"
              placeholder="Add a reminder..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addReminder()}
            />
            <button
              onClick={addReminder}
              disabled={!input.trim() || adding}
              className="bg-[#FF693C] text-black text-xs font-bold tracking-wider px-4 py-2 rounded-lg disabled:opacity-20 active:scale-95 transition-all"
            >
              ADD
            </button>
          </div>
        </div>

        {/* ── List ── */}
        {loading ? (
          <p className="text-[#1c1c1c] text-sm text-center py-16">Loading...</p>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#1a1a1a] text-sm">No reminders yet.</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {sorted.map((r, idx) => (
              <li
                key={r.id}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl border transition-all ${
                  r.done
                    ? "border-[#0d0d0d] bg-[#040404]"
                    : "border-[#111] bg-[#050505]"
                }`}
              >
                {/* Number */}
                <span className="text-[#FF693C] text-xs font-bold tabular-nums w-6 text-right shrink-0 select-none">
                  {String(idx + 1).padStart(2, "0")}
                </span>

                {/* Done toggle — always visible, big tap target */}
                <button
                  onClick={() => toggleDone(r.id)}
                  className="w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-all active:scale-90"
                  style={{
                    borderColor: r.done ? "#FF693C" : "#2a2a2a",
                    background: r.done ? "#FF693C" : "transparent",
                  }}
                >
                  {r.done && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="black" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>

                {/* Text */}
                <span className={`flex-1 text-sm leading-relaxed min-w-0 ${r.done ? "line-through text-[#333]" : "text-white"}`}>
                  {r.text}
                </span>

                {/* ── Action buttons — always visible ── */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => move(r.id, "up")}
                    disabled={idx === 0}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f0f0f] text-[#444] active:bg-[#1a1a1a] active:text-white disabled:opacity-10 transition-all"
                    title="Move up"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 9V3M3 6L6 3L9 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => move(r.id, "down")}
                    disabled={idx === sorted.length - 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f0f0f] text-[#444] active:bg-[#1a1a1a] active:text-white disabled:opacity-10 transition-all"
                    title="Move down"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 3V9M3 6L6 9L9 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteReminder(r.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f0f0f] text-[#444] active:bg-red-950 active:text-red-400 transition-all"
                    title="Delete"
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* ── Wallpaper URL tip ── */}
        {sorted.length > 0 && (
          <div className="mt-10 border border-[#0f0f0f] rounded-xl p-4 bg-[#030303]">
            <p className="text-[#1e1e1e] text-xs mb-2">iOS Shortcut URL</p>
            <p className="text-[#FF693C]/50 text-xs font-mono break-all">
              {typeof window !== "undefined" ? window.location.origin : "https://reminder-wall.vercel.app"}/api/image
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
