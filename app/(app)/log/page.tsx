import { getMonthData, getProjects, getWeekdayDefaults, todayKey } from "@/lib/queries";
import { MonthLog } from "@/components/log/MonthLog";

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.y) || now.getFullYear();
  const month = Number(sp.m) || now.getMonth() + 1;
  const projectId = sp.p || undefined;

  const [data, projects, weekdayDefaults] = await Promise.all([
    getMonthData(year, month, projectId),
    getProjects(),
    getWeekdayDefaults(),
  ]);

  return (
    <MonthLog
      data={data}
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        currency: p.currency,
        companyName: p.company?.name ?? null,
        rateCents: p.rateCents,
      }))}
      weekdayDefaults={weekdayDefaults.map((w) => ({
        weekday: w.weekday,
        projectId: w.projectId,
        description: w.description,
        enabled: w.enabled,
      }))}
      today={todayKey()}
      selectedProjectId={projectId ?? null}
      autoAdd={sp.add ?? null}
      timerDraft={sp.compose === "1" ? { projectId: sp.cproj ?? "", from: sp.cfrom ?? "", to: sp.cto ?? "" } : null}
    />
  );
}
