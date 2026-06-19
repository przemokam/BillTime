"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/log", label: "Log" },
  { href: "/projects", label: "Projects" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ variant = "horizontal" }: { variant?: "horizontal" | "sidebar" }) {
  const pathname = usePathname();
  const isOn = (href: string) => pathname === href || pathname.startsWith(href + "/");

  if (variant === "sidebar") {
    return (
      <nav className="flex flex-col gap-1">
        {ITEMS.map((it) => {
          const on = isOn(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              onMouseEnter={() => sfx.hover()}
              onClick={() => sfx.click()}
              className={cn(
                "flex items-center gap-3 border-l-2 px-3 py-2.5 font-disp text-[14px] uppercase tracking-[2px] transition-all",
                on
                  ? "border-neon-yellow bg-gradient-to-r from-neon-yellow/[0.08] to-transparent text-neon-yellow"
                  : "border-transparent text-ink-dim hover:border-hair-hot hover:pl-4 hover:text-ink",
              )}
            >
              <span className={cn("w-[10px]", on ? "text-neon-yellow" : "text-ink-faint")}>{on ? "▸" : "·"}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex gap-2">
      {ITEMS.map((it) => {
        const on = isOn(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            onMouseEnter={() => sfx.hover()}
            onClick={() => sfx.click()}
            className={cn(
              "px-5 py-2 font-disp text-[14px] font-semibold uppercase tracking-[2px] transition",
              on ? "clip-tab bg-neon-yellow text-black" : "border border-hair-hot text-ink-dim hover:border-neon-yellow hover:text-ink",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
