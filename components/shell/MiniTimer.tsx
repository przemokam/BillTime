"use client";

import { useEffect, useState } from "react";

type T = {
  startedAt: string;
  pausedMs: number;
  isPaused: boolean;
  pausedAt: string | null;
  projectName: string;
} | null;

const pad = (n: number) => String(n).padStart(2, "0");

function elapsedLabel(t: NonNullable<T>): string {
  const started = new Date(t.startedAt).getTime();
  const pausedNow = t.isPaused && t.pausedAt ? Date.now() - new Date(t.pausedAt).getTime() : 0;
  const ms = Math.max(0, Date.now() - started - t.pausedMs - pausedNow);
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function MiniTimer({ timer, place }: { timer: T; place: "sidebar" | "status" }) {
  const [label, setLabel] = useState("00:00:00");

  useEffect(() => {
    if (!timer) return;
    const render = () => setLabel(elapsedLabel(timer));
    render();
    const id = setInterval(render, 1000);
    return () => clearInterval(id);
  }, [timer]);

  if (place === "status") {
    return timer ? (
      <span className="text-neon-magenta">
        <span className="animate-blink">◉</span> REC · {label}
      </span>
    ) : (
      <span className="text-ink-faint">◌ Timer idle</span>
    );
  }

  // sidebar widget
  return timer ? (
    <div className="flex items-center gap-2 text-[12px] text-neon-magenta">
      <span className="animate-blink">◉</span>
      <span className="font-medium">Timer running</span>
      <span className="text-ink-dim">{label}</span>
    </div>
  ) : (
    <div className="flex items-center gap-2 text-[12px] text-ink-faint">
      <span>◌</span> Timer idle - press Start
    </div>
  );
}
