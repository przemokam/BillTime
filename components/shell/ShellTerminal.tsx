import Link from "next/link";
import { Nav } from "./Nav";
import { SoundToggle } from "./SoundToggle";
import { TimerHud, type TimerProps } from "./TimerHud";
import { MiniTimer } from "./MiniTimer";

type ProjectOpt = { id: string; name: string };

export function ShellTerminal({
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
    <div className="grid h-screen grid-cols-[264px_1fr] grid-rows-[88px_1fr_34px]">
      {/* TOP BAR */}
      <header className="col-span-2 row-start-1 grid grid-cols-[1fr_auto_1fr] items-center gap-5 border-b border-hair bg-gradient-to-b from-elev to-panel px-6">
        <Link href="/log" className="group w-max font-disp text-[20px] font-medium tracking-[5px] text-ink">
          BILL<span className="text-neon-yellow group-hover:animate-glitch">TIME</span>
        </Link>
        <div className="justify-self-center">
          <TimerHud timer={timer} projects={projects} variant="terminal" />
        </div>
        <div className="hidden justify-self-end font-mono text-[12px] text-ink-faint lg:block">
          <span className="text-neon-green">operator@nightcity</span>:<span className="text-neon-cyan">~/billtime</span> ❯{" "}
          <span className="animate-blink text-neon-green">_</span>
        </div>
      </header>

      {/* SIDEBAR */}
      <aside className="row-start-2 flex flex-col gap-6 border-r border-hair bg-panel px-4 py-[22px]">
        <Nav variant="sidebar" />
        <div className="mt-auto flex flex-col gap-4">
          <div className="border-t border-hair pt-4">
            <MiniTimer timer={mini} place="sidebar" />
          </div>
          <div className="text-[12px] leading-relaxed">
            <div className={ccAvailable ? "text-neon-green" : "text-ink-dim"}>◉ {ccAvailable ? "CC Assistant active" : "CC offline"}</div>
            <div className="text-ink-faint">{ccAvailable ? "reads local sessions to suggest entries" : "no Claude Code transcripts mounted"}</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="row-start-2 overflow-auto px-8 py-8">{children}</main>

      {/* STATUS BAR */}
      <footer className="col-span-2 row-start-3 flex items-center gap-4 border-t border-hair bg-panel px-5 text-[12px] tracking-[.4px] text-ink-dim">
        <MiniTimer timer={mini} place="status" />
        {timer && <span className="text-ink-faint">{timer.projectName}</span>}
        <span className="flex-1" />
        <span className="text-ink-faint">db <b className="font-normal text-neon-cyan">sqlite</b></span>
        <SoundToggle />
      </footer>
    </div>
  );
}
