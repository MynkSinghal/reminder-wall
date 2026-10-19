"use client";

// Shared dashboard primitives, in the Poster's language: heavy rules, mono labels.
import { useEffect, useState, type ReactNode } from "react";

// ── Icons (24-unit, square caps) ──────────────────────────────────────────────
const S = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "square" as const, strokeLinejoin: "miter" as const };
export const Icon = {
  list:    () => <svg width="24" height="24" viewBox="0 0 24 24" {...S}><path d="M4 6h16M4 12h16M4 18h7" /></svg>,
  quote:   () => <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M4 18v-5.2C4 8.6 6 6.2 9.6 5.6l.6 2C8.4 8.2 7.6 9.4 7.5 11H10v7H4Zm9 0v-5.2c0-4.2 2-6.6 5.6-7.2l.6 2c-1.8.6-2.6 1.8-2.7 3.4H19v7h-6Z" /></svg>,
  wall:    () => <svg width="24" height="24" viewBox="0 0 24 24" {...S}><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M10 6h4M9 11h6M9 15h4" /></svg>,
  plus:    () => <svg width="22" height="22" viewBox="0 0 24 24" {...S} strokeWidth={2.8}><path d="M12 5v14M5 12h14" /></svg>,
  check:   () => <svg width="14" height="14" viewBox="0 0 24 24" {...S} strokeWidth={3.4}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  grip:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5" width="3" height="3" /><rect x="14" y="5" width="3" height="3" /><rect x="7" y="10.5" width="3" height="3" /><rect x="14" y="10.5" width="3" height="3" /><rect x="7" y="16" width="3" height="3" /><rect x="14" y="16" width="3" height="3" /></svg>,
  trash:   () => <svg width="20" height="20" viewBox="0 0 24 24" {...S}><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" /></svg>,
  star:    (on: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" /></svg>,
  edit:    () => <svg width="20" height="20" viewBox="0 0 24 24" {...S}><path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" /></svg>,
  eye:     (on: boolean) => on
    ? <svg width="20" height="20" viewBox="0 0 24 24" {...S}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>
    : <svg width="20" height="20" viewBox="0 0 24 24" {...S}><path d="M3 3l18 18M10.6 6.1A9 9 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.6M6.4 7.5A16 16 0 0 0 2.5 12S6 18 12 18a9 9 0 0 0 4.1-1" /></svg>,
  copy:    () => <svg width="18" height="18" viewBox="0 0 24 24" {...S}><rect x="8" y="8" width="12" height="12" /><path d="M16 8V4H4v12h4" /></svg>,
  refresh: () => <svg width="18" height="18" viewBox="0 0 24 24" {...S}><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>,
  photo:   () => <svg width="20" height="20" viewBox="0 0 24 24" {...S}><rect x="3" y="5" width="18" height="14" /><path d="M3 16l5-5 4 4 3-3 6 6" /><circle cx="16" cy="9" r="1.5" /></svg>,
};

// ── Label cell, as on the wallpaper ────────────────────────────────────────────
export function Cell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 border-t-[3px] border-ink pt-2.5">
      <div className="font-mono text-[11px] tracking-[0.08em] text-label">{label}</div>
      <div className="mt-1 truncate text-[19px] font-semibold leading-tight">{value}</div>
    </div>
  );
}

// ── Section heading: mono label with a rule ───────────────────────────────────
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
      <span className="font-mono text-[11px] tracking-[0.12em] text-label">{children}</span>
      {right}
    </div>
  );
}

// ── iOS-style switch ──────────────────────────────────────────────────────────
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-label" : "bg-white/15"}`}>
      <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.35)] transition-[left] duration-200 ${on ? "left-[22px]" : "left-[2px]"}`} />
    </button>
  );
}

// ── Bottom sheet ──────────────────────────────────────────────────────────────
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-[2px] [animation:fade-in_.18s_ease-out]" />
      <div className="relative max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-[26px] border-t border-line bg-navy-deep px-5 pt-3 [animation:sheet-up_.26s_cubic-bezier(.2,.8,.2,1)]"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 20px)" }}>
        <div className="mx-auto mb-4 h-[5px] w-10 rounded-full bg-white/20" />
        {title && <h2 className="mb-4 font-display text-[22px] uppercase leading-none tracking-[-0.01em]">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

// ── Action list inside a sheet ────────────────────────────────────────────────
export function Action({ icon, label, onClick, danger, disabled }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex w-full items-center gap-4 border-t border-line py-4 text-left text-[17px] font-semibold transition-opacity active:opacity-60 disabled:opacity-30 ${danger ? "text-danger" : ""}`}>
      <span className={danger ? "text-danger" : "text-label"}>{icon}</span>{label}
    </button>
  );
}

// ── Keyboard height (iOS keeps fixed elements behind the keyboard otherwise) ──
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, []);
  return inset;
}

// ── Persisted UI choice (per device; safe when storage is blocked) ───────────
export function useStored<T extends string>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    try { const s = localStorage.getItem(key); if (s) setV(s as T); } catch {}
  }, [key]);
  return [v, (next: T) => { setV(next); try { localStorage.setItem(key, next); } catch {} }];
}
