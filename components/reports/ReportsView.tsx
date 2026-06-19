"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Printer } from "lucide-react";
import type { ReportData } from "@/lib/reports";
import type { IssuerProfile } from "@/lib/types";
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
// print-safe (darkened) equivalents of the neon palette - readable on white paper
const PRINT_COLOR: Record<string, string> = { yellow: "#a07800", cyan: "#0099aa", magenta: "#c0005a", green: "#1f9d57" };
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
// printColor output is interpolated into a raw-HTML style attribute, so only
// emit a known token color or a strictly-validated hex (no injection).
const printColor = (c: string | null) => (c && (PRINT_COLOR[c] ?? (HEX_RE.test(c) ? c : null))) || "#555";
const PRESET_ORDER: RangePreset[] = ["today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "thisYear", "lastYear"];

const dayLabel = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return { d, mon: MONTHS_ABBR[m - 1], dow: DOWS[date.getDay()] };
};

// bold, print-legible style for the exported PDF (separate from the on-screen skin)
const PDF_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Tektur:wght@700;900&display=swap');
*,*::before,*::after{box-sizing:border-box}
body{font-family:'JetBrains Mono',ui-monospace,monospace;color:#111;margin:0;font-size:13px;line-height:1.55;font-variant-numeric:tabular-nums}
@page{margin:18mm 16mm;size:A4}
.issuer{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #111;margin-bottom:6px}
.issuer-name{font-family:'Tektur',sans-serif;font-size:21px;font-weight:900;line-height:1.05;margin-bottom:6px}
.issuer-meta{font-size:12px;color:#444;line-height:1.5}
.issuer-right{text-align:right}
.report-title{font-family:'Tektur',sans-serif;font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:1px}
.report-range{font-size:13px;color:#222;margin-top:4px}
.report-sub{font-size:11px;color:#666;margin-top:2px}
h2{font-family:'Tektur',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;border-top:3px solid #111;padding-top:8px;margin:22px 0 0}
table{width:100%;border-collapse:collapse;margin-top:8px}
th{text-align:left;border-bottom:2px solid #111;padding:7px 7px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#333;font-family:'Tektur',sans-serif;font-weight:700}
td{border-bottom:1px solid #ccc;padding:7px 7px;font-size:12.5px;vertical-align:top}
th.right,td.right{text-align:right}
td.nowrap{white-space:nowrap}
td.desc{max-width:200px;word-wrap:break-word;overflow-wrap:anywhere}
tr{page-break-inside:avoid}
tr.total td{border-top:2px solid #111;border-bottom:2px solid #111;font-family:'Tektur',sans-serif;font-weight:900;font-size:13px;padding-top:9px;padding-bottom:9px}
tr.total td.amount{font-size:15px}
.proj-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}
@media print{a{color:inherit;text-decoration:none}}
`;

export function ReportsView({
  mode,
  preset,
  start,
  end,
  projectId,
  data,
  projects,
  issuer,
}: {
  mode: "summary" | "detailed";
  preset: string;
  start: string;
  end: string;
  projectId: string | null;
  data: ReportData;
  projects: ProjectOpt[];
  issuer: IssuerProfile;
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
  const issuerName = `${issuer.firstName} ${issuer.lastName}`.trim();
  const hasIssuer = !!(issuerName || issuer.company || issuer.vat || issuer.email || issuer.address || issuer.iban);
  const projectLabel = projectId ? projects.find((p) => p.id === projectId)?.name ?? "" : "All projects";

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
    const addrHtml = issuer.address ? esc(issuer.address).replace(/\n/g, "<br>") : "";
    const issuerLeft = hasIssuer
      ? `<div>
          ${issuerName ? `<div class="issuer-name">${esc(issuerName)}</div>` : `<div class="issuer-name">Time Report</div>`}
          ${issuer.company ? `<div class="issuer-meta">${esc(issuer.company)}</div>` : ""}
          ${addrHtml ? `<div class="issuer-meta">${addrHtml}</div>` : ""}
          ${issuer.vat ? `<div class="issuer-meta">VAT: ${esc(issuer.vat)}</div>` : ""}
          ${issuer.iban ? `<div class="issuer-meta">IBAN: ${esc(issuer.iban)}</div>` : ""}
          ${issuer.email ? `<div class="issuer-meta">${esc(issuer.email)}</div>` : ""}
        </div>`
      : `<div><div class="issuer-name">Time Report</div></div>`;
    const header = `<div class="issuer">
        ${issuerLeft}
        <div class="issuer-right">
          ${hasIssuer ? `<div class="report-title">Time Report</div>` : ""}
          <div class="report-range">${esc(rangeLabel(start, end))}</div>
          <div class="report-sub">${esc(projectLabel)} &middot; ${data.entryCount} entries</div>
        </div>
      </div>`;
    const rows = data.rows
      .map((r) =>
        `<tr>
          <td class="nowrap">${esc(r.date)}</td>
          <td><span class="proj-dot" style="background:${printColor(r.projectColor)}"></span>${esc(r.projectName)}</td>
          <td>${esc(r.companyName ?? "")}</td>
          <td class="desc">${esc(r.description)}</td>
          <td class="nowrap">${formatTimeOfDay(r.startMin)}</td>
          <td class="nowrap">${formatTimeOfDay(r.endMin)}</td>
          <td class="right nowrap">${formatDuration(r.durationMin)}</td>
          <td class="right nowrap">${esc(formatMoney(r.amountCents, r.currency))}</td>
        </tr>`,
      )
      .join("");
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>BillTime ${esc(rangeLabel(start, end))}</title>
      <style>${PDF_STYLE}</style></head><body>
      ${header}
      <h2>Time Entries</h2>
      <table>
        <thead><tr>
          <th>Date</th><th>Project</th><th>Company</th><th>Description</th>
          <th>From</th><th>To</th><th class="right">Hours</th><th class="right">Amount</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr class="total">
          <td colspan="6">Total &middot; ${data.entryCount} entries</td>
          <td class="right">${formatDuration(data.totalMin)}</td>
          <td class="right amount">${esc(amounts)}</td>
        </tr></tfoot>
      </table>
      </body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const w = window.open(url, "_blank");
    if (w)
      w.addEventListener("load", () => {
        const go = () => { w.focus(); w.print(); URL.revokeObjectURL(url); };
        const d = w.document;
        if (d.fonts && d.fonts.ready) d.fonts.ready.then(go).catch(go);
        else go();
      });
    // fallback if the load event never fires (e.g. popup blocked)
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  };

  return (
    <div>
      {hasIssuer && (
        <IssuerHeader
          name={issuerName}
          company={issuer.company}
          vat={issuer.vat}
          email={issuer.email}
          address={issuer.address}
          iban={issuer.iban}
          range={rangeLabel(start, end)}
        />
      )}

      <h1 className="flex items-center gap-4 font-disp text-[16px] font-semibold uppercase tracking-[2.5px] text-ink">
        Reports
        <span className="h-px flex-1 bg-gradient-to-r from-hair-hot to-transparent" />
        <span className="font-mono text-[12px] tracking-[1.6px] text-ink-dim">{rangeLabel(start, end)}</span>
      </h1>

      {/* mode tabs */}
      <div className="mt-5 flex gap-1">
        {(["summary", "detailed"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { sfx.click(); nav({ mode: m }); }}
            onMouseEnter={() => sfx.hover()}
            className={cn(
              "border-l-2 px-4 py-2 font-disp text-[13px] uppercase tracking-[2px] transition",
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
        <div className="clip-tl mt-6 border border-hair-hot bg-elev p-12 text-center text-[15px] text-ink-faint">No data for this range.</div>
      ) : mode === "summary" ? (
        <Summary data={data} amounts={amounts} />
      ) : (
        <Detailed data={data} amounts={amounts} />
      )}
    </div>
  );
}

/** Light section header: a thin VIVID-yellow line + tick + title (same yellow as the top bar). */
function SectionBand({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-neon-yellow/55 px-5 py-3">
      <span className="h-3 w-[3px] bg-neon-yellow" />
      <span className="font-disp text-[12px] uppercase tracking-[2.5px] text-neon-yellow">{title}</span>
      {right ? <span className="ml-auto font-mono text-[10px] uppercase tracking-[1.5px] text-ink-faint">{right}</span> : null}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("clip-tl border border-hair-hot bg-elev", className)}>{children}</div>;
}

function IssuerHeader({ name, company, vat, email, address, iban, range }: { name: string; company: string; vat: string; email: string; address: string; iban: string; range: string }) {
  return (
    <Card className="mb-6">
      <SectionBand title="Invoice issuer" right={`Report // ${range}`} />
      <div className="grid grid-cols-1 gap-x-10 gap-y-3 px-5 py-4 sm:grid-cols-2">
        {name && (
          <div className="sm:col-span-2">
            <div className="text-[10px] uppercase tracking-[1.5px] text-ink-faint">Name</div>
            <div className="font-disp text-[20px] font-semibold leading-tight text-ink">{name}</div>
          </div>
        )}
        {company && <Field label="Company" value={company} />}
        {vat && <Field label="VAT" value={vat} mono />}
        {address && <Field label="Address" value={address} />}
        {iban && <Field label="IBAN" value={iban} mono />}
        {email && <Field label="Email" value={email} accent />}
      </div>
    </Card>
  );
}

function Field({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[1.5px] text-ink-faint">{label}</div>
      <div className={cn("whitespace-pre-line text-[15px]", mono && "font-mono text-[14px]", accent ? "text-neon-cyan" : "text-ink")}>{value}</div>
    </div>
  );
}

function Summary({ data, amounts }: { data: ReportData; amounts: string }) {
  const maxDay = Math.max(1, ...data.byDay.map((d) => d.durationMin));
  const step = Math.max(1, Math.ceil(data.byDay.length / 8));
  const totalMin = data.totalMin || 1;

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* bar chart */}
        <Card>
          <SectionBand title="Hours / day" />
          <div className="p-5">
            <div className="flex h-[180px] items-end gap-[3px]">
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
                      style={{ height: `${(s.durationMin / d.durationMin) * 100}%`, backgroundColor: colorOf(s.color), opacity: 0.85 }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-[3px]">
              {data.byDay.map((d, i) => (
                <div key={d.date} className="flex-1 text-center text-[11px] text-ink-dim">
                  {i % step === 0 ? `${dayLabel(d.date).d} ${dayLabel(d.date).mon}` : ""}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* breakdown by project */}
        <Card>
          <SectionBand title="By project" />
          <div className="flex flex-col gap-3 p-5">
            {data.byProject.map((p) => {
              const pct = Math.round((p.durationMin / totalMin) * 100);
              return (
                <div key={p.projectId}>
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="flex items-center gap-2 text-ink-dim">
                      <span style={{ color: colorOf(p.color) }}>●</span> {p.name}
                    </span>
                    <span className="text-ink">{formatDuration(p.durationMin)} · {pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full bg-white/[0.05]">
                    <div className="h-full" style={{ width: `${pct}%`, backgroundColor: colorOf(p.color), opacity: 0.85 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* grouped totals table */}
      <Card>
        <SectionBand title="Totals by project" />
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className="[&>th]:border-b [&>th]:border-hair-hot [&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:text-[13px] [&>th]:font-normal [&>th]:uppercase [&>th]:tracking-[1.2px] [&>th]:text-ink-dim">
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
            <tr className="border-t border-neon-yellow/40 bg-elev-hi/60 font-disp uppercase">
              <td className="px-4 py-3 text-[14px] tracking-[1.8px] text-ink-dim">Total</td>
              <td className="px-4 text-right text-[14px] text-ink-dim">{data.entryCount}</td>
              <td className="px-4 text-right text-[15px] text-ink">{formatDuration(data.totalMin)}</td>
              <td className="px-4 text-right text-[16px] text-neon-yellow">{amounts}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
}

function Detailed({ data, amounts }: { data: ReportData; amounts: string }) {
  return (
    <Card className="mt-6">
      <SectionBand title="Time entries" right={`${data.entryCount} entries`} />
      <table className="w-full border-collapse text-[15px]">
        <thead className="sticky top-0 z-10 bg-panel">
          <tr className="[&>th]:border-b [&>th]:border-hair-hot [&>th]:px-3 [&>th]:py-3 [&>th]:text-left [&>th]:text-[13px] [&>th]:font-normal [&>th]:uppercase [&>th]:tracking-[1.2px] [&>th]:text-ink-dim">
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
                <td className="px-3 py-[13px] text-neon-cyan">{l.d} {l.mon}<span className="ml-1.5 text-[12px] text-ink-dim">{l.dow}</span></td>
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
          <tr className="border-t border-neon-yellow/40 bg-elev-hi/60 font-disp uppercase">
            <td className="px-3 py-3 text-[14px] tracking-[1.8px] text-ink-dim" colSpan={5}>Total · <span className="text-neon-yellow">{amounts}</span></td>
            <td className="px-3 py-3 text-right text-[15px] text-ink">{formatDuration(data.totalMin)}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
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
