"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ShellSlab } from "./ShellSlab";
import { ShellTerminal } from "./ShellTerminal";
import type { TimerProps } from "./TimerHud";
import { setSetting } from "@/app/actions";

type ProjectOpt = { id: string; name: string };

type SkinContextValue = { skin: string; setSkin: (s: string) => void };
const SkinContext = createContext<SkinContextValue | null>(null);

/** Read + change the active skin from anywhere inside the shell (e.g. Settings). */
export function useSkin(): SkinContextValue {
  const ctx = useContext(SkinContext);
  if (!ctx) throw new Error("useSkin must be used within <SkinShell>");
  return ctx;
}

export function SkinShell({
  initialSkin,
  projects,
  timer,
  ccAvailable,
  children,
}: {
  initialSkin: string;
  projects: ProjectOpt[];
  timer: TimerProps;
  ccAvailable: boolean;
  children: React.ReactNode;
}) {
  const [skin, setSkin] = useState(initialSkin === "terminal" ? "terminal" : "slab");

  useEffect(() => {
    document.documentElement.dataset.skin = skin;
  }, [skin]);

  const change = (s: string) => {
    setSkin(s);
    document.documentElement.dataset.skin = s;
    void setSetting("skin", s);
  };

  const Shell = skin === "terminal" ? ShellTerminal : ShellSlab;
  return (
    <SkinContext.Provider value={{ skin, setSkin: change }}>
      <Shell projects={projects} timer={timer} ccAvailable={ccAvailable}>
        {children}
      </Shell>
    </SkinContext.Provider>
  );
}
