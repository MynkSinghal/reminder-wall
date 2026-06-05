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
      <div className="border-b border-[#111] px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[#FF693C] text-xs font-bold tracking-[0.3em] uppercase">Reminder Wall</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#2a2a2a] text-xs tabular-nums">
            {pending.length} pending · {done.length} done
          </span>
          <a
            href="/api/image"
            target="_blank"
            className="text-xs text-[#FF693C] border border-[#FF693C]/30 rounded px-3 py-1.5 hover:bg-[#FF693C]/10 transition-colors"
          >
            Preview wallpaper ↗
          </a>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-10">

        {/* ── Add input ── */}
        <div className="mb-10">
          <div className="flex gap-3 items-center bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-5 py-4 focus-within:border-[#FF693C]/40 transition-colors">
            <span className="text-[#FF693C] text-lg font-bold select-none">+</span>
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
              className="text-xs font-bold tracking-wider text-[#FF693C] disabled:opacity-20 hover:opacity-70 transition-opacity uppercase"
            >
              Add
            </button>
          </div>
        </div>

        {/* ── List ── */}
        {loading ? (
          <p className="text-[#1c1c1c] text-sm text-center py-16">Loading...</p>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#1a1a1a] text-sm">No reminders yet.</p>
            <p className="text-[#141414] text-xs mt-1">Add one above to get started.</p>
          </div>
        ) : (
          <ul>
            {sorted.map((r, idx) => (
              <li
                key={r.id}
                className={`group flex items-center gap-4 py-4 border-b border-[#0f0f0f] transition-all ${r.done ? "opacity-30" : ""}`}
              >
                {/* Number */}
                <span className="text-[#FF693C] text-xs font-bold tabular-nums w-7 text-right shrink-0 select-none">
                  {String(idx + 1).padStart(2, "0")}
                </span>

                {/* Done toggle */}
                <button
                  onClick={() => toggleDone(r.id)}
                  className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all"
                  style={{
                    borderColor: r.done ? "#FF693C" : "#1e1e1e",
                    background: r.done ? "#FF693C" : "transparent",
                  }}
                  title={r.done ? "Mark pending" : "Mark done"}
                >
                  {r.done && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="black" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>

                {/* Text */}
                <span className={`flex-1 text-base leading-relaxed ${r.done ? "line-through text-[#2a2a2a]" : "text-white"}`}>
                  {r.text}
                </span>

                {/* Controls — appear on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => move(r.id, "up")}
                    disabled={idx === 0}
                    className="w-7 h-7 flex items-center justify-center text-[#333] hover:text-white disabled:opacity-10 transition-colors rounded hover:bg-[#111]"
                    title="Move up"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 9V3M3 6L6 3L9 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => move(r.id, "down")}
                    disabled={idx === sorted.length - 1}
                    className="w-7 h-7 flex items-center justify-center text-[#333] hover:text-white disabled:opacity-10 transition-colors rounded hover:bg-[#111]"
                    title="Move down"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 3V9M3 6L6 9L9 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteReminder(r.id)}
                    className="w-7 h-7 flex items-center justify-center text-[#222] hover:text-red-500 transition-colors rounded hover:bg-[#111]"
                    title="Delete"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* ── Wallpaper tip ── */}
        {sorted.length > 0 && (
          <div className="mt-12 border border-[#0f0f0f] rounded-xl p-5 bg-[#030303]">
            <p className="text-[#222] text-xs leading-relaxed">
              Wallpaper URL for your iOS Shortcut
            </p>
            <p className="text-[#FF693C]/60 text-xs font-mono mt-2 break-all">
              {typeof window !== "undefined" ? window.location.origin : "https://reminder-wall.vercel.app"}/api/image
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
