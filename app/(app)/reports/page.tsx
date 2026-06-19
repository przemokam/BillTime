import { getReportData } from "@/lib/reports";
import { getProjects, getIssuerProfile } from "@/lib/queries";
import { presetRange, type RangePreset } from "@/lib/dates";
import { ReportsView } from "@/components/reports/ReportsView";

const PRESETS: RangePreset[] = ["today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "thisYear", "lastYear"];
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const mode = sp.mode === "detailed" ? "detailed" : "summary";
  const projectId = sp.project || undefined;

  let start: string;
  let end: string;
  let preset: string;
  if (sp.start && sp.end && dateRe.test(sp.start) && dateRe.test(sp.end)) {
    start = sp.start;
    end = sp.end;
    preset = "custom";
  } else {
    preset = sp.preset && (PRESETS as string[]).includes(sp.preset) ? sp.preset : "thisMonth";
    ({ start, end } = presetRange(preset as RangePreset));
  }

  const [data, projects, issuer] = await Promise.all([
    getReportData(start, end, projectId ? [projectId] : undefined),
    getProjects(),
    getIssuerProfile(),
  ]);

  return (
    <ReportsView
      mode={mode}
      preset={preset}
      start={start}
      end={end}
      projectId={projectId ?? null}
      data={data}
      projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
      issuer={issuer}
    />
  );
}
