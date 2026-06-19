"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, X, Building2 } from "lucide-react";
import { saveProject, deleteProject, saveCompany } from "@/app/actions";
import { formatMoney, SUPPORTED_CURRENCIES, type Currency } from "@/lib/format";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/Select";

type Project = {
  id: string;
  name: string;
  companyId: string | null;
  companyName: string | null;
  rateCents: number;
  currency: string;
  color: string | null;
  repoPathsJson: string | null;
  isArchived: boolean;
};
type Company = { id: string; name: string; projectCount: number };
type Draft = { id?: string; name: string; companyId: string; rate: string; currency: Currency; color: string; repoPaths: string; isArchived: boolean };

const COLORS = ["yellow", "cyan", "magenta", "green"];
const NEON: Record<string, string> = { yellow: "var(--yellow)", cyan: "var(--cyan)", magenta: "var(--magenta)", green: "var(--green)" };

const emptyDraft = (companyId = ""): Draft => ({ name: "", companyId, rate: "0", currency: "EUR", color: "cyan", repoPaths: "", isArchived: false });

export function ProjectsManager({ projects, companies }: { projects: Project[]; companies: Company[] }) {
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newCompany, setNewCompany] = useState("");

  const openNew = () => { setError(null); setDraft(emptyDraft(companies[0]?.id ?? "")); };
  const openEdit = (p: Project) => {
    setError(null);
    let repoPaths = "";
    if (p.repoPathsJson) {
      try { const arr = JSON.parse(p.repoPathsJson); if (Array.isArray(arr)) repoPaths = arr.join("\n"); } catch {}
    }
    setDraft({
      id: p.id,
      name: p.name,
      companyId: p.companyId ?? "",
      rate: (p.rateCents / 100).toString(),
      currency: (SUPPORTED_CURRENCIES as readonly string[]).includes(p.currency) ? (p.currency as Currency) : "EUR",
      color: p.color ?? "cyan",
      repoPaths,
      isArchived: p.isArchived,
    });
  };

  const submit = () => {
    if (!draft) return;
    startT(async () => {
      const res = await saveProject(draft);
      if (res.ok) { sfx.confirm(); setDraft(null); router.refresh(); }
      else { sfx.error(); setError(res.error ?? null); }
    });
  };
  const remove = (id: string) => startT(async () => {
    const res = await deleteProject(id);
    if (res.ok) { sfx.click(); router.refresh(); } else { sfx.error(); setError(res.error ?? null); }
  });
  const addCompany = () => {
    if (!newCompany.trim()) return;
    startT(async () => {
      const res = await saveCompany({ name: newCompany });
      if (res.ok) { sfx.confirm(); setNewCompany(""); router.refresh(); } else { sfx.error(); setError(res.error ?? null); }
    });
  };

  return (
    <div>
      <h1 className="flex items-center gap-4 font-disp text-[14px] font-medium uppercase tracking-[2.8px] text-ink">
        Projects
        <span className="h-px flex-1 bg-gradient-to-r from-hair-hot to-transparent" />
        <span className="text-[11px] tracking-[1.6px] text-ink-faint">{projects.filter((p) => !p.isArchived).length} ACTIVE</span>
        <button onClick={openNew} onMouseEnter={() => sfx.hover()} className="clip-sm flex items-center gap-2 border border-neon-yellow/60 px-4 py-2 text-[12px] uppercase tracking-wide text-neon-yellow transition hover:bg-neon-yellow/10 hover:shadow-glow-yellow">
          <Plus size={14} /> Project
        </button>
      </h1>

      {error && <div className="mt-3 text-[12px] text-neon-red">⚠ {error}</div>}

      {/* companies */}
      <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px] text-ink-dim">
        <Building2 size={14} className="text-ink-faint" />
        {companies.map((c) => (
          <span key={c.id} className="rounded-sm border border-hair px-2.5 py-1">
            {c.name} <span className="text-ink-faint">·{c.projectCount}</span>
          </span>
        ))}
        <input
          value={newCompany}
          onChange={(e) => setNewCompany(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCompany()}
          placeholder="+ new company"
          className="w-[130px] border-b border-hair-hot bg-transparent py-1 text-ink outline-none placeholder:text-ink-faint focus:border-neon-cyan"
        />
      </div>

      {/* project cards */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <div key={p.id} className={cn("clip-tl relative border bg-elev p-5 transition", p.isArchived ? "border-hair opacity-50" : "border-hair-hot")}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 font-disp text-[16px] text-ink">
                  <span style={{ color: NEON[p.color ?? "cyan"] ?? "var(--cyan)" }}>●</span>
                  {p.name}
                </div>
                <div className="mt-0.5 text-[12px] text-ink-dim">{p.companyName ?? "No company"}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(p)} onMouseEnter={() => sfx.hover()} className="text-ink-faint transition hover:text-neon-cyan"><Pencil size={14} /></button>
                <button onClick={() => remove(p.id)} onMouseEnter={() => sfx.hover()} className="text-ink-faint transition hover:text-neon-red"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-disp text-[22px] text-neon-yellow drop-shadow-[0_0_7px_rgba(252,238,10,.35)]">{formatMoney(p.rateCents, p.currency)}</span>
              <span className="text-[12px] text-ink-faint">/h</span>
              {p.isArchived && <span className="ml-auto text-[11px] uppercase tracking-wide text-ink-faint">archived</span>}
            </div>
            {p.repoPathsJson && (
              <div className="mt-2 truncate text-[11px] text-ink-faint" title={p.repoPathsJson}>
                ⌥ {safeRepoCount(p.repoPathsJson)} repos for CC suggestions
              </div>
            )}
          </div>
        ))}
      </div>

      {/* editor */}
      {draft && (
        <div className="mt-6 animate-rise">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-disp text-[12px] uppercase tracking-[2px] text-ink-dim">{draft.id ? "Edit Project" : "New Project"}</span>
            <button onClick={() => setDraft(null)} className="text-ink-faint hover:text-neon-red"><X size={15} /></button>
          </div>
          <div className="clip-tl flex flex-col gap-5 border border-hair-hot bg-elev p-6">
            <div className="flex flex-wrap gap-5">
              <Field label="Name" className="min-w-[220px] flex-1">
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Acme 06.2026" className="inp" autoFocus />
              </Field>
              <Field label="Company" className="min-w-[160px]">
                <Select
                  value={draft.companyId}
                  onChange={(v) => setDraft({ ...draft, companyId: v })}
                  options={[{ value: "", label: "No company" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
                />
              </Field>
              <Field label="Rate / h">
                <input value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} placeholder="45" className="inp w-[90px]" />
              </Field>
              <Field label="Currency">
                <Select
                  className="w-[110px]"
                  value={draft.currency}
                  onChange={(v) => setDraft({ ...draft, currency: v as Currency })}
                  options={SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))}
                />
              </Field>
              <Field label="Color">
                <div className="flex gap-2 py-1.5">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setDraft({ ...draft, color: c })} className={cn("h-5 w-5 rounded-full border-2 transition", draft.color === c ? "scale-125 border-white" : "border-transparent")} style={{ backgroundColor: NEON[c] }} />
                  ))}
                </div>
              </Field>
            </div>
            <Field label="Git repos (one per line) - for Claude Code description suggestions">
              <textarea value={draft.repoPaths} onChange={(e) => setDraft({ ...draft, repoPaths: e.target.value })} rows={2} placeholder="/Users/me/projects/acme-web" className="inp resize-y font-mono text-[13px]" />
            </Field>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-[12px] text-ink-dim">
                <input type="checkbox" checked={draft.isArchived} onChange={(e) => setDraft({ ...draft, isArchived: e.target.checked })} />
                Archived
              </label>
              <span className="flex-1" />
              <button disabled={pending} onClick={submit} onMouseEnter={() => sfx.hover()} className="clip-sm border border-neon-green px-5 py-2 font-disp text-[12px] uppercase tracking-wide text-neon-green transition hover:bg-neon-green/10 hover:shadow-[0_0_8px_rgba(52,255,174,.4)] disabled:opacity-40">
                {pending ? "..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.inp{background:transparent;border:none;border-bottom:1px solid var(--hair-hot);color:var(--ink);padding:5px 2px;outline:none;font-size:14px}.inp:focus{border-color:var(--cyan)}`}</style>
    </div>
  );
}

function safeRepoCount(json: string): number {
  try { const a = JSON.parse(json); return Array.isArray(a) ? a.length : 0; } catch { return 0; }
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[10px] uppercase tracking-[1.5px] text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
