import "server-only";
import { db } from "@/lib/db";
import { durationMinutes } from "@/lib/parse/time";

const pad = (n: number) => String(n).padStart(2, "0");

export type EntryView = {
  id: string;
  date: string;
  projectId: string;
  projectName: string;
  projectColor: string | null;
  companyName: string | null;
  description: string;
  startMin: number;
  endMin: number;
  durationMin: number;
  currency: string;
  rateCents: number;
  source: string;
};

export type DayView = {
  dateKey: string;
  dow: number; // 0=Sun..6=Sat
  isWeekend: boolean;
  isToday: boolean;
  isFuture: boolean;
  entries: EntryView[];
};

export type MonthData = {
  year: number;
  month: number; // 1-12
  days: DayView[];
  totalMin: number;
  entryCount: number;
  amountByCurrency: Record<string, number>; // cents
};

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function getProjects(includeArchived = false) {
  return db.project.findMany({
    where: includeArchived ? {} : { isArchived: false },
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCompanies() {
  return db.company.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { projects: true } } } });
}

export async function getMonthData(year: number, month: number, projectId?: string): Promise<MonthData> {
  const prefix = `${year}-${pad(month)}`;
  const rows = await db.timeEntry.findMany({
    where: { date: { startsWith: prefix }, ...(projectId ? { projectId } : {}) },
    include: { project: { include: { company: true } } },
    orderBy: [{ date: "asc" }, { startMin: "asc" }],
  });

  const views: EntryView[] = rows.map((e) => ({
    id: e.id,
    date: e.date,
    projectId: e.projectId,
    projectName: e.project.name,
    projectColor: e.project.color,
    companyName: e.project.company?.name ?? null,
    description: e.description,
    startMin: e.startMin,
    endMin: e.endMin,
    durationMin: durationMinutes(e.startMin, e.endMin),
    currency: e.project.currency,
    rateCents: e.project.rateCents,
    source: e.source,
  }));

  const byDate = new Map<string, EntryView[]>();
  for (const v of views) (byDate.get(v.date) ?? byDate.set(v.date, []).get(v.date)!).push(v);

  const lastDay = new Date(year, month, 0).getDate();
  const tk = todayKey();
  const days: DayView[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateKey = `${prefix}-${pad(d)}`;
    const dow = new Date(year, month - 1, d).getDay();
    days.push({
      dateKey,
      dow,
      isWeekend: dow === 0 || dow === 6,
      isToday: dateKey === tk,
      isFuture: dateKey > tk,
      entries: byDate.get(dateKey) ?? [],
    });
  }

  const totalMin = views.reduce((s, v) => s + v.durationMin, 0);
  const amountByCurrency: Record<string, number> = {};
  for (const v of views) {
    amountByCurrency[v.currency] =
      (amountByCurrency[v.currency] ?? 0) + Math.round((v.durationMin / 60) * v.rateCents);
  }

  return { year, month, days, totalMin, entryCount: views.length, amountByCurrency };
}

/** Default description for a weekday, optionally scoped to a project. */
export async function getWeekdayDefault(weekday: number, projectId?: string): Promise<string | null> {
  const rule = await db.weekdayDefault.findFirst({
    where: { weekday, enabled: true, ...(projectId ? { OR: [{ projectId }, { projectId: null }] } : {}) },
    orderBy: { projectId: "desc" }, // project-specific rule wins over the null (global) one
  });
  return rule?.description ?? null;
}

export async function getWeekdayDefaults() {
  return db.weekdayDefault.findMany({ orderBy: { weekday: "asc" } });
}

/** The most recent day (before `before`) that has any entries. */
export async function getLatestDayWithEntries(before?: string): Promise<EntryView[] | null> {
  const latest = await db.timeEntry.findFirst({
    where: before ? { date: { lt: before } } : {},
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latest) return null;
  const rows = await db.timeEntry.findMany({
    where: { date: latest.date },
    include: { project: { include: { company: true } } },
    orderBy: { startMin: "asc" },
  });
  return rows.map((e) => ({
    id: e.id,
    date: e.date,
    projectId: e.projectId,
    projectName: e.project.name,
    projectColor: e.project.color,
    companyName: e.project.company?.name ?? null,
    description: e.description,
    startMin: e.startMin,
    endMin: e.endMin,
    durationMin: durationMinutes(e.startMin, e.endMin),
    currency: e.project.currency,
    rateCents: e.project.rateCents,
    source: e.source,
  }));
}

export async function getActiveTimer() {
  return db.activeTimer.findUnique({ where: { id: "singleton" } });
}

export async function getSetting(key: string): Promise<string | null> {
  const s = await db.setting.findUnique({ where: { key } });
  return s?.value ?? null;
}
