import "server-only";
import { db } from "@/lib/db";
import { durationMinutes } from "@/lib/parse/time";
import { amountCents } from "@/lib/format";
import { eachDay } from "@/lib/dates";

export type ReportRow = {
  id: string;
  date: string;
  projectId: string;
  projectName: string;
  companyName: string | null;
  projectColor: string | null;
  description: string;
  startMin: number;
  endMin: number;
  durationMin: number;
  currency: string;
  rateCents: number;
  amountCents: number;
};

export type ReportProject = {
  projectId: string;
  name: string;
  color: string | null;
  companyName: string | null;
  entries: number;
  durationMin: number;
  amountCents: number;
  currency: string;
};

export type DaySegment = { projectId: string; color: string | null; durationMin: number };

export type ReportData = {
  start: string;
  end: string;
  rows: ReportRow[];
  byDay: { date: string; durationMin: number; segments: DaySegment[] }[];
  byProject: ReportProject[];
  totalMin: number;
  amountByCurrency: Record<string, number>;
  entryCount: number;
};

export async function getReportData(start: string, end: string, projectIds?: string[]): Promise<ReportData> {
  const entries = await db.timeEntry.findMany({
    where: {
      date: { gte: start, lte: end },
      ...(projectIds && projectIds.length ? { projectId: { in: projectIds } } : {}),
    },
    include: { project: { include: { company: true } } },
    orderBy: [{ date: "desc" }, { startMin: "asc" }],
  });

  const rows: ReportRow[] = entries.map((e) => {
    const durationMin = durationMinutes(e.startMin, e.endMin);
    return {
      id: e.id,
      date: e.date,
      projectId: e.projectId,
      projectName: e.project.name,
      companyName: e.project.company?.name ?? null,
      projectColor: e.project.color,
      description: e.description,
      startMin: e.startMin,
      endMin: e.endMin,
      durationMin,
      currency: e.project.currency,
      rateCents: e.project.rateCents,
      amountCents: amountCents(durationMin, e.project.rateCents),
    };
  });

  // bar chart: every day in range, broken down by project (stacked segments)
  const dayMap = new Map<string, Map<string, { color: string | null; durationMin: number }>>();
  for (const r of rows) {
    let pm = dayMap.get(r.date);
    if (!pm) {
      pm = new Map();
      dayMap.set(r.date, pm);
    }
    const cur = pm.get(r.projectId);
    if (cur) cur.durationMin += r.durationMin;
    else pm.set(r.projectId, { color: r.projectColor, durationMin: r.durationMin });
  }
  const byDay = eachDay(start, end).map((date) => {
    const pm = dayMap.get(date);
    const segments: DaySegment[] = pm
      ? [...pm.entries()].map(([projectId, v]) => ({ projectId, color: v.color, durationMin: v.durationMin }))
      : [];
    return { date, durationMin: segments.reduce((s, x) => s + x.durationMin, 0), segments };
  });

  // breakdown by project. Aggregate minutes first, then round the amount ONCE on
  // the summed duration - so many short entries can't drift from billing the
  // total time (e.g. 3x20min must equal billing 1h, not 3x rounded 20min).
  const projAcc = new Map<string, { row: ReportProject; rateCents: number }>();
  for (const r of rows) {
    const a = projAcc.get(r.projectId);
    if (a) {
      a.row.durationMin += r.durationMin;
      a.row.entries += 1;
    } else {
      projAcc.set(r.projectId, {
        rateCents: r.rateCents,
        row: {
          projectId: r.projectId,
          name: r.projectName,
          color: r.projectColor,
          companyName: r.companyName,
          entries: 1,
          durationMin: r.durationMin,
          amountCents: 0,
          currency: r.currency,
        },
      });
    }
  }
  for (const a of projAcc.values()) a.row.amountCents = amountCents(a.row.durationMin, a.rateCents);
  const byProject = [...projAcc.values()].map((a) => a.row).sort((a, b) => b.durationMin - a.durationMin);

  const totalMin = rows.reduce((s, r) => s + r.durationMin, 0);
  // Sum the per-project amounts (each already rounded once) so the invoice total
  // matches the per-project breakdown exactly.
  const amountByCurrency: Record<string, number> = {};
  for (const p of byProject) amountByCurrency[p.currency] = (amountByCurrency[p.currency] ?? 0) + p.amountCents;

  return { start, end, rows, byDay, byProject, totalMin, amountByCurrency, entryCount: rows.length };
}
