"use client";

import { useState, useEffect, useRef } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import QuotesTab from "./quotes-tab";

interface Reminder {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

// ── Drag handle icon ──────────────────────────────────────────────────────────
function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="4.5" cy="3"  r="1.2" fill="currentColor"/>
      <circle cx="9.5" cy="3"  r="1.2" fill="currentColor"/>
      <circle cx="4.5" cy="7"  r="1.2" fill="currentColor"/>
      <circle cx="9.5" cy="7"  r="1.2" fill="currentColor"/>
      <circle cx="4.5" cy="11" r="1.2" fill="currentColor"/>
      <circle cx="9.5" cy="11" r="1.2" fill="currentColor"/>
    </svg>
  );
}

// ── Sortable reminder row ─────────────────────────────────────────────────────
interface RowProps {
  reminder: Reminder;
  idx: number;
  editingId: string | null;
  editText: string;
  onEditStart: (id: string, text: string) => void;
  onEditChange: (text: string) => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function SortableRow({
  reminder: r,
  idx,
  editingId,
  editText,
  onEditStart,
  onEditChange,
  onEditCommit,
  onEditCancel,
  onToggle,
  onDelete,
}: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: r.id });

  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId === r.id) editInputRef.current?.focus();
  }, [editingId, r.id]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl border transition-all ${
        r.done ? "border-[#0d0d0d] bg-[#040404]" : "border-[#111] bg-[#050505]"
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-[#2a2a2a] hover:text-[#444] cursor-grab active:cursor-grabbing shrink-0 touch-none"
        title="Drag to reorder"
        tabIndex={-1}
      >
        <GripIcon />
      </button>

      {/* Number */}
      <span className="text-[#FF693C] text-xs font-bold tabular-nums w-6 text-right shrink-0 select-none">
        {String(idx + 1).padStart(2, "0")}
      </span>

      {/* Done toggle */}
      <button
        onClick={() => onToggle(r.id)}
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

      {/* Text / Inline edit */}
      <div className="flex-1 min-w-0">
        {editingId === r.id ? (
          <input
            ref={editInputRef}
            value={editText}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onEditCommit();
              if (e.key === "Escape") onEditCancel();
            }}
            onBlur={onEditCommit}
            className="w-full bg-transparent text-white text-sm outline-none border-b border-[#FF693C]/40 pb-0.5"
          />
        ) : (
          <span
            onClick={() => !r.done && onEditStart(r.id, r.text)}
            title={r.done ? undefined : "Click to edit"}
            className={`block text-sm leading-relaxed truncate transition-colors ${
              r.done
                ? "line-through text-[#333] cursor-default"
                : "text-white cursor-text hover:text-[#eee]"
            }`}
          >
            {r.text}
          </span>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(r.id)}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f0f0f] text-[#444] active:bg-red-950 active:text-red-400 transition-all shrink-0"
        title="Delete"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </li>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText,  setEditText]  = useState("");
  const [tab, setTab]             = useState<"reminders" | "quotes">("reminders");
  const inputRef  = useRef<HTMLInputElement>(null);
  const isMoving  = useRef(false);

  // DnD sensors — small distance so taps still work for edit/toggle
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/reminders")
      .then((r) => r.json())
      .then((data) => { setReminders(data); setLoading(false); })
      .catch(() => { setReminders([]); setLoading(false); });
  }, []);

  const sorted  = [...reminders].sort((a, b) => a.order - b.order);
  const pending = sorted.filter((r) => !r.done);
  const done    = sorted.filter((r) => r.done);

  // ── Add ─────────────────────────────────────────────────────────────────────
  async function addReminder() {
    const text = input.trim();
    if (!text || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Failed to add");
      const created = await res.json();
      setReminders((prev) => [...prev, created]);
      setInput("");
      inputRef.current?.focus();
    } catch {
      // leave input intact so user can retry
    } finally {
      setAdding(false);
    }
  }

  // ── Toggle done (optimistic) ─────────────────────────────────────────────────
  async function toggleDone(id: string) {
    const original = reminders.find((x) => x.id === id)!;
    // Optimistic update
    setReminders((prev) =>
      prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x))
    );
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !original.done }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setReminders((prev) => prev.map((x) => (x.id === id ? updated : x)));
    } catch {
      // revert
      setReminders((prev) => prev.map((x) => (x.id === id ? original : x)));
    }
  }

  // ── Delete (optimistic + batched to prevent concurrent-write race) ───────────
  // Each click immediately removes the item from UI state, then queues the ID.
  // After a 50ms debounce, all queued IDs are sent in a single atomic batch
  // DELETE to /api/reminders — one read-filter-write instead of N concurrent ones.
  const pendingDeleteIds = useRef<Set<string>>(new Set());
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function flushDeletes() {
    const ids = [...pendingDeleteIds.current];
    pendingDeleteIds.current.clear();
    deleteTimer.current = null;
    if (ids.length === 0) return;
    try {
      const res = await fetch("/api/reminders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // On failure, reload from server to restore true state
      fetch("/api/reminders")
        .then((r) => r.json())
        .then((data) => setReminders(data))
        .catch(() => {});
    }
  }

  function deleteReminder(id: string) {
    // Optimistic: remove from UI immediately
    setReminders((prev) => prev.filter((x) => x.id !== id));
    // Queue the ID and (re)start the debounce timer
    pendingDeleteIds.current.add(id);
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    deleteTimer.current = setTimeout(flushDeletes, 50);
  }

  // ── Inline edit ──────────────────────────────────────────────────────────────
  function startEdit(id: string, text: string) {
    setEditingId(id);
    setEditText(text);
  }

  async function commitEdit() {
    if (!editingId) return;
    const id   = editingId;
    const text = editText.trim();
    setEditingId(null);
    if (!text) return; // empty → cancel, don't save

    const original = reminders.find((x) => x.id === id)!;
    if (text === original.text) return; // unchanged

    // Optimistic
    setReminders((prev) =>
      prev.map((x) => (x.id === id ? { ...x, text } : x))
    );
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setReminders((prev) => prev.map((x) => (x.id === id ? updated : x)));
    } catch {
      setReminders((prev) => prev.map((x) => (x.id === id ? original : x)));
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  // ── Drag-to-reorder ──────────────────────────────────────────────────────────
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || isMoving.current) return;

    isMoving.current = true;

    const oldIndex = sorted.findIndex((r) => r.id === active.id);
    const newIndex = sorted.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    const orderedIds = reordered.map((r) => r.id);

    // Optimistic update — assign sequential order values locally
    const updated = reordered.map((r, i) => ({ ...r, order: i }));
    setReminders((prev) => {
      const map = new Map(updated.map((r) => [r.id, r]));
      return prev.map((r) => map.get(r.id) ?? r);
    });

    // Single atomic PUT — avoids concurrent-PATCH race conditions
    try {
      const res = await fetch("/api/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      if (!res.ok) throw new Error();
      const serverData = await res.json();
      // Reconcile with server-assigned order values
      setReminders(serverData);
    } catch {
      setReminders([...reminders]); // revert
    } finally {
      isMoving.current = false;
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <div className="border-b border-[#111] px-5 py-4 flex items-center justify-between">
        <span className="text-[#FF693C] text-xs font-bold tracking-[0.3em] uppercase">
          Reminder Wall
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[#333] text-xs tabular-nums">
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

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-1">
          {(["reminders", "quotes"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 text-xs font-bold tracking-[0.2em] uppercase rounded-lg py-2.5 transition-colors ${
                tab === t ? "bg-[#1a1a1a] text-[#FF693C]" : "text-[#444] hover:text-[#777]"
              }`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "quotes" && <QuotesTab />}

        {tab === "reminders" && <>
        {/* Add input */}
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

        {/* List */}
        {loading ? (
          <p className="text-[#333] text-sm text-center py-16">Loading…</p>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#2a2a2a] text-sm">No reminders yet.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sorted.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-1">
                {sorted.map((r, idx) => (
                  <SortableRow
                    key={r.id}
                    reminder={r}
                    idx={idx}
                    editingId={editingId}
                    editText={editText}
                    onEditStart={startEdit}
                    onEditChange={setEditText}
                    onEditCommit={commitEdit}
                    onEditCancel={cancelEdit}
                    onToggle={toggleDone}
                    onDelete={deleteReminder}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {/* Wallpaper URL tip */}
        {sorted.length > 0 && (
          <div className="mt-10 border border-[#0f0f0f] rounded-xl p-4 bg-[#030303]">
            <p className="text-[#222] text-xs mb-2">iOS Shortcut URL</p>
            <p className="text-[#FF693C]/50 text-xs font-mono break-all">
              {typeof window !== "undefined"
                ? window.location.origin
                : "https://reminder-wall.vercel.app"}
              /api/image
            </p>
          </div>
        )}
        </>}
      </div>
    </main>
  );
}
