"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: React.ReactNode };

/**
 * Themed dropdown. The menu renders in a portal (position: fixed) so it is never
 * clipped by an ancestor clip-path / overflow (composer notch, yellow slab, ...).
 */
export function Select({
  value,
  options,
  onChange,
  box,
  className,
  placeholder,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  box?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onScroll = () => place();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          sfx.click();
          place();
          setOpen((o) => !o);
        }}
        onMouseEnter={() => sfx.hover()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") e.stopPropagation();
          if (e.key === "Escape") setOpen(false);
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 text-left text-[15px] text-ink outline-none transition",
          box ? "clip-sm border border-hair-hot bg-elev px-3 py-2 hover:border-neon-yellow" : "border-b border-hair-hot bg-transparent py-1",
          open && "border-neon-yellow",
        )}
      >
        <span className="truncate">
          {current?.label ?? <span className="text-ink-faint">{placeholder ?? "Select"}</span>}
        </span>
        <ChevronDown size={15} className={cn("shrink-0 text-ink-faint transition", open && "rotate-180 text-neon-yellow")} />
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: pos.width }}
            className="clip-sm z-[80] max-h-72 overflow-auto border border-hair-hot bg-elev-hi py-1 shadow-[0_10px_30px_rgba(0,0,0,.6)]"
          >
            {options.length === 0 && <div className="px-3 py-2 text-[14px] text-ink-faint">{placeholder ?? "No options"}</div>}
            {options.map((o) => {
              const sel = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    sfx.click();
                    onChange(o.value);
                    setOpen(false);
                  }}
                  onMouseEnter={() => sfx.hover()}
                  className={cn(
                    "flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-[14px] transition hover:bg-white/[0.05]",
                    sel ? "text-neon-yellow" : "text-ink",
                  )}
                >
                  <span className="w-4 shrink-0">{sel && <Check size={14} />}</span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
