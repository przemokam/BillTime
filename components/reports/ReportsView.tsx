"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Printer } from "lucide-react";
import type { ReportData } from "@/lib/reports";
import { formatDuration, formatTimeOfDay } from "@/lib/parse/time";
import { formatMoney } from "@/lib/format";
import { PRESET_LABELS, rangeLabel, type RangePreset } from "@/lib/dates";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/Select";

type ProjectOpt = { id: string; name: string; color: string | null };

const MONTHS_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOWS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const NEON: Record<string, string> = { yellow: "var(--yellow)", cyan: "var(--cyan)", magenta: "var(--magenta)", green: "var(--green)" };
const colorOf = (c: string | null) => (c && (NEON[c] ?? (c.startsWith("#") ? c : null))) || "var(--cyan)";
const PRESET_ORDER: RangePreset[] = ["today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "thisYear", "lastYear"];

const dayLabel = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return { d, mon: MONTHS_ABBR[m - 1], dow: DOWS[date.getDay()] };
};

export function ReportsView({
  mode,
  preset,
  start,
  end,
  projectId,
  data,
  projects,
}: {
  mode: "summary" | "detailed";
  preset: string;
  start: string;
  end: string;
  projectId: string | null;
  data: ReportData;
  projects: ProjectOpt[];
}) {
  const router = useRouter();
  const [customStart, setCustomStart] = useState(start);
  const [customEnd, setCustomEnd] = useState(end);

  const nav = (params: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const base: Record<string, string | null> = { mode, preset: preset === "custom" ? null : preset, start: preset === "custom" ? start : null, end: preset === "custom" ? end : null, project: projectId, ...params };
    for (const [k, v] of Object.entries(base)) if (v) q.set(k, v);
    router.push(`/reports?${q.toString()}`);
  };

  const onPreset = (value: string) => {
    sfx.click();
    if (value === "custom") nav({ preset: null, start: customStart, end: customEnd });
    else nav({ preset: value, start: null, end: null });
  };
  const applyCustom = () => {
    sfx.confirm();
    nav({ preset: null, start: customStart, end: customEnd });
  };

  const amounts = Object.entries(data.amountByCurrency).map(([c, cents]) => formatMoney(cents, c)).join("  ·  ");

  // ---- exports ----
  const filenameBase = `billtime_${start}_${end}`;
  const exportCsv = () => {
    sfx.click();
    const head = ["Date", "Project", "Company", "Description", "From", "To", "Hours", "Amount"];
    const lines = data.rows.map((r) =>
      [r.date, r.projectName, r.companyName ?? "", r.description.replace(/"/g, '""'), formatTimeOfDay(r.startMin), formatTimeOfDay(r.endMin), (r.durationMin / 60).toFixed(2), (r.amountCents / 100).toFixed(2)]
        .map((c) => `"${c}"`)
        .join(","),
    );
    const csv = [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filenameBase}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportPdf = () => {
    sfx.click();
    const rows = data.rows
      .map((r) => `<tr><td>${r.date}</td><td>${esc(r.projectName)}</td><td>${esc(r.description)}</td><td>${formatTimeOfDay(r.startMin)}</td><td>${formatTimeOfDay(r.endMin)}</td><td style="text-align:right">${formatDuration(r.durationMin)}</td></tr>`)
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>BillTime ${rangeLabel(start, end)}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:40px;font-size:12px}
        h1{font-size:18px;margin:0 0 4px} .sub{color:#666;margin-bottom:20px}
        table{width:100%;border-collapse:collapse} th{text-align:left;border-bottom:2px solid #111;padding:6px 8px;font-size:11px;text-transform:uppercase;color:#444}
        td{border-bottom:1px solid #ddd;padding:6px 8px} tfoot td{border-top:2px solid #111;font-weight:bold;border-bottom:none;padding-top:10px}
      </style></head><body>
      <h1>Time report - ${rangeLabel(start, end)}</h1>
      <div class="sub">${projectId ? esc(projects.find((p) => p.id === projectId)?.name ?? "") : "All projects"} &middot; ${data.entryCount} entries</div>
      <table><thead><tr><th>Date</th><th>Project</th><th>Description</th><th>From</th><th>To</th><th style="text-align:right">Hours</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="5">Total &middot; ${amounts}</td><td style="text-align:right">${formatDuration(data.totalMin)}</td></tr></tfoot></table>
      </body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const w = window.open(url, "_blank");
    if (w) w.addEventListener("load", () => { w.focus(); w.print(); });
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div>
      <h1 className="flex items-center gap-4 font-disp text-[14px] font-medium uppercase tracking-[2.8px] text-ink">
        Reports
        <span className="h-px flex-1 bg-gradient-to-r from-hair-hot to-transparent" />
        <span className="text-[11px] tracking-[1.6px] text-ink-faint">{rangeLabel(start, end)}</span>
      </h1>

      {/* mode tabs */}
      <div className="mt-5 flex gap-1">
        {(["summary", "detailed"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { sfx.click(); nav({ mode: m }); }}
            onMouseEnter={() => sfx.hover()}
            className={cn(
              "border-l-2 px-4 py-2 font-disp text-[12px] uppercase tracking-[2px] transition",
              mode === m ? "border-neon-yellow text-neon-yellow" : "border-transparent text-ink-dim hover:text-ink",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* filter bar */}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-b border-hair-hot pb-4">
        <Select
          box
          className="w-[180px]"
          value={preset === "custom" ? "custom" : preset}
          onChange={onPreset}
          options={[...PRESET_ORDER.map((p) => ({ value: p, label: PRESET_LABELS[p] })), { value: "custom", label: "Custom range" }]}
        />

        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="border-b border-hair-hot bg-transparent py-1 text-[14px] text-neon-cyan outline-none [color-scheme:dark]" />
            <span className="text-ink-faint">→</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="border-b border-hair-hot bg-transparent py-1 text-[14px] text-neon-cyan outline-none [color-scheme:dark]" />
            <button onClick={applyCustom} className="clip-sm border border-neon-green px-3 py-1.5 text-[12px] uppercase tracking-wide text-neon-green transition hover:bg-neon-green/10">Apply</button>
          </div>
        )}

        <span className="mx-1 h-4 w-px bg-hair-hot" />

        <Chip active={!projectId} onClick={() => nav({ project: null })}>All projects</Chip>
        {projects.map((p) => (
          <Chip key={p.id} active={projectId === p.id} onClick={() => nav({ project: p.id })}>
            <span style={{ color: projectId === p.id ? "var(--bg)" : colorOf(p.color) }}>●</span> {p.name}
          </Chip>
        ))}

        <span className="flex-1" />

        <button onClick={exportCsv} onMouseEnter={() => sfx.hover()} className="clip-sm flex items-center gap-2 border border-hair-hot px-3 py-2 text-[12px] uppercase tracking-wide text-ink-dim transition hover:border-neon-cyan hover:text-neon-cyan">
          <Download size={14} /> CSV
        </button>
        <button onClick={exportPdf} onMouseEnter={() => sfx.hover()} className="clip-sm flex items-center gap-2 border border-hair-hot px-3 py-2 text-[12px] uppercase tracking-wide text-ink-dim transition hover:border-neon-cyan hover:text-neon-cyan">
          <Printer size={14} /> PDF
        </button>
      </div>

      {data.entryCount === 0 ? (
        <div className="clip-tl mt-6 border border-hair-hot bg-elev p-12 text-center text-[14px] text-ink-faint">No data for this range.</div>
      ) : mode === "summary" ? (
        <Summary data={data} amounts={amounts} />
      ) : (
        <Detailed data={data} amounts={amounts} />
      )}
    </div>
  );
}

function Summary({ data, amounts }: { data: ReportData; amounts: string }) {
  const maxDay = Math.max(1, ...data.byDay.map((d) => d.durationMin));
  const step = Math.max(1, Math.ceil(data.byDay.length / 8));
  const totalMin = data.totalMin || 1;

  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* bar chart */}
        <div className="clip-tl border border-hair-hot bg-elev p-5">
          <div className="text-[10px] uppercase tracking-[2px] text-ink-faint">Hours / day</div>
          <div className="mt-5 flex h-[180px] items-end gap-[3px]">
            {data.byDay.map((d) => (
              <div
                key={d.date}
                className="group flex flex-1 flex-col-reverse overflow-hidden rounded-[1px]"
                style={{ height: `${maxDay ? (d.durationMin / maxDay) * 100 : 0}%`, minHeight: d.durationMin > 0 ? 3 : 0 }}
                title={`${d.date} · ${formatDuration(d.durationMin)}`}
              >
                {d.segments.map((s, i) => (
                  <div
                    key={i}
                    className="transition group-hover:opacity-100"
                    style={{ height: `${(s.durationMin / d.durationMin) * 100}%`, backgroundColor: colorOf(s.color), opacity: 0.82 }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-[3px]">
            {data.byDay.map((d, i) => (
              <div key={d.date} className="flex-1 text-center text-[9px] text-ink-faint">
                {i % step === 0 ? `${dayLabel(d.date).d} ${dayLabel(d.date).mon}` : ""}
              </div>
            ))}
          </div>
        </div>

        {/* breakdown by project */}
        <div className="clip-tl border border-hair-hot bg-elev p-5">
          <div className="text-[10px] uppercase tracking-[2px] text-ink-faint">By project</div>
          <div className="mt-5 flex flex-col gap-3">
            {data.byProject.map((p) => {
              const pct = Math.round((p.durationMin / totalMin) * 100);
              return (
                <div key={p.projectId}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2 text-ink-dim">
                      <span style={{ color: colorOf(p.color) }}>●</span> {p.name}
                    </span>
                    <span className="text-ink">{formatDuration(p.durationMin)} · {pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full bg-white/[0.05]">
                    <div className="h-full" style={{ width: `${pct}%`, backgroundColor: colorOf(p.color), opacity: 0.7 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* grouped totals table */}
      <table className="mt-4 w-full border-collapse text-[14px]">
        <thead>
          <tr className="[&>th]:border-b [&>th]:border-hair-hot [&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:text-[12px] [&>th]:font-normal [&>th]:uppercase [&>th]:tracking-[1.6px] [&>th]:text-ink-faint">
            <th>Project / Group</th>
            <th className="w-[100px] text-right">Entries</th>
            <th className="w-[120px] text-right">Hours</th>
            <th className="w-[160px] text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.byProject.map((p) => (
            <tr key={p.projectId} className="border-b border-hair">
              <td className="px-4 py-[13px]">
                <span className="border-l-[3px] pl-2.5 text-ink" style={{ borderColor: colorOf(p.color) }}>{p.companyName ?? p.name}</span>
              </td>
              <td className="px-4 text-right text-ink-dim">{p.entries}</td>
              <td className="px-4 text-right text-ink">{formatDuration(p.durationMin)}</td>
              <td className="px-4 text-right text-ink">{formatMoney(p.amountCents, p.currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-elev-hi font-disp uppercase">
            <td className="px-4 py-3 text-[12px] tracking-[2px] text-ink">Total</td>
            <td className="px-4 text-right text-ink-dim">{data.entryCount}</td>
            <td className="px-4 text-right text-ink">{formatDuration(data.totalMin)}</td>
            <td className="px-4 text-right text-neon-yellow drop-shadow-[0_0_7px_rgba(252,238,10,.35)]">{amounts}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Detailed({ data, amounts }: { data: ReportData; amounts: string }) {
  return (
    <table className="mt-6 w-full border-collapse text-[14px]">
      <thead className="sticky top-0 z-10 bg-panel">
        <tr className="[&>th]:border-b [&>th]:border-hair-hot [&>th]:px-3 [&>th]:py-3 [&>th]:text-left [&>th]:text-[12px] [&>th]:font-normal [&>th]:uppercase [&>th]:tracking-[1.6px] [&>th]:text-ink-faint">
          <th className="w-[120px]">Date</th>
          <th className="w-[160px]">Project</th>
          <th>Description</th>
          <th className="w-[68px]">From</th>
          <th className="w-[68px]">To</th>
          <th className="w-[92px] text-right">Hours</th>
        </tr>
      </thead>
      <tbody>
        {data.rows.map((r) => {
          const l = dayLabel(r.date);
          return (
            <tr key={r.id} className="border-b border-hair transition hover:bg-elev-hi">
              <td className="px-3 py-[13px] text-neon-cyan">{l.d} {l.mon}<span className="ml-1.5 text-[11px] text-ink-faint">{l.dow}</span></td>
              <td className="px-3"><span className="border-l-[3px] pl-2.5 text-ink" style={{ borderColor: colorOf(r.projectColor) }}>{r.companyName ?? r.projectName}</span></td>
              <td className="px-3 text-ink">{r.description}</td>
              <td className="px-3 text-ink-dim">{formatTimeOfDay(r.startMin)}</td>
              <td className="px-3 text-ink-dim">{formatTimeOfDay(r.endMin)}</td>
              <td className="px-3 text-right text-ink">{formatDuration(r.durationMin)}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="bg-elev-hi font-disp uppercase">
          <td className="px-3 py-3 text-[12px] tracking-[2px] text-ink" colSpan={5}>Total · {amounts}</td>
          <td className="px-3 py-3 text-right text-neon-yellow drop-shadow-[0_0_7px_rgba(252,238,10,.35)]">{formatDuration(data.totalMin)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => sfx.hover()}
      className={cn("rounded-sm border px-3 py-1.5 text-[12px] uppercase tracking-wide transition", active ? "border-neon-cyan bg-neon-cyan font-medium text-bg shadow-glow-cyan" : "border-hair-hot text-ink-dim hover:border-neon-cyan hover:text-ink")}
    >
      {children}
    </button>
  );
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
