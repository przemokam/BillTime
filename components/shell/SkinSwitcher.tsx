"use client";

import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

const SKINS = [
  { id: "slab", label: "Slab" },
  { id: "terminal", label: "Terminal" },
] as const;

export function SkinSwitcher({ skin, onChange, onYellow }: { skin: string; onChange: (s: string) => void; onYellow?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className={cn("mr-1 text-[9px] uppercase tracking-[2px]", onYellow ? "text-black/50" : "text-ink-faint")}>skin</span>
      {SKINS.map((s) => {
        const active = skin === s.id;
        return (
          <button
            key={s.id}
            onClick={() => {
              sfx.click();
              onChange(s.id);
            }}
            onMouseEnter={() => sfx.hover()}
            className={cn(
              "clip-sm border px-2.5 py-1 text-[10px] uppercase tracking-[1.5px] transition",
              onYellow
                ? active
                  ? "border-black bg-black text-neon-yellow"
                  : "border-black/40 text-black/70 hover:border-black"
                : active
                  ? "border-neon-yellow bg-neon-yellow/10 text-neon-yellow"
                  : "border-hair-hot text-ink-faint hover:text-ink-dim",
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
