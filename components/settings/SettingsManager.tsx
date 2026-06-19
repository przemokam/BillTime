"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { setWeekdayDefault, setSetting, setIssuerProfile } from "@/app/actions";
import { SUPPORTED_CURRENCIES } from "@/lib/format";
import type { IssuerProfile } from "@/lib/types";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/Select";
import { useSkin } from "@/components/shell/SkinShell";
import { SkinSwitcher } from "@/components/shell/SkinSwitcher";

const DAYS: { wd: number; label: string }[] = [
  { wd: 1, label: "Monday" },
  { wd: 2, label: "Tuesday" },
  { wd: 3, label: "Wednesday" },
  { wd: 4, label: "Thursday" },
  { wd: 5, label: "Friday" },
  { wd: 6, label: "Saturday" },
  { wd: 0, label: "Sunday" },
];

export function SettingsManager({
  weekday,
  defaultCurrency,
  issuer,
}: {
  weekday: Record<number, string>;
  defaultCurrency: string;
  issuer: IssuerProfile;
}) {
  const router = useRouter();
  const { skin, setSkin } = useSkin();
  const [, startT] = useTransition();
  const [editing, setEditing] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  const [form, setForm] = useState<IssuerProfile>(issuer);
  const [issuerSaved, setIssuerSaved] = useState(false);
  const setField = (k: keyof IssuerProfile) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    sfx.init();
    setSoundOn(sfx.isOn());
  }, []);

  const startEdit = (wd: number) => {
    setEditing(wd);
    setValue(weekday[wd] ?? "");
  };

  const saveRow = (wd: number) => {
    const v = value;
    startT(async () => {
      const res = await setWeekdayDefault(wd, v);
      if (res.ok) {
        sfx.confirm();
        setEditing(null);
        setSaved(wd);
        setTimeout(() => setSaved(null), 1200);
        router.refresh();
      } else {
        sfx.error();
      }
    });
  };

  const changeCurrency = (cur: string) => {
    startT(async () => {
      await setSetting("defaultCurrency", cur);
      sfx.click();
      router.refresh();
    });
  };

  const saveIssuer = () => {
    startT(async () => {
      const res = await setIssuerProfile(form);
      if (res.ok) {
        sfx.confirm();
        // reflect the server-side trim locally so inputs match what was stored
        setForm((f) => ({
          firstName: f.firstName.trim(),
          lastName: f.lastName.trim(),
          email: f.email.trim(),
          company: f.company.trim(),
          vat: f.vat.trim(),
          address: f.address.trim(),
          iban: f.iban.trim(),
        }));
        setIssuerSaved(true);
        setTimeout(() => setIssuerSaved(false), 1500);
        router.refresh();
      } else {
        sfx.error();
        router.refresh();
      }
    });
  };

  return (
    <div className="max-w-2xl">
      <h1 className="flex items-center gap-4 font-disp text-[16px] font-semibold uppercase tracking-[2.5px] text-ink">
        Settings
        <span className="h-px flex-1 bg-gradient-to-r from-hair-hot to-transparent" />
      </h1>

      {/* invoice issuer */}
      <section className="clip-tl mt-6 border border-hair-hot bg-elev p-6">
        <SectionLabel>Invoice issuer</SectionLabel>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">
          Shown at the top of every report and PDF, so the recipient sees who is billing.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <IssuerInput label="First name" value={form.firstName} onChange={setField("firstName")} placeholder="e.g. John" />
          <IssuerInput label="Last name" value={form.lastName} onChange={setField("lastName")} placeholder="e.g. Doe" />
          <IssuerInput label="Company" value={form.company} onChange={setField("company")} placeholder="e.g. Acme Studio" />
          <IssuerInput label="VAT number" value={form.vat} onChange={setField("vat")} placeholder="e.g. DE123456789" mono />
          <IssuerInput label="Email" value={form.email} onChange={setField("email")} placeholder="e.g. you@example.com" className="sm:col-span-2" />
          <IssuerInput label="Address" value={form.address} onChange={setField("address")} placeholder="Street, postal code, city, country" multiline className="sm:col-span-2" />
          <IssuerInput label="IBAN / bank account" value={form.iban} onChange={setField("iban")} placeholder="e.g. DE89 3704 0044 0532 0130 00" mono className="sm:col-span-2" />
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={saveIssuer}
            onMouseEnter={() => sfx.hover()}
            className="clip-sm border border-neon-green px-4 py-2 text-[12px] uppercase tracking-wide text-neon-green transition hover:bg-neon-green/10"
          >
            Save issuer
          </button>
          {issuerSaved && (
            <span className="flex items-center gap-1.5 text-[12px] text-neon-green">
              <Check size={14} /> Saved
            </span>
          )}
        </div>
      </section>

      {/* weekday defaults */}
      <section className="clip-tl mt-4 border border-hair-hot bg-elev p-6">
        <SectionLabel>Weekday defaults</SectionLabel>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">
          When you add a day, the description is prefilled with this text (cursor at the end, you append the rest).
        </p>
        <div className="mt-4 flex flex-col">
          {DAYS.map(({ wd, label }) => {
            const desc = weekday[wd] ?? "";
            const isEditing = editing === wd;
            return (
              <div key={wd} className="group flex items-center gap-4 border-b border-hair py-2.5">
                <span className="w-[110px] text-[14px] text-ink-dim">{label}</span>
                {isEditing ? (
                  <input
                    autoFocus
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRow(wd);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    placeholder="e.g. Consulting"
                    className="flex-1 border-b border-neon-cyan bg-transparent py-1 text-[14px] text-ink outline-none"
                  />
                ) : (
                  <button onClick={() => startEdit(wd)} className={cn("flex-1 text-left text-[14px]", desc ? "text-neon-green" : "text-ink-faint")}>
                    {desc || "—"}
                  </button>
                )}
                {saved === wd ? (
                  <Check size={15} className="text-neon-green" />
                ) : isEditing ? (
                  <div className="flex gap-1.5">
                    <button onClick={() => saveRow(wd)} className="text-neon-green" title="Save"><Check size={15} /></button>
                    <button onClick={() => setEditing(null)} className="text-ink-faint hover:text-neon-red" title="Cancel"><X size={15} /></button>
                  </div>
                ) : (
                  <button onClick={() => startEdit(wd)} onMouseEnter={() => sfx.hover()} className="text-ink-faint opacity-0 transition hover:text-neon-cyan group-hover:opacity-100" title="Edit">
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* currency */}
      <section className="clip-tl mt-4 border border-hair-hot bg-elev p-6">
        <SectionLabel>Currency</SectionLabel>
        <div className="mt-3 flex items-center gap-4">
          <span className="text-[14px] text-ink-dim">Default for new projects</span>
          <Select
            className="w-[130px]"
            value={defaultCurrency}
            onChange={changeCurrency}
            options={SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
        </div>
      </section>

      {/* appearance */}
      <section className="clip-tl mt-4 border border-hair-hot bg-elev p-6">
        <SectionLabel>Appearance</SectionLabel>
        <div className="mt-4 flex items-center gap-4">
          <span className="w-[120px] text-[14px] text-ink-dim">Skin / theme</span>
          <SkinSwitcher skin={skin} onChange={setSkin} showLabel={false} />
        </div>
        <div className="mt-4 flex items-center gap-4">
          <span className="w-[120px] text-[14px] text-ink-dim">Sound effects</span>
          <button
            onClick={() => { const v = !soundOn; sfx.setOn(v); setSoundOn(v); }}
            className={cn("flex items-center gap-2 rounded-sm border px-3 py-1 text-[12px] uppercase tracking-wide transition", soundOn ? "border-neon-green text-neon-green" : "border-hair-hot text-ink-dim")}
          >
            {soundOn ? "● On" : "○ Off"}
          </button>
        </div>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-3 w-[3px] bg-neon-yellow" />
      <span className="font-disp text-[11px] uppercase tracking-[2px] text-neon-yellow">{children}</span>
    </div>
  );
}

function IssuerInput({
  label,
  value,
  onChange,
  placeholder,
  mono,
  multiline,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  multiline?: boolean;
  className?: string;
}) {
  const cls = cn(
    "mt-1.5 w-full border-b border-hair-hot bg-transparent py-1.5 text-[15px] text-ink outline-none transition focus:border-neon-cyan",
    mono && "font-mono text-[14px]",
  );
  return (
    <label className={cn("block", className)}>
      <span className="text-[10px] uppercase tracking-[1.5px] text-ink-faint">{label}</span>
      {multiline ? (
        <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(cls, "resize-none leading-relaxed")} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </label>
  );
}
