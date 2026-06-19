"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseTimeOfDay, formatTimeOfDay } from "@/lib/parse/time";
import { todayKey, getLatestDayWithEntries } from "@/lib/queries";
import { SUPPORTED_CURRENCIES } from "@/lib/format";

export type ActionResult = { ok: boolean; error?: string; id?: string };
export type TimerStopResult = ActionResult & { draft?: { projectId: string; from: string; to: string } };

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

function parseRateToCents(raw: string): number {
  const n = parseFloat(raw.replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

// ---------- Time entries ----------

const EntryInput = z.object({
  id: z.string().optional(),
  date: z.string().regex(dateRe, "Invalid date"),
  projectId: z.string().min(1, "Select a project"),
  description: z.string().trim().min(1, "Description can't be empty").max(2000),
  from: z.string().min(1, "Enter a start time"),
  to: z.string().min(1, "Enter an end time"),
  source: z.string().optional(),
});

export async function saveEntry(input: z.input<typeof EntryInput>): Promise<ActionResult> {
  const parsed = EntryInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, date, projectId, description, from, to, source } = parsed.data;

  const startMin = parseTimeOfDay(from);
  const endMin = parseTimeOfDay(to);
  if (startMin == null) return { ok: false, error: `Can't read start time: ${from}` };
  if (endMin == null) return { ok: false, error: `Can't read end time: ${to}` };

  const normalizedEnd = endMin <= startMin ? endMin + 1440 : endMin;
  const data = { date, projectId, description, startMin, endMin: normalizedEnd, source: source ?? "manual" };

  try {
    if (id) {
      await db.timeEntry.update({ where: { id }, data });
    } else {
      const created = await db.timeEntry.create({ data });
      revalidatePath("/log");
      return { ok: true, id: created.id };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
  revalidatePath("/log");
  return { ok: true, id };
}

export async function deleteEntry(id: string): Promise<ActionResult> {
  try {
    await db.timeEntry.delete({ where: { id } });
    revalidatePath("/log");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
}

/** Duplicate a single entry (per-row action). Defaults to the same date. */
export async function cloneEntry(id: string, targetDate?: string): Promise<ActionResult> {
  const src = await db.timeEntry.findUnique({ where: { id } });
  if (!src) return { ok: false, error: "Entry not found" };
  const date = targetDate && dateRe.test(targetDate) ? targetDate : src.date;
  try {
    const created = await db.timeEntry.create({
      data: {
        date,
        projectId: src.projectId,
        description: src.description,
        startMin: src.startMin,
        endMin: src.endMin,
        source: "cloned",
      },
    });
    revalidatePath("/log");
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Duplicate failed" };
  }
}

/** Clone the most recent day that has entries onto `targetDate` (default today). */
export async function cloneLastDay(targetDate?: string): Promise<ActionResult> {
  const target = targetDate && dateRe.test(targetDate) ? targetDate : todayKey();
  const source = await getLatestDayWithEntries(target);
  if (!source || source.length === 0) return { ok: false, error: "No day to clone" };
  try {
    await db.timeEntry.createMany({
      data: source.map((e) => ({
        date: target,
        projectId: e.projectId,
        description: e.description,
        startMin: e.startMin,
        endMin: e.endMin,
        source: "cloned",
      })),
    });
    revalidatePath("/log");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Clone failed" };
  }
}

// ---------- Weekday default descriptions (Settings) ----------

/** Upsert a single global rule per weekday. Empty description removes it. */
export async function setWeekdayDefault(weekday: number, description: string, enabled = true): Promise<ActionResult> {
  if (weekday < 0 || weekday > 6) return { ok: false, error: "Invalid weekday" };
  try {
    await db.weekdayDefault.deleteMany({ where: { weekday } });
    const text = description.trim();
    if (text) await db.weekdayDefault.create({ data: { weekday, projectId: null, description: text, enabled } });
    revalidatePath("/settings");
    revalidatePath("/log");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save rule" };
  }
}

export async function setSetting(key: string, value: string): Promise<ActionResult> {
  try {
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save setting" };
  }
}

// ---------- Projects & companies ----------

const ProjectInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Project name is required").max(200),
  companyId: z.string().nullable().optional(),
  rate: z.string().default("0"),
  currency: z.enum(SUPPORTED_CURRENCIES).default("EUR"),
  color: z.string().nullable().optional(),
  repoPaths: z.string().default(""),
  isArchived: z.boolean().optional(),
});

export async function saveProject(input: z.input<typeof ProjectInput>): Promise<ActionResult> {
  const parsed = ProjectInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, name, companyId, rate, currency, color, repoPaths, isArchived } = parsed.data;
  const paths = repoPaths.split("\n").map((p) => p.trim()).filter(Boolean);
  const data = {
    name,
    companyId: companyId || null,
    rateCents: parseRateToCents(rate),
    currency,
    color: color || null,
    repoPathsJson: paths.length ? JSON.stringify(paths) : null,
    ...(isArchived !== undefined ? { isArchived } : {}),
  };
  try {
    if (id) await db.project.update({ where: { id }, data });
    else await db.project.create({ data });
    revalidatePath("/projects");
    revalidatePath("/log");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save project" };
  }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  try {
    await db.project.delete({ where: { id } });
    revalidatePath("/projects");
    revalidatePath("/log");
    return { ok: true };
  } catch {
    return { ok: false, error: "Can't delete a project with entries. Archive it instead." };
  }
}

export async function saveCompany(input: { id?: string; name: string; note?: string }): Promise<ActionResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Company name is required" };
  try {
    if (input.id) await db.company.update({ where: { id: input.id }, data: { name, note: input.note ?? null } });
    else await db.company.create({ data: { name, note: input.note ?? null } });
    revalidatePath("/projects");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save company" };
  }
}

// ---------- Timer ----------

export async function timerStart(projectId: string, description = ""): Promise<ActionResult> {
  try {
    await db.activeTimer.upsert({
      where: { id: "singleton" },
      update: { projectId, description, startedAt: new Date(), pausedMs: 0, isPaused: false, pausedAt: null },
      create: { id: "singleton", projectId, description },
    });
    revalidatePath("/log");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Timer start failed" };
  }
}

export async function timerPause(): Promise<ActionResult> {
  const t = await db.activeTimer.findUnique({ where: { id: "singleton" } });
  if (!t || t.isPaused) return { ok: true };
  await db.activeTimer.update({ where: { id: "singleton" }, data: { isPaused: true, pausedAt: new Date() } });
  revalidatePath("/log");
  return { ok: true };
}

export async function timerResume(): Promise<ActionResult> {
  const t = await db.activeTimer.findUnique({ where: { id: "singleton" } });
  if (!t || !t.isPaused || !t.pausedAt) return { ok: true };
  const extra = Date.now() - t.pausedAt.getTime();
  await db.activeTimer.update({
    where: { id: "singleton" },
    data: { isPaused: false, pausedAt: null, pausedMs: t.pausedMs + extra },
  });
  revalidatePath("/log");
  return { ok: true };
}

/**
 * Stop the timer: delete it and RETURN the elapsed span as a draft so the client
 * can open the composer pre-filled (project + from/to) for the user to describe
 * the work. No entry is created silently.
 */
export async function timerStop(): Promise<TimerStopResult> {
  const t = await db.activeTimer.findUnique({ where: { id: "singleton" } });
  if (!t) return { ok: false, error: "No active timer" };
  const now = Date.now();
  const pausedNow = t.isPaused && t.pausedAt ? now - t.pausedAt.getTime() : 0;
  const elapsedMs = now - t.startedAt.getTime() - t.pausedMs - pausedNow;
  const startMin = t.startedAt.getHours() * 60 + t.startedAt.getMinutes();
  const endMin = startMin + Math.max(1, Math.round(elapsedMs / 60000));
  const projectId = t.projectId ?? "";

  try {
    await db.activeTimer.delete({ where: { id: "singleton" } });
    revalidatePath("/log");
    return {
      ok: true,
      draft: projectId ? { projectId, from: formatTimeOfDay(startMin), to: formatTimeOfDay(endMin) } : undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Timer stop failed" };
  }
}
