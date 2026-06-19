"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

export function RowMenu({
  onEdit,
  onDuplicate,
  onDelete,
}: {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        onClick={() => {
          sfx.click();
          setOpen((o) => !o);
        }}
        onMouseEnter={() => sfx.hover()}
        title="Actions"
        className={cn(
          "grid h-8 w-8 place-items-center rounded-sm text-ink-faint transition hover:text-neon-cyan",
          open ? "text-neon-cyan opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="clip-sm absolute right-0 top-9 z-30 w-44 border border-hair-hot bg-elev-hi py-1 shadow-[0_8px_24px_rgba(0,0,0,.5)]">
          <Item icon={<Pencil size={14} />} label="Edit" onClick={() => { setOpen(false); onEdit(); }} />
          <Item icon={<Copy size={14} />} label="Duplicate" onClick={() => { setOpen(false); sfx.confirm(); onDuplicate(); }} />
          <Item icon={<Trash2 size={14} />} label="Delete" danger onClick={() => { setOpen(false); onDelete(); }} />
        </div>
      )}
    </div>
  );
}

function Item({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => sfx.hover()}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] text-ink transition hover:bg-white/[0.04]",
        danger && "hover:text-neon-red",
      )}
    >
      <span className="text-ink-faint">{icon}</span>
      {label}
    </button>
  );
}
