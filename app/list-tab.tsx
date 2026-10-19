"use client";

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { calendar } from "@/lib/calendar";
import { Cell, Icon, SectionLabel } from "./ui";

interface Reminder {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

const REVEAL = 92; // px the delete action opens to

// ── Row: tap the box to finish, tap the text to edit, swipe left to delete ────
interface RowProps {
  r: Reminder;
  number: string;
  open: boolean;
  editing: boolean;
  editText: string;
  onOpen: (id: string | null) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEditStart: (r: Reminder) => void;
  onEditChange: (t: string) => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
  handle?: React.ReactNode;
}

function Row({ r, number, open, editing, editText, onOpen, onToggle, onDelete, onEditStart, onEditChange, onEditCommit, onEditCancel, handle }: RowProps) {
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ x: number; y: number; swiping: boolean } | null>(null);
  const swallowClick = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const base = open ? -REVEAL : 0;
  const offset = drag ?? base;

  function down(e: RPointerEvent) {
    if (editing || (e.target as HTMLElement).closest("[data-nodrag]")) return;
    start.current = { x: e.clientX, y: e.clientY, swiping: false };
  }
  function move(e: RPointerEvent) {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.swiping && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) s.swiping = true;
    if (s.swiping) setDrag(Math.max(-REVEAL - 30, Math.min(0, base + dx)));
  }
  function up() {
    const s = start.current;
    start.current = null;
    if (!s?.swiping) return;
    swallowClick.current = true;
    const shouldOpen = (drag ?? base) < -REVEAL / 2;
    setDrag(null);
    onOpen(shouldOpen ? r.id : null);
  }

  return (
    <div className="relative overflow-hidden rounded-[14px] [animation:row-in_.22s_ease-out]">
      {/* Delete action, revealed by swiping (only drawn while it can be seen) */}
      {(open || drag !== null) && (
        <button data-nodrag onClick={() => onDelete(r.id)} aria-label={`Delete ${r.text}`}
          className="absolute inset-y-0 right-0 flex items-center justify-center rounded-r-[14px] bg-danger text-white"
          style={{ width: REVEAL + 14, paddingLeft: 14 }}>
          <span className="flex flex-col items-center gap-1 font-mono text-[10px] tracking-[0.1em]"><Icon.trash />DELETE</span>
        </button>
      )}

      <div
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { start.current = null; setDrag(null); }}
        onClickCapture={e => { if (swallowClick.current) { swallowClick.current = false; e.stopPropagation(); } else if (open) { e.stopPropagation(); onOpen(null); } }}
        className={`relative flex min-h-[60px] items-center gap-3 border px-3 [touch-action:pan-y] ${drag === null ? "transition-transform duration-200 ease-out" : ""} ${
          r.done ? "border-transparent bg-[#13263a]" : "border-line bg-[#102236]"}`}
        style={{ transform: `translateX(${offset}px)`, borderRadius: 14 }}>

        <button data-nodrag onClick={() => onToggle(r.id)} aria-label={r.done ? `Mark “${r.text}” not done` : `Mark “${r.text}” done`}
          className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center">
          <span className={`flex h-[26px] w-[26px] items-center justify-center border-2 transition-colors duration-150 ${
            r.done ? "border-label bg-label text-navy-deep" : "border-ink/60"}`}>
            {r.done && <Icon.check />}
          </span>
        </button>

        <span className={`w-7 shrink-0 font-mono text-[12px] ${r.done ? "text-faint" : "text-label"}`}>{number}</span>

        <div className="min-w-0 flex-1 py-3">
          {editing ? (
            <input ref={inputRef} value={editText} enterKeyHint="done"
              onChange={e => onEditChange(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") onEditCommit(); if (e.key === "Escape") onEditCancel(); }}
              onBlur={onEditCommit}
              className="w-full border-b-2 border-label bg-transparent pb-0.5 text-[18px] font-semibold outline-none" />
          ) : (
            <button onClick={() => !r.done && onEditStart(r)}
              className={`block w-full text-left text-[18px] font-semibold leading-snug ${r.done ? "cursor-default text-faint line-through decoration-2" : ""}`}>
              {r.text}
            </button>
          )}
        </div>

        {handle}
      </div>
    </div>
  );
}

function SortableRow(props: Omit<RowProps, "handle">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.r.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, position: "relative" }}
      className={isDragging ? "scale-[1.02] opacity-90 shadow-[0_16px_40px_rgba(0,0,0,.45)]" : ""}>
      <Row {...props} handle={
        <button data-nodrag {...attributes} {...listeners} aria-label={`Reorder ${props.r.text}`}
          className="-mr-1 flex h-11 w-9 shrink-0 cursor-grab items-center justify-center text-faint [touch-action:none] active:cursor-grabbing">
          <Icon.grip />
        </button>
      } />
    </li>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────
export default function ListTab({ composerBottom, onComposerFocus }: { composerBottom: string; onComposerFocus: (f: boolean) => void }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [input, setInput]         = useState("");
  const [adding, setAdding]       = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText]   = useState("");
  const [openId, setOpenId]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMoving = useRef(false);
  const today = calendar();

  // Drag starts from the grip only; a small distance keeps taps as taps.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    fetch("/api/reminders").then(r => r.json())
      .then(data => { setReminders(data); setLoading(false); })
      .catch(() => { setReminders([]); setLoading(false); });
  }, []);

  const sorted  = [...reminders].sort((a, b) => a.order - b.order);
  const pending = sorted.filter(r => !r.done);
  const done    = sorted.filter(r => r.done);

  async function addReminder() {
    const text = input.trim();
    if (!text || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setReminders(prev => [...prev, created]);
      setInput("");
      inputRef.current?.focus();
    } catch {
      // keep the text so it can be retried
    } finally {
      setAdding(false);
    }
  }

  async function toggleDone(id: string) {
    const original = reminders.find(x => x.id === id)!;
    setOpenId(null);
    setReminders(prev => prev.map(x => (x.id === id ? { ...x, done: !x.done } : x)));
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !original.done }) });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setReminders(prev => prev.map(x => (x.id === id ? updated : x)));
    } catch {
      setReminders(prev => prev.map(x => (x.id === id ? original : x)));
    }
  }

  // Deletes are optimistic and batched (one read-filter-write on the server).
  const pendingDeleteIds = useRef<Set<string>>(new Set());
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function flushDeletes() {
    const ids = [...pendingDeleteIds.current];
    pendingDeleteIds.current.clear();
    deleteTimer.current = null;
    if (!ids.length) return;
    try {
      const res = await fetch("/api/reminders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!res.ok) throw new Error();
    } catch {
      fetch("/api/reminders").then(r => r.json()).then(setReminders).catch(() => {});
    }
  }
  function deleteReminders(ids: string[]) {
    setOpenId(null);
    setReminders(prev => prev.filter(x => !ids.includes(x.id)));
    ids.forEach(id => pendingDeleteIds.current.add(id));
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    deleteTimer.current = setTimeout(flushDeletes, 50);
  }

  function startEdit(r: Reminder) { setOpenId(null); setEditingId(r.id); setEditText(r.text); }
  function cancelEdit() { setEditingId(null); setEditText(""); }
  async function commitEdit() {
    if (!editingId) return;
    const id = editingId, text = editText.trim();
    setEditingId(null);
    const original = reminders.find(x => x.id === id);
    if (!text || !original || text === original.text) return;
    setReminders(prev => prev.map(x => (x.id === id ? { ...x, text } : x)));
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setReminders(prev => prev.map(x => (x.id === id ? updated : x)));
    } catch {
      setReminders(prev => prev.map(x => (x.id === id ? original : x)));
    }
  }

  // Reorder pending items; done items keep their place after them.
  async function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id || isMoving.current) return;
    isMoving.current = true;
    const moved = arrayMove(pending, pending.findIndex(r => r.id === active.id), pending.findIndex(r => r.id === over.id));
    const orderedIds = [...moved, ...done].map(r => r.id);
    const before = reminders;
    setReminders(prev => prev.map(r => ({ ...r, order: orderedIds.indexOf(r.id) })));
    try {
      const res = await fetch("/api/reminders", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderedIds }) });
      if (!res.ok) throw new Error();
      setReminders(await res.json());
    } catch {
      setReminders(before);
    } finally {
      isMoving.current = false;
    }
  }

  const rowProps = (r: Reminder, number: string) => ({
    r, number, open: openId === r.id, editing: editingId === r.id, editText,
    onOpen: setOpenId, onToggle: toggleDone, onDelete: (id: string) => deleteReminders([id]),
    onEditStart: startEdit, onEditChange: setEditText, onEditCommit: commitEdit, onEditCancel: cancelEdit,
  });

  return (
    <div className="flex flex-col gap-7 pb-44">
      <div className="grid grid-cols-[1.25fr_1fr_1fr] gap-4">
        <Cell label="TODAY" value={today.weekday} />
        <Cell label="DAY" value={`${today.dayOfYear} / ${today.daysInYear}`} />
        <Cell label="LEFT" value={loading ? "–" : `${pending.length} of ${sorted.length}`} />
      </div>

      {loading ? (
        <div className="flex flex-col gap-2" aria-label="Loading reminders">
          {[0, 1, 2].map(i => <div key={i} className="h-[60px] animate-pulse rounded-[14px] bg-white/[0.05]" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="pt-6">
          <p className="font-display text-[44px] uppercase leading-[0.9] tracking-[-0.03em]">Nothing on<br />the wall.</p>
          <p className="mt-4 max-w-[30ch] text-[17px] leading-snug text-dim">Tonight&apos;s wallpaper will show a quote instead. Add a reminder below to put it on your lock screen.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionLabel>ON THE WALL · {pending.length}</SectionLabel>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} onDragStart={() => setOpenId(null)}>
                <SortableContext items={pending.map(r => r.id)} strategy={verticalListSortingStrategy}>
                  <ul className="flex flex-col gap-2">
                    {pending.map((r, i) => <SortableRow key={r.id} {...rowProps(r, String(i + 1).padStart(2, "0"))} />)}
                  </ul>
                </SortableContext>
              </DndContext>
              {pending.length > 6 && (
                <p className="font-mono text-[11px] tracking-[0.06em] text-faint">The wallpaper shows the first six; the rest appear as “+ {pending.length - 6} more”.</p>
              )}
            </section>
          )}

          {done.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionLabel right={
                <button onClick={() => deleteReminders(done.map(r => r.id))} className="-my-2 px-2 py-2 font-mono text-[11px] tracking-[0.1em] text-label active:opacity-60">CLEAR</button>
              }>DONE · {done.length}</SectionLabel>
              <ul className="flex flex-col gap-2">
                {done.map(r => <li key={r.id}><Row {...rowProps(r, "DONE")} /></li>)}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Composer — sits on the tab bar, and rides above the keyboard while typing */}
      <form onSubmit={e => { e.preventDefault(); addReminder(); }}
        className="fixed inset-x-0 z-30 mx-auto w-full max-w-xl px-4 transition-[bottom] duration-150"
        style={{ bottom: composerBottom }}>
        <div className="flex items-center gap-2 rounded-full border border-line bg-navy-deep/85 p-1.5 pl-5 shadow-[0_12px_40px_rgba(0,0,0,.45)] backdrop-blur-xl focus-within:border-label/60">
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onFocus={() => onComposerFocus(true)} onBlur={() => onComposerFocus(false)}
            placeholder="Add to the wall…" enterKeyHint="send" aria-label="New reminder"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[17px] font-medium placeholder:text-faint outline-none" />
          <button type="submit" disabled={!input.trim() || adding} aria-label="Add reminder"
            onPointerDown={e => e.preventDefault()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-label text-navy-deep transition-transform active:scale-90 disabled:opacity-30">
            <Icon.plus />
          </button>
        </div>
      </form>
    </div>
  );
}
