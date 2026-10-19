"use client";

import { useState } from "react";
import { Logo } from "./logo";
import ListTab from "./list-tab";
import QuotesTab from "./quotes-tab";
import WallTab from "./wall-tab";
import { Icon, useKeyboardInset, useStored } from "./ui";

type Tab = "list" | "quotes" | "wall";
const TABS: { id: Tab; label: string; title: string; icon: () => React.ReactNode }[] = [
  { id: "list",   label: "LIST",   title: "The list", icon: Icon.list },
  { id: "quotes", label: "QUOTES", title: "Quotes",   icon: Icon.quote },
  { id: "wall",   label: "WALL",   title: "The wall", icon: Icon.wall },
];
const TAB_BAR_H = 62;

export default function Home() {
  const [tab, setTab] = useStored<Tab>("rw-tab", "list");
  const [typing, setTyping] = useState(false);
  const keyboard = useKeyboardInset();
  const hideBar = typing && keyboard > 0;
  const current = TABS.find(t => t.id === tab) ?? TABS[0];

  return (
    <main className="min-h-dvh">
      {/* Header — clears the status bar when launched from the home screen */}
      <header className="sticky top-0 z-40 border-b border-line bg-navy-top/80 backdrop-blur-xl" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-5">
          <Logo size={28} className="shrink-0 rounded-[7px]" />
          <span className="font-display text-[15px] uppercase tracking-[0.02em]">Reminder Wall</span>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-5">
        <h1 className="pb-6 pt-7 font-display text-[44px] uppercase leading-[0.9] tracking-[-0.035em]">{current.title}</h1>
        {tab === "list" && (
          <ListTab onComposerFocus={setTyping}
            composerBottom={keyboard > 0 && typing ? `${keyboard + 10}px` : `calc(var(--safe-bottom) + ${TAB_BAR_H + 12}px)`} />
        )}
        {tab === "quotes" && <QuotesTab />}
        {tab === "wall" && <WallTab />}
      </div>

      {/* Tab bar */}
      <nav aria-label="Sections"
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-navy-deep/85 backdrop-blur-xl transition-transform duration-200 ${hideBar ? "translate-y-full" : ""}`}
        style={{ paddingBottom: "var(--safe-bottom)" }}>
        <div className="mx-auto grid max-w-xl grid-cols-3" style={{ height: TAB_BAR_H }}>
          {TABS.map(t => {
            const on = t.id === tab;
            return (
              <button key={t.id} onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }} aria-current={on ? "page" : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${on ? "text-ink" : "text-faint active:text-dim"}`}>
                <span className={`absolute top-0 h-[3px] w-10 bg-ink transition-opacity ${on ? "opacity-100" : "opacity-0"}`} />
                {t.icon()}
                <span className="font-mono text-[10px] tracking-[0.14em]">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
