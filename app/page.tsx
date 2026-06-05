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
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/reminders")
      .then((r) => r.json())
      .then((data) => {
        setReminders(data);
        setLoading(false);
      });
  }, []);

  const sorted = [...reminders].sort((a, b) => a.order - b.order);

  async function addReminder() {
    const text = input.trim();
    if (!text) return;
    setSaving(true);
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const created = await res.json();
    setReminders((prev) => [...prev, created]);
    setInput("");
    setSaving(false);
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

    const a = s[idx];
    const b = s[swapIdx];
    const newOrderA = b.order;
    const newOrderB = a.order;

    const [resA, resB] = await Promise.all([
      fetch(`/api/reminders/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: newOrderA }),
      }),
      fetch(`/api/reminders/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: newOrderB }),
      }),
    ]);
    const [updA, updB] = await Promise.all([resA.json(), resB.json()]);
    setReminders((prev) =>
      prev.map((x) => (x.id === updA.id ? updA : x.id === updB.id ? updB : x))
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-16">
      {/* Header */}
      <div className="w-full max-w-md mb-12">
        <p className="text-xs tracking-[0.3em] uppercase text-neutral-500 mb-1">
          Reminder Wall
        </p>
        <h1 className="text-2xl font-light tracking-tight text-white">
          My Reminders
        </h1>
      </div>

      {/* Add input */}
      <div className="w-full max-w-md mb-10">
        <div className="flex gap-3 items-center border border-neutral-800 rounded-lg px-4 py-3 focus-within:border-neutral-600 transition-colors">
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-white placeholder-neutral-600 text-sm outline-none"
            placeholder="Add a reminder..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addReminder();
            }}
          />
          <button
            onClick={addReminder}
            disabled={!input.trim() || saving}
            className="text-neutral-500 hover:text-white transition-colors disabled:opacity-30 text-lg leading-none"
            aria-label="Add"
          >
            +
          </button>
        </div>
      </div>

      {/* List */}
      <div className="w-full max-w-md">
        {loading ? (
          <p className="text-neutral-700 text-sm text-center">Loading...</p>
        ) : sorted.length === 0 ? (
          <p className="text-neutral-700 text-sm text-center">
            No reminders yet.
          </p>
        ) : (
          <ul className="space-y-px">
            {sorted.map((r, idx) => (
              <li
                key={r.id}
                className={`group flex items-start gap-4 py-4 border-b border-neutral-900 transition-opacity ${
                  r.done ? "opacity-40" : "opacity-100"
                }`}
              >
                {/* Number */}
                <span className="text-neutral-600 text-xs tabular-nums pt-0.5 w-5 shrink-0 text-right">
                  {idx + 1}
                </span>

                {/* Text */}
                <span
                  className={`flex-1 text-sm leading-relaxed ${
                    r.done ? "line-through text-neutral-500" : "text-white"
                  }`}
                >
                  {r.text}
                </span>

                {/* Controls */}
                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => move(r.id, "up")}
                    disabled={idx === 0}
                    className="text-neutral-600 hover:text-white disabled:opacity-20 transition-colors text-xs px-1"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(r.id, "down")}
                    disabled={idx === sorted.length - 1}
                    className="text-neutral-600 hover:text-white disabled:opacity-20 transition-colors text-xs px-1"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => toggleDone(r.id)}
                    className={`text-xs px-1 transition-colors ${
                      r.done
                        ? "text-neutral-500 hover:text-white"
                        : "text-neutral-600 hover:text-green-400"
                    }`}
                    title={r.done ? "Mark pending" : "Mark done"}
                  >
                    {r.done ? "↩" : "✓"}
                  </button>
                  <button
                    onClick={() => deleteReminder(r.id)}
                    className="text-neutral-700 hover:text-red-500 transition-colors text-xs px-1"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="w-full max-w-md mt-16 flex items-center justify-between">
        <p className="text-xs text-neutral-700">
          {sorted.filter((r) => !r.done).length} pending ·{" "}
          {sorted.filter((r) => r.done).length} done
        </p>
        <a
          href="/api/image"
          target="_blank"
          className="text-xs text-neutral-700 hover:text-white transition-colors tracking-wide"
        >
          preview wallpaper ↗
        </a>
      </div>
    </main>
  );
}
