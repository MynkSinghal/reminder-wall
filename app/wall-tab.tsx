"use client";

import { useEffect, useState } from "react";
import { Icon, SectionLabel, Switch } from "./ui";

// Live preview of tonight's wallpaper + the settings that shape it.
export default function WallTab() {
  const [version, setVersion] = useState(() => Date.now());
  const [state, setState]     = useState<"loading" | "ready" | "error">("loading");
  const [codeMode, setCodeMode] = useState(false);
  const [copied, setCopied]   = useState(false);
  const [origin, setOrigin]   = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/settings").then(r => r.json()).then(s => setCodeMode(!!s.codeMode)).catch(() => {});
  }, []);

  const refresh = () => { setState("loading"); setVersion(Date.now()); };

  function toggleCode(next: boolean) {
    setCodeMode(next);
    fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codeMode: next }) })
      .then(r => { if (!r.ok) throw new Error(); refresh(); })
      .catch(() => setCodeMode(!next));
  }

  const url = `${origin}/api/image`;
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { /* clipboard blocked — the URL is selectable */ }
  }

  return (
    <div className="flex flex-col gap-7 pb-32">
      <section className="flex flex-col items-center gap-4">
        <div className="relative w-[min(62vw,270px)] overflow-hidden rounded-[34px] bg-navy-deep shadow-[0_0_0_6px_#05090e,0_0_0_7px_rgba(255,255,255,.12),0_30px_60px_rgba(0,0,0,.5)]"
          style={{ aspectRatio: "1206 / 2622" }}>
          <img key={version} src={`/api/image?v=${version}`} alt="Tonight's wallpaper"
            onLoad={() => setState("ready")} onError={() => setState("error")}
            className={`h-full w-full object-cover transition-opacity duration-300 ${state === "ready" ? "opacity-100" : "opacity-0"}`} />
          {state !== "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              {state === "loading"
                ? <><span className="h-1 w-16 animate-pulse rounded-full bg-label/60" /><span className="font-mono text-[11px] tracking-[0.1em] text-label">RENDERING</span></>
                : <span className="text-[15px] text-dim">Couldn&apos;t render the wallpaper. Check your connection and refresh.</span>}
            </div>
          )}
          <div className="pointer-events-none absolute left-1/2 top-[1.6%] h-[3.6%] w-[31%] -translate-x-1/2 rounded-full bg-black" />
        </div>
        <button onClick={refresh} className="flex items-center gap-2 rounded-full border border-line px-4 py-2.5 font-mono text-[12px] tracking-[0.1em] text-label active:opacity-60">
          <Icon.refresh />REFRESH PREVIEW
        </button>
        <p className="max-w-[34ch] text-center text-[15px] leading-snug text-dim">Rendered just now from your list. Your phone fetches a fresh one at midnight.</p>
      </section>

      <section className="flex flex-col gap-1">
        <SectionLabel>SETTINGS</SectionLabel>
        <div className="flex items-center gap-4 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-semibold">Code mode</div>
            <p className="mt-1 text-[15px] leading-snug text-dim">Scrambles reminders on the wallpaper so people nearby can&apos;t read them. This list stays in plain English.</p>
            <p className="mt-1.5 font-mono text-[12px] text-label">“Call mom at 5pm” → “5pm ta mom llac”</p>
          </div>
          <Switch on={codeMode} onChange={toggleCode} label="Code mode" />
        </div>

        <div className="border-t border-line py-4">
          <div className="text-[18px] font-semibold">Wallpaper link</div>
          <p className="mt-1 text-[15px] leading-snug text-dim">Your Shortcuts automation loads this, then sets it as the lock screen.</p>
          <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-line bg-white/[0.03] p-1.5 pl-3">
            <code className="min-w-0 flex-1 select-all truncate font-mono text-[13px] text-ink">{url || "…/api/image"}</code>
            <button onClick={copy} className="flex shrink-0 items-center gap-1.5 rounded-[9px] bg-white/[0.07] px-3 py-2 font-mono text-[11px] tracking-[0.1em] text-label active:opacity-60">
              <Icon.copy />{copied ? "COPIED" : "COPY"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
