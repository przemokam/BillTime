"use client";

import { useEffect, useState } from "react";
import { ShellSlab } from "./ShellSlab";
import { ShellTerminal } from "./ShellTerminal";
import type { TimerProps } from "./TimerHud";
import { setSetting } from "@/app/actions";

type ProjectOpt = { id: string; name: string };

export function SkinShell({
  initialSkin,
  projects,
  timer,
  children,
}: {
  initialSkin: string;
  projects: ProjectOpt[];
  timer: TimerProps;
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
    <Shell projects={projects} timer={timer} skin={skin} onSkin={change}>
      {children}
    </Shell>
  );
}
