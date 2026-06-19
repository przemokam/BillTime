"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

export function MonthPicker({ year, month, onPick }: { year: number; month: number; onPick: (y: number, m: number) => void }) {
  const [open, setOpen] = useState(false);
  const [vy, setVy] = useState(year);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setVy(year);
  }, [open, year]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          sfx.click();
          setOpen((o) => !o);
        }}
        onMouseEnter={() => sfx.hover()}
        className="font-disp text-[15px] tracking-[2px] text-neon-yellow transition hover:underline"
        title="Pick month / year"
      >
        {FULL[month - 1]} {year}
      </button>

      {open && (
        <div className="clip-sm absolute left-0 top-9 z-50 w-[256px] border border-hair-hot bg-elev-hi p-3 shadow-[0_10px_30px_rgba(0,0,0,.6)]">
          <div className="mb-2 flex items-center justify-between">
            <button onClick={() => setVy((v) => v - 1)} onMouseEnter={() => sfx.hover()} className="px-1 text-neon-cyan hover:scale-125">
              <ChevronLeft size={16} />
            </button>
            <span className="font-disp text-[15px] tracking-[2px] text-neon-yellow">{vy}</span>
            <button onClick={() => setVy((v) => v + 1)} onMouseEnter={() => sfx.hover()} className="px-1 text-neon-cyan hover:scale-125">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((m, i) => {
              const active = vy === year && i + 1 === month;
              return (
                <button
                  key={m}
                  onClick={() => {
                    sfx.click();
                    onPick(vy, i + 1);
                    setOpen(false);
                  }}
                  onMouseEnter={() => sfx.hover()}
                  className={cn(
                    "py-2 text-[12px] uppercase tracking-wide transition",
                    active ? "bg-neon-yellow font-semibold text-black" : "text-ink-dim hover:bg-white/[0.06] hover:text-ink",
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
