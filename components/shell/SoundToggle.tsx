"use client";

import { useEffect, useState } from "react";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

export function SoundToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    sfx.init();
    setOn(sfx.isOn());
  }, []);

  return (
    <button
      onClick={() => {
        const v = !on;
        sfx.setOn(v);
        setOn(v);
      }}
      title="Dzwiek on/off"
      className={cn("cursor-pointer transition-colors hover:text-neon-green", on ? "text-ink-dim" : "text-ink-faint")}
    >
      {on ? "🔊" : "🔇"} snd
    </button>
  );
}
