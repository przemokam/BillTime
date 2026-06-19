"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Square } from "lucide-react";
import { timerStart, timerPause, timerResume, timerStop } from "@/app/actions";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/Select";

export type TimerProps = {
  projectId: string;
  projectName: string;
  description: string;
  startedAt: string;
  pausedMs: number;
  isPaused: boolean;
  pausedAt: string | null;
} | null;

type ProjectOpt = { id: string; name: string };

const pad = (n: number) => String(n).padStart(2, "0");

function calcElapsedMs(t: NonNullable<TimerProps>): number {
  const started = new Date(t.startedAt).getTime();
  const pausedNow = t.isPaused && t.pausedAt ? Date.now() - new Date(t.pausedAt).getTime() : 0;
  return Math.max(0, Date.now() - started - t.pausedMs - pausedNow);
}

export function TimerHud({
  timer,
  projects,
  variant = "slab",
}: {
  timer: TimerProps;
  projects: ProjectOpt[];
  variant?: "slab" | "terminal";
}) {
  const router = useRouter();
  const [, startT] = useTransition();
  const [pick, setPick] = useState(projects[0]?.id ?? "");
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    if (!timer) return;
    const render = () => {
      const ms = calcElapsedMs(timer);
      const s = Math.floor(ms / 1000);
      setElapsed(`${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`);
    };
    render();
    const id = setInterval(render, 1000);
    return () => clearInterval(id);
  }, [timer]);

  const run = (fn: () => Promise<unknown>) => startT(() => void fn().then(() => router.refresh()));
  const start = () => {
    sfx.start();
    run(() => timerStart(pick));
  };
  const toggle = () => {
    sfx.click();
    run(() => (timer!.isPaused ? timerResume() : timerPause()));
  };
  const stop = () => {
    sfx.stop();
    startT(async () => {
      const res = await timerStop();
      if (res.ok && res.draft) {
        router.push(`/log?compose=1&cproj=${res.draft.projectId}&cfrom=${encodeURIComponent(res.draft.from)}&cto=${encodeURIComponent(res.draft.to)}`);
      } else {
        router.refresh();
      }
    });
  };

  // ---------- SLAB (black-on-yellow) ----------
  if (variant === "slab") {
    if (!timer) {
      return (
        <div className="flex items-center gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[2px] text-black/55">Idle</div>
          <Select box className="min-w-[160px] max-w-[210px]" value={pick} onChange={setPick} options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="No project" />
          <button
            disabled={!pick}
            onMouseEnter={() => sfx.hover()}
            onClick={start}
            className="clip-tab flex items-center gap-1.5 bg-black px-4 py-2 font-disp text-[12px] font-semibold uppercase tracking-wide text-neon-yellow transition hover:opacity-90 disabled:opacity-40"
          >
            <Play size={13} /> Start
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-4 text-black">
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5 text-[11px] font-semibold uppercase tracking-[2px]">
            <span className="inline-block h-2.5 w-2.5 animate-blink rounded-full bg-black" /> {timer.isPaused ? "Paused" : "REC // Active"}
          </div>
          <div className="max-w-[150px] truncate text-[11px] tracking-wide text-black/70">{timer.projectName}</div>
        </div>
        <div className="font-disp text-[38px] font-black leading-none tracking-[1px]">{elapsed}</div>
        <div className="flex gap-1.5">
          <button title={timer.isPaused ? "Resume" : "Pause"} onMouseEnter={() => sfx.hover()} onClick={toggle} className="grid h-9 w-9 place-items-center border-2 border-black/40 text-black transition hover:border-black active:scale-90">
            {timer.isPaused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button title="Stop · describe entry" onMouseEnter={() => sfx.hover()} onClick={stop} className="grid h-9 w-9 place-items-center border-2 border-black/40 text-black transition hover:border-neon-red hover:text-neon-red active:scale-90">
            <Square size={13} />
          </button>
        </div>
      </div>
    );
  }

  // ---------- TERMINAL (dark) ----------
  if (!timer) {
    return (
      <div className="clip-hud flex items-center gap-3 border border-hair-hot bg-neon-cyan/[0.03] px-4 py-2.5">
        <div className="text-[11px] uppercase tracking-[2px] text-ink-faint">Idle</div>
        <Select className="min-w-[150px] max-w-[210px]" value={pick} onChange={setPick} options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="No project" />
        <button disabled={!pick} onMouseEnter={() => sfx.hover()} onClick={start} className="flex items-center gap-1.5 rounded-sm border border-neon-green px-3 py-1.5 text-[12px] uppercase tracking-wide text-neon-green transition hover:shadow-[0_0_8px_rgba(52,255,174,.5)] disabled:opacity-40">
          <Play size={13} /> Start
        </button>
      </div>
    );
  }
  return (
    <div className="bracket-mag clip-hud relative flex items-center gap-4 border border-hair-hot bg-neon-magenta/[0.05] px-5 py-2.5">
      <div>
        <div className="text-[10px] uppercase tracking-[2px] text-neon-magenta">
          <span className="animate-blink">◉</span> {timer.isPaused ? "PAUSED" : "REC"}
        </div>
        <div className="max-w-[140px] truncate text-[10px] tracking-wide text-ink-dim">{timer.projectName}</div>
      </div>
      <div className="font-disp text-[30px] font-medium tracking-[2px] text-white">{elapsed}</div>
      <div className="flex gap-1.5">
        <button title={timer.isPaused ? "Resume" : "Pause"} onMouseEnter={() => sfx.hover()} onClick={toggle} className="grid h-8 w-8 place-items-center rounded-sm border border-hair-hot text-ink-dim transition hover:border-neon-cyan hover:text-neon-cyan active:scale-90">
          {timer.isPaused ? <Play size={12} /> : <Pause size={12} />}
        </button>
        <button title="Stop · describe entry" onMouseEnter={() => sfx.hover()} onClick={stop} className="grid h-8 w-8 place-items-center rounded-sm border border-hair-hot text-ink-dim transition hover:border-neon-red hover:text-neon-red active:scale-90">
          <Square size={11} />
        </button>
      </div>
    </div>
  );
}
