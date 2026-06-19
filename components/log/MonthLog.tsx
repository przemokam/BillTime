"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, Plus, X, Sparkles, ArrowRightLeft } from "lucide-react";
import type { MonthData, EntryView } from "@/lib/queries";
import { parseTimeOfDay, durationMinutes, formatDuration, formatTimeOfDay } from "@/lib/parse/time";
import { formatMoney } from "@/lib/format";
import { saveEntry, deleteEntry, cloneLastDay } from "@/app/actions";
import { getCcHint, summarizeCcSession, type CcHint } from "@/app/cc-actions";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { RowMenu } from "./RowMenu";
import { Select } from "@/components/ui/Select";
import { MonthPicker } from "./MonthPicker";

type ProjectOpt = {
  id: string;
  name: string;
  color: string | null;
  currency: string;
  companyName: string | null;
  rateCents: number;
};
type WeekdayRule = { weekday: number; projectId: string | null; description: string; enabled: boolean };
type Draft = { editId: string | null; date: string; projectId: string; description: string; from: string; to: string };

const MONTHS_FULL = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const MONTHS_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOWS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (k: string, n: number) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};
const dateLabel = (k: string) => {
  const d = fromKey(k);
  return { d: d.getDate(), mon: MONTHS_ABBR[d.getMonth()], dow: DOWS[d.getDay()] };
};

const NEON: Record<string, string> = { yellow: "var(--yellow)", cyan: "var(--cyan)", magenta: "var(--magenta)", green: "var(--green)" };
const colorOf = (c: string | null) => (c && (NEON[c] ?? (c.startsWith("#") ? c : null))) || "var(--cyan)";

export function MonthLog({
  data,
  projects,
  weekdayDefaults,
  today,
  selectedProjectId,
  autoAdd,
  timerDraft,
  ccEnabled,
}: {
  data: MonthData;
  projects: ProjectOpt[];
  weekdayDefaults: WeekdayRule[];
  today: string;
  selectedProjectId: string | null;
  autoAdd?: string | null;
  timerDraft?: { projectId: string; from: string; to: string } | null;
  ccEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ccHint, setCcHint] = useState<CcHint | null>(null);
  const [ccBusy, setCcBusy] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, { loading?: boolean; text?: string }>>({});

  const summarize = useCallback((id: string) => {
    setSummaries((m) => ({ ...m, [id]: { ...m[id], loading: true } }));
    summarizeCcSession(id)
      .then((r) => {
        if (r.ok && r.summary) {
          sfx.confirm();
          setSummaries((m) => ({ ...m, [id]: { loading: false, text: r.summary } }));
        } else {
          sfx.error();
          setError(r.error ?? "Summary failed");
          setSummaries((m) => ({ ...m, [id]: { loading: false } }));
        }
      })
      .catch(() => setSummaries((m) => ({ ...m, [id]: { loading: false } })));
  }, []);

  const defaultDescFor = useCallback(
    (dateKey: string, projectId: string) => {
      const dow = fromKey(dateKey).getDay();
      const rules = weekdayDefaults.filter((r) => r.enabled && r.weekday === dow);
      const scoped = rules.find((r) => r.projectId === projectId) ?? rules.find((r) => r.projectId === null);
      return scoped?.description ?? "";
    },
    [weekdayDefaults],
  );

  const loadCc = useCallback((dateKey: string, projectId: string) => {
    // CC integration is dev-machine only (reads local transcripts). Disabled in
    // Docker -> never fetch, so the whole sessions panel + sum stay hidden.
    if (!ccEnabled || !projectId) return setCcHint(null);
    setCcBusy(true);
    getCcHint(dateKey, projectId)
      .then((h) => setCcHint(h.available ? h : null))
      .catch(() => setCcHint(null))
      .finally(() => setCcBusy(false));
  }, [ccEnabled]);

  const lastUsedProjectId = useMemo(() => {
    for (let i = data.days.length - 1; i >= 0; i--) {
      const es = data.days[i].entries;
      if (es.length) return es[es.length - 1].projectId;
    }
    return null;
  }, [data]);

  const openNew = useCallback(
    (dateKey?: string) => {
      const date = dateKey ?? today;
      const projectId = selectedProjectId || lastUsedProjectId || projects[0]?.id || "";
      setError(null);
      setDraft({ editId: null, date, projectId, description: defaultDescFor(date, projectId), from: "", to: "" });
      loadCc(date, projectId);
    },
    [today, selectedProjectId, lastUsedProjectId, projects, defaultDescFor, loadCc],
  );

  const openEdit = useCallback(
    (e: EntryView) => {
      setError(null);
      setDraft({ editId: e.id, date: e.date, projectId: e.projectId, description: e.description, from: formatTimeOfDay(e.startMin), to: formatTimeOfDay(e.endMin) });
      loadCc(e.date, e.projectId);
    },
    [loadCc],
  );

  const close = () => {
    setDraft(null);
    setError(null);
  };

  const submit = (next: boolean) => {
    if (!draft) return;
    startT(async () => {
      const res = await saveEntry({ id: draft.editId ?? undefined, date: draft.date, projectId: draft.projectId, description: draft.description, from: draft.from, to: draft.to });
      if (!res.ok) {
        sfx.error();
        setError(res.error ?? "Save failed");
        return;
      }
      sfx.confirm();
      setError(null);
      if (next && !draft.editId) {
        const nd = addDays(draft.date, 1);
        setDraft({ editId: null, date: nd, projectId: draft.projectId, description: defaultDescFor(nd, draft.projectId), from: "", to: "" });
        loadCc(nd, draft.projectId);
      } else {
        setDraft(null);
      }
      router.refresh();
    });
  };

  const runAction = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: () => void) => {
    startT(async () => {
      const res = await fn();
      if (res.ok) {
        ok?.();
        router.refresh();
      } else {
        sfx.error();
        setError(res.error ?? null);
      }
    });
  };

  const remove = (id: string) => runAction(() => deleteEntry(id), () => sfx.click());
  // Duplicate -> open the composer as a NEW entry, prefilled from this row but
  // dated to the next day. The user reviews/edits, then saves (no silent clone).
  const duplicateToNextDay = (e: EntryView) => {
    setError(null);
    const date = addDays(e.date, 1);
    setDraft({ editId: null, date, projectId: e.projectId, description: e.description, from: formatTimeOfDay(e.startMin), to: formatTimeOfDay(e.endMin) });
    loadCc(date, e.projectId);
  };
  const cloneYesterday = () => runAction(() => cloneLastDay(today), () => sfx.confirm());

  const goMonth = (delta: number) => {
    let y = data.year;
    let m = data.month + delta;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    sfx.click();
    router.push(`/log?y=${y}&m=${m}${selectedProjectId ? `&p=${selectedProjectId}` : ""}`);
  };

  const setProject = (id: string | null) => {
    sfx.click();
    router.push(`/log?y=${data.year}&m=${data.month}${id ? `&p=${id}` : ""}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key.toLowerCase() === "n") { e.preventDefault(); openNew(); }
      else if (e.key.toLowerCase() === "d") { e.preventDefault(); cloneYesterday(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNew]);

  // Open the composer when arriving with timer-stop / add params. Reacts to the
  // params changing (not just mount), because clicking Stop while already on /log
  // re-navigates here without remounting MonthLog. After consuming, strip the
  // one-shot params (keeping month/project) so a refresh/remount won't re-open it.
  const consumeNavParams = useCallback(() => {
    const q = new URLSearchParams();
    q.set("y", String(data.year));
    q.set("m", String(data.month));
    if (selectedProjectId) q.set("p", selectedProjectId);
    router.replace(`/log?${q.toString()}`, { scroll: false });
  }, [router, data.year, data.month, selectedProjectId]);

  useEffect(() => {
    if (timerDraft && timerDraft.projectId) {
      const date = today;
      const projectId = timerDraft.projectId || selectedProjectId || lastUsedProjectId || projects[0]?.id || "";
      setError(null);
      setDraft({ editId: null, date, projectId, description: defaultDescFor(date, projectId), from: timerDraft.from, to: timerDraft.to });
      loadCc(date, projectId);
      consumeNavParams();
    } else if (autoAdd) {
      openNew(autoAdd === "1" || autoAdd === "today" ? undefined : autoAdd);
      consumeNavParams();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerDraft?.projectId, timerDraft?.from, timerDraft?.to, autoAdd]);

  const calc = useMemo(() => {
    if (!draft) return null;
    const f = parseTimeOfDay(draft.from);
    const t = parseTimeOfDay(draft.to);
    if (f == null || t == null) return { valid: false, label: "--", detail: "Enter valid times" };
    const dmin = durationMinutes(f, t);
    return { valid: true, label: formatDuration(dmin), detail: `${formatTimeOfDay(f)} - ${formatTimeOfDay(t)} · ${formatDuration(dmin)}` };
  }, [draft]);

  const visibleDays = data.days.filter((d) => d.entries.length > 0 || d.isToday);
  const gapDays = data.days.filter((d) => d.entries.length === 0 && !d.isFuture && !d.isWeekend && !d.isToday);
  const amounts = Object.entries(data.amountByCurrency).map(([cur, cents]) => formatMoney(cents, cur)).join("  ·  ");

  return (
    <div>
      {/* header */}
      <h1 className="flex items-center gap-4 font-disp text-[15px] font-medium uppercase tracking-[2.8px] text-ink">
        Timesheet
        <span className="h-px flex-1 bg-gradient-to-r from-hair-hot to-transparent" />
        <span className="text-[11px] tracking-[1.6px] text-ink-faint">{data.entryCount} ENTRIES</span>
      </h1>

      {/* controls */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 font-disp tracking-[2px]">
          <button onClick={() => goMonth(-1)} onMouseEnter={() => sfx.hover()} className="px-1.5 text-neon-cyan transition hover:scale-125 hover:drop-shadow-[0_0_6px_rgba(47,230,255,.6)]">
            <ChevronLeft size={17} />
          </button>
          <MonthPicker
            year={data.year}
            month={data.month}
            onPick={(y, m) => {
              sfx.click();
              router.push(`/log?y=${y}&m=${m}${selectedProjectId ? `&p=${selectedProjectId}` : ""}`);
            }}
          />
          <button onClick={() => goMonth(1)} onMouseEnter={() => sfx.hover()} className="px-1.5 text-neon-cyan transition hover:scale-125 hover:drop-shadow-[0_0_6px_rgba(47,230,255,.6)]">
            <ChevronRight size={17} />
          </button>
        </div>

        <span className="mx-1 h-4 w-px bg-hair-hot" />

        <Chip active={!selectedProjectId} onClick={() => setProject(null)}>
          All projects
        </Chip>
        {projects.map((p) => (
          <Chip key={p.id} active={selectedProjectId === p.id} onClick={() => setProject(p.id)}>
            <span style={{ color: selectedProjectId === p.id ? "var(--bg)" : colorOf(p.color) }}>●</span> {p.name}
          </Chip>
        ))}

        <span className="flex-1" />

        <button
          onClick={() => openNew()}
          onMouseEnter={() => sfx.hover()}
          className="clip-sm flex items-center gap-2 border border-neon-yellow/60 px-4 py-2 text-[12px] font-medium uppercase tracking-wide text-neon-yellow transition hover:bg-neon-yellow/10 hover:shadow-glow-yellow"
        >
          <Plus size={14} /> Add Day <kbd className="ml-0.5 text-ink-faint">N</kbd>
        </button>
        <button
          onClick={cloneYesterday}
          onMouseEnter={() => sfx.hover()}
          className="clip-sm flex items-center gap-2 border border-hair-hot px-4 py-2 text-[12px] uppercase tracking-wide text-ink-dim transition hover:border-neon-cyan hover:text-neon-cyan"
        >
          <Copy size={14} /> Clone Yesterday <kbd className="ml-0.5 text-ink-faint">D</kbd>
        </button>
      </div>

      {gapDays.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-faint">
          <span className="text-neon-magenta">⚠ Gaps:</span>
          {gapDays.map((d) => {
            const l = dateLabel(d.dateKey);
            return (
              <button key={d.dateKey} onClick={() => openNew(d.dateKey)} onMouseEnter={() => sfx.hover()} className="transition hover:text-neon-cyan">
                {l.d} {l.mon}
              </button>
            );
          })}
          <span className="opacity-60">(weekdays with no entry - click to add)</span>
        </div>
      )}

      {/* table */}
      <table className="mt-4 w-full border-collapse text-[14px]">
        <thead className="sticky top-0 z-10 bg-panel">
          <tr className="[&>th]:border-b [&>th]:border-hair-hot [&>th]:px-3 [&>th]:py-3 [&>th]:text-left [&>th]:text-[12px] [&>th]:font-normal [&>th]:uppercase [&>th]:tracking-[1.6px] [&>th]:text-ink-faint">
            <th className="w-[120px]">Date</th>
            <th className="w-[160px]">Project</th>
            <th>Description</th>
            <th className="w-[68px]">From</th>
            <th className="w-[68px]">To</th>
            <th className="w-[92px] text-right">Hours</th>
            <th className="w-[56px]" />
          </tr>
        </thead>
        <tbody>
          {visibleDays.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-12 text-center text-[13px] text-ink-faint">
                No entries this month - press <kbd className="text-neon-yellow">N</kbd> to add a day
              </td>
            </tr>
          )}
          {visibleDays.map((day) => {
            const lbl = dateLabel(day.dateKey);
            if (day.entries.length === 0) {
              return (
                <tr key={day.dateKey} className={cn("group border-b border-hair transition hover:bg-elev-hi", day.isToday && "bg-neon-yellow/[0.04]")}>
                  <td className={cn("px-3 py-[13px]", day.isToday ? "text-neon-yellow drop-shadow-[0_0_7px_rgba(252,238,10,.5)] shadow-[inset_2px_0_0_var(--yellow)]" : "text-ink-faint")}>
                    {lbl.d} {lbl.mon}
                    <span className="ml-1.5 text-[11px] text-ink-faint">{lbl.dow}</span>
                  </td>
                  <td className="px-3 text-ink-faint">—</td>
                  <td className="px-3 text-ink-faint">
                    no entry{" "}
                    <button onClick={() => openNew(day.dateKey)} className="text-neon-cyan opacity-0 transition hover:underline group-hover:opacity-100">
                      [+ add]
                    </button>
                  </td>
                  <td className="px-3 text-ink-faint">—</td>
                  <td className="px-3 text-ink-faint">—</td>
                  <td className="px-3 text-right text-ink-faint">—</td>
                  <td />
                </tr>
              );
            }
            return day.entries.map((e, j) => (
              <tr key={e.id} className={cn("group border-b border-hair transition hover:bg-elev-hi", day.isToday && "bg-neon-yellow/[0.04]")}>
                <td className={cn("px-3 py-[13px] align-top", day.isToday ? "text-neon-yellow drop-shadow-[0_0_7px_rgba(252,238,10,.5)]" : "text-neon-cyan", day.isToday && j === 0 && "shadow-[inset_2px_0_0_var(--yellow)]")}>
                  {j === 0 ? (
                    <>
                      {lbl.d} {lbl.mon}
                      <span className="ml-1.5 text-[11px] text-ink-faint">{lbl.dow}</span>
                    </>
                  ) : (
                    <span className="text-ink-faint">↳</span>
                  )}
                </td>
                <td className="px-3">
                  <span className="border-l-[3px] pl-2.5 text-ink" style={{ borderColor: colorOf(e.projectColor) }}>
                    {e.companyName ?? e.projectName}
                  </span>
                </td>
                <td className="cursor-pointer px-3 text-ink transition hover:text-white" onClick={() => openEdit(e)} title="Click to edit">
                  {e.description}
                </td>
                <td className="px-3 text-ink-dim">{formatTimeOfDay(e.startMin)}</td>
                <td className="px-3 text-ink-dim">{formatTimeOfDay(e.endMin)}</td>
                <td className="px-3 text-right text-ink">{formatDuration(e.durationMin)}</td>
                <td className="px-2">
                  <RowMenu onEdit={() => openEdit(e)} onDuplicate={() => duplicateToNextDay(e)} onDelete={() => remove(e.id)} />
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>

      {/* composer */}
      {draft && (
        <div className="mt-6 animate-rise">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <span className="font-disp text-[12px] uppercase tracking-[2px] text-ink-dim">{draft.editId ? "Edit Entry" : "New Entry"}</span>
              <span className="text-[10px] text-ink-faint">↵ Save · ⇧↵ Save + Next · Esc Close</span>
            </div>
            <button onClick={close} className="text-ink-faint transition hover:text-neon-red">
              <X size={15} />
            </button>
          </div>
          <form
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); submit(e.shiftKey); }
              if (e.key === "Escape") close();
            }}
            className="clip-tl relative flex flex-wrap items-end gap-5 border border-hair-hot bg-elev px-[22px] py-[18px]"
          >
            <span className="self-center text-[16px] text-neon-green drop-shadow-[0_0_6px_rgba(52,255,174,.4)]">❯</span>

            <Field label="Date">
              <input
                type="date"
                value={draft.date}
                onChange={(e) => {
                  const date = e.target.value;
                  const description = !draft.editId && (draft.description === "" || draft.description === defaultDescFor(draft.date, draft.projectId)) ? defaultDescFor(date, draft.projectId) : draft.description;
                  setDraft({ ...draft, date, description });
                  loadCc(date, draft.projectId);
                }}
                className="border-b border-hair-hot bg-transparent py-1 text-[15px] text-neon-cyan outline-none [color-scheme:dark] focus:border-neon-cyan"
              />
            </Field>

            <Field label="Project" className="min-w-[200px]">
              <Select
                value={draft.projectId}
                options={projects.map((p) => ({
                  value: p.id,
                  label: (
                    <span className="flex items-center gap-2">
                      <span style={{ color: colorOf(p.color) }}>●</span>
                      {p.name}
                    </span>
                  ),
                }))}
                onChange={(projectId) => {
                  const description = !draft.editId && (draft.description === "" || draft.description === defaultDescFor(draft.date, draft.projectId)) ? defaultDescFor(draft.date, projectId) : draft.description;
                  setDraft({ ...draft, projectId, description });
                  loadCc(draft.date, projectId);
                }}
              />
            </Field>

            <Field label="Description" className="min-w-[260px] flex-1">
              <input
                autoFocus
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="what did you work on..."
                className="w-full border-b border-hair-hot bg-transparent py-1 text-[15px] text-white outline-none placeholder:text-ink-faint focus:border-neon-cyan"
              />
            </Field>

            <Field label="From">
              <input value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} placeholder="900" className="w-[64px] border-b border-hair-hot bg-transparent py-1 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-neon-cyan" />
            </Field>
            <Field label="To">
              <input value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} placeholder="1330" className="w-[64px] border-b border-hair-hot bg-transparent py-1 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-neon-cyan" />
            </Field>

            <div className={cn("min-w-[96px] text-right font-disp text-[22px] font-medium tracking-wide", calc?.valid ? "text-neon-yellow drop-shadow-[0_0_7px_rgba(252,238,10,.35)]" : "text-ink-faint")}>
              {calc?.label ?? "--"}
            </div>

            <button
              type="button"
              disabled={pending}
              onClick={() => submit(false)}
              onMouseEnter={() => sfx.hover()}
              className="clip-sm border border-neon-green px-5 py-2 font-disp text-[12px] uppercase tracking-wide text-neon-green transition hover:bg-neon-green/10 hover:shadow-[0_0_8px_rgba(52,255,174,.4)] disabled:opacity-40"
            >
              {pending ? "..." : draft.editId ? "Save" : "Log Entry"}
            </button>
          </form>

          <div className="mt-2 min-h-[16px] text-[12px]">
            {error ? <span className="text-neon-red">⚠ {error}</span> : <span className={calc?.valid ? "text-neon-green" : "text-ink-faint"}>{calc?.detail}</span>}
          </div>

          {(ccBusy || ccHint) && (
            <div className="clip-sm mt-3 border border-hair-hot bg-elev/60 p-3">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <Sparkles size={14} className="text-neon-green" />
                <span className="font-semibold text-neon-green">Claude Code sessions</span>
                <span className="text-ink-faint">{draft.date}</span>
                {ccHint && (
                  <span className="text-ink-dim">
                    ~{ccHint.totalActiveLabel} active · {ccHint.sessions.length} session{ccHint.sessions.length !== 1 ? "s" : ""}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-ink-faint">click a session to add its summary · ⇄ uses its time</span>
              </div>
              {ccBusy ? (
                <div className="mt-2 text-[12px] text-ink-faint">reading sessions...</div>
              ) : ccHint && ccHint.sessions.length > 0 ? (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  {ccHint.sessions.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 text-[12px]">
                      <span className="flex w-[170px] shrink-0 items-center gap-1.5 truncate" title={`${s.repo}${s.branch ? " · " + s.branch : ""}${s.matched ? " · project repo" : ""}`}>
                        <span className={s.matched ? "text-neon-yellow" : "text-ink-faint/50"}>●</span>
                        <span className={cn("truncate", s.matched ? "text-neon-yellow/90" : "text-ink-dim")}>{s.repo}</span>
                        {s.branch ? <span className="shrink-0 text-ink-faint">· {s.branch}</span> : null}
                      </span>
                      {(() => {
                        const text = summaries[s.id]?.text ?? s.title;
                        return (
                          <button
                            onClick={() => {
                              sfx.confirm();
                              setDraft((d) => (d ? { ...d, description: d.description ? `${d.description}, ${text}` : text } : d));
                            }}
                            onMouseEnter={() => sfx.hover()}
                            className={cn("flex-1 truncate text-left transition hover:underline", summaries[s.id]?.text ? "text-neon-green" : "text-neon-cyan")}
                            title={`Insert: ${text}`}
                          >
                            {text}
                          </button>
                        );
                      })()}
                      {s.filesTouched > 0 && (
                        <span className="shrink-0 text-ink-faint" title={`${s.filesTouched} files edited`}>
                          {s.filesTouched}f
                        </span>
                      )}
                      <span className="shrink-0 text-ink-dim">~{s.activeLabel}</span>
                      {!summaries[s.id]?.text && (
                        <button
                          onClick={() => summarize(s.id)}
                          onMouseEnter={() => sfx.hover()}
                          disabled={summaries[s.id]?.loading}
                          className="flex shrink-0 items-center gap-1 rounded-sm border border-dashed border-hair-hot px-1.5 py-0.5 text-neon-green transition hover:border-neon-green disabled:opacity-50"
                          title="Summarize what was done (local Claude, read-only)"
                        >
                          {summaries[s.id]?.loading ? "..." : (<><Sparkles size={10} /> sum</>)}
                        </button>
                      )}
                      {s.from && s.to && (
                        <button
                          onClick={() => setDraft((d) => (d ? { ...d, from: s.from!, to: s.to! } : d))}
                          onMouseEnter={() => sfx.hover()}
                          className="flex shrink-0 items-center gap-1 rounded-sm border border-dashed border-hair-hot px-1.5 py-0.5 text-neon-cyan transition hover:border-neon-cyan"
                          title="Use this session's time window"
                        >
                          <ArrowRightLeft size={11} /> {s.from}-{s.to}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-[12px] text-ink-faint">no sessions found for this day / project repos</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* summary */}
      <div className="mt-6 flex items-baseline justify-end gap-8 border-t border-hair-hot px-3 py-4">
        <span className="text-[11px] uppercase tracking-[2px] text-ink-faint">Total</span>
        <span className="font-disp text-[22px] font-medium tracking-wide text-ink">{formatDuration(data.totalMin)}</span>
        <span className="text-[11px] uppercase tracking-[2px] text-ink-faint">Amount</span>
        <span className="font-disp text-[22px] font-medium tracking-wide text-neon-yellow drop-shadow-[0_0_7px_rgba(252,238,10,.35)]">
          {amounts || formatMoney(0, "EUR")}
        </span>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => sfx.hover()}
      className={cn(
        "rounded-sm border px-3 py-1.5 text-[12px] uppercase tracking-wide transition",
        active ? "border-neon-cyan bg-neon-cyan font-medium text-bg shadow-glow-cyan" : "border-hair-hot text-ink-dim hover:border-neon-cyan hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[11px] uppercase tracking-[1.5px] text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
