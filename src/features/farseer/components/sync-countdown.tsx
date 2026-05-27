"use client";

import { useState, useEffect } from "react";
import { getNextSyncTime, formatCountdown } from "@/features/farseer/utilities";

export function SyncCountdown() {
  const [msLeft, setMsLeft] = useState<number>(() =>
    getNextSyncTime().getTime() - Date.now()
  );

  useEffect(() => {
    const tick = () => setMsLeft(getNextSyncTime().getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const isImminent = msLeft < 5 * 60 * 1000;

  return (
    <div
      className="pixel-box-inset flex items-center justify-between px-4 py-3"
      style={{ background: "rgba(0,0,0,0.25)", border: "2px solid rgba(255,255,255,0.15)" }}
    >
      <p className="font-pixel text-[7px] text-white/40 tracking-widest uppercase">
        Next Scrying
      </p>
      <div className="text-right">
        <p
          className="font-pixel text-[13px] tabular-nums"
          style={{ color: isImminent ? "#FFD700" : "white", textShadow: "2px 2px 0 rgba(0,0,0,0.5)" }}
        >
          {msLeft <= 0 ? "NOW" : formatCountdown(msLeft)}
        </p>
        <p className="font-pixel text-[6px] text-white/25 mt-0.5">00:00 &amp; 12:00 UTC</p>
      </div>
    </div>
  );
}
