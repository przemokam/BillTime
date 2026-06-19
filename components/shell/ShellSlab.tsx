import Link from "next/link";
import { Nav } from "./Nav";
import { SoundToggle } from "./SoundToggle";
import { TimerHud, type TimerProps } from "./TimerHud";
import { MiniTimer } from "./MiniTimer";

type ProjectOpt = { id: string; name: string };

const TICKS = { backgroundImage: "repeating-linear-gradient(90deg, var(--yellow) 0 2px, transparent 2px 32px)" };

export function ShellSlab({
  projects,
  timer,
  ccAvailable,
  children,
}: {
  projects: ProjectOpt[];
  timer: TimerProps;
  ccAvailable: boolean;
  children: React.ReactNode;
}) {
  const mini = timer
    ? { startedAt: timer.startedAt, pausedMs: timer.pausedMs, isPaused: timer.isPaused, pausedAt: timer.pausedAt, projectName: timer.projectName }
    : null;

  return (
    <div className="flex h-screen flex-col">
      {/* YELLOW SLAB hero */}
      <header className="relative z-30 bg-neon-yellow text-black">
        <div className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 text-[9px] tracking-[2px] opacity-35 [writing-mode:vertical-rl] lg:block">
          TRACK_ID 000082398732
        </div>
        <div className="mx-auto flex max-w-[1340px] items-center justify-between gap-6 px-7 py-4">
          <div>
            <Link href="/log" className="group block font-disp text-[42px] font-black leading-[0.95] tracking-[1px]">
              BILL
              <span className="group-hover:animate-glitch" style={{ WebkitTextStroke: "1.5px #0a0b07", color: "transparent" }}>
                TIME
              </span>
            </Link>
            <div className="mt-1 text-[10px] font-semibold tracking-[2px] opacity-75">HOURLY BILLING SYSTEM</div>
          </div>
          <TimerHud timer={timer} projects={projects} variant="slab" />
        </div>
        <div className="hazard h-3" />
      </header>

      {/* NAV ROW */}
      <div className="border-b border-hair bg-panel">
        <div className="mx-auto flex max-w-[1340px] items-center gap-4 px-7 py-3">
          <Nav variant="horizontal" />
        </div>
      </div>

      {/* tick strip */}
      <div className="h-[6px] opacity-40" style={TICKS} />

      {/* MAIN with HUD corner-bracket frame */}
      <div className="relative min-h-0 flex-1">
        <span className="pointer-events-none absolute left-2 top-2 z-20 h-4 w-4 border-l-2 border-t-2 border-neon-yellow/70" />
        <span className="pointer-events-none absolute right-2 top-2 z-20 h-4 w-4 border-r-2 border-t-2 border-neon-yellow/70" />
        <span className="pointer-events-none absolute bottom-2 left-2 z-20 h-4 w-4 border-b-2 border-l-2 border-neon-yellow/70" />
        <span className="pointer-events-none absolute bottom-2 right-2 z-20 h-4 w-4 border-b-2 border-r-2 border-neon-yellow/70" />
        <div className="pointer-events-none absolute right-[6px] top-1/2 z-20 hidden -translate-y-1/2 text-[9px] tracking-[3px] text-ink-faint/70 [writing-mode:vertical-rl] 2xl:block">
          BILLTIME // SECTOR-7 // V0.1
        </div>
        <main className="h-full overflow-auto">
          <div className="mx-auto max-w-[1340px] px-9 py-7">{children}</div>
        </main>
      </div>

      {/* STATUS BAR */}
      <footer className="border-t border-hair bg-panel">
        <div className="mx-auto flex max-w-[1340px] items-center gap-4 px-7 py-2 text-[12px] tracking-[.4px] text-ink-dim">
          <MiniTimer timer={mini} place="status" />
          {timer && <span className="text-ink-faint">{timer.projectName}</span>}
          <span className="flex items-center gap-2">
            <span className={ccAvailable ? "text-neon-green" : "text-ink-faint"}>◉</span>
            <span className="text-ink-faint">{ccAvailable ? "CC Assistant active" : "CC offline"}</span>
          </span>
          <span className="flex-1" />
          <span className="text-ink-faint">db <b className="font-normal text-neon-yellow">sqlite</b></span>
          <SoundToggle />
        </div>
      </footer>

      {/* bottom yellow bar */}
      <div className="relative bg-neon-yellow">
        <div className="hazard h-2.5" />
        <div className="flex items-center justify-between px-7 py-1 text-[9px] font-semibold tracking-[2px] text-black">
          <span>BILLTIME // HOURLY BILLING SYSTEM</span>
          <span>© 2026 · by TryHard3r · V0.1</span>
        </div>
      </div>
    </div>
  );
}
