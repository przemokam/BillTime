import { getProjects, getActiveTimer, getSetting } from "@/lib/queries";
import { ccAvailable } from "@/lib/claude-sessions";
import { SkinShell } from "@/components/shell/SkinShell";

// The shell shows live DB state (timer dropdown projects, active timer, skin).
// Without this, the layout is statically cached at build time, so on statically
// rendered pages (/projects, /settings) the timer's project list would freeze to
// whatever the DB held at build (empty in a fresh Docker image) -> "no project".
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [projects, timerRow, skinSetting] = await Promise.all([getProjects(), getActiveTimer(), getSetting("skin")]);
  const projectOpts = projects.map((p) => ({ id: p.id, name: p.name }));
  const initialSkin = skinSetting === "terminal" ? "terminal" : "slab";

  let timer = null;
  if (timerRow?.projectId) {
    const proj = projects.find((p) => p.id === timerRow.projectId);
    timer = {
      projectId: timerRow.projectId,
      projectName: proj?.name ?? "—",
      description: timerRow.description,
      startedAt: timerRow.startedAt.toISOString(),
      pausedMs: timerRow.pausedMs,
      isPaused: timerRow.isPaused,
      pausedAt: timerRow.pausedAt ? timerRow.pausedAt.toISOString() : null,
    };
  }

  return (
    <SkinShell initialSkin={initialSkin} projects={projectOpts} timer={timer} ccAvailable={ccAvailable()}>
      {children}
    </SkinShell>
  );
}
