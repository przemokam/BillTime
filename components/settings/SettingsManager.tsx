"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { setWeekdayDefault, setSetting } from "@/app/actions";
import { SUPPORTED_CURRENCIES } from "@/lib/format";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/Select";

const DAYS: { wd: number; label: string }[] = [
  { wd: 1, label: "Monday" },
  { wd: 2, label: "Tuesday" },
  { wd: 3, label: "Wednesday" },
  { wd: 4, label: "Thursday" },
  { wd: 5, label: "Friday" },
  { wd: 6, label: "Saturday" },
  { wd: 0, label: "Sunday" },
];

export function SettingsManager({ weekday, defaultCurrency }: { weekday: Record<number, string>; defaultCurrency: string }) {
  const router = useRouter();
  const [, startT] = useTransition();
  const [editing, setEditing] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(true);

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

  return (
    <div className="max-w-2xl">
      <h1 className="flex items-center gap-4 font-disp text-[14px] font-medium uppercase tracking-[2.8px] text-ink">
        Settings
        <span className="h-px flex-1 bg-gradient-to-r from-hair-hot to-transparent" />
      </h1>

      {/* weekday defaults */}
      <section className="clip-tl mt-6 border border-hair-hot bg-elev p-6">
        <div className="text-[10px] uppercase tracking-[2px] text-ink-faint">Weekday defaults</div>
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
        <div className="text-[10px] uppercase tracking-[2px] text-ink-faint">Currency</div>
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
        <div className="text-[10px] uppercase tracking-[2px] text-ink-faint">Appearance</div>
        <div className="mt-3 flex items-center gap-4">
          <span className="text-[14px] text-ink-dim">Sound effects</span>
          <button
            onClick={() => { const v = !soundOn; sfx.setOn(v); setSoundOn(v); }}
            className={cn("flex items-center gap-2 rounded-sm border px-3 py-1 text-[12px] uppercase tracking-wide transition", soundOn ? "border-neon-green text-neon-green" : "border-hair-hot text-ink-faint")}
          >
            {soundOn ? "● On" : "○ Off"}
          </button>
        </div>
      </section>
    </div>
  );
}
