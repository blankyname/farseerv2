"use client";

import { WatchlistWithStats } from "@/features/app/types";
import { Bell, Users, ChevronRight, Clock } from "lucide-react";
import { formatDistanceToNow } from "@/features/farseer/utilities";

interface WatchlistCardProps {
  watchlist: WatchlistWithStats;
  onOpen: (watchlist: WatchlistWithStats) => void;
}

export function WatchlistCard({
  watchlist, onOpen,
}: WatchlistCardProps) {
  const lastSynced = watchlist.lastRefreshedAt
    ? formatDistanceToNow(new Date(watchlist.lastRefreshedAt))
    : "never";

  return (
    <div
      className="pixel-box overflow-hidden"
      style={{ background: "rgba(255,255,255,0.12)", border: "2px solid rgba(255,255,255,0.30)" }}
    >
      {/* Tap to open */}
      <button
        onClick={() => onOpen(watchlist)}
        className="pixel-btn w-full text-left px-4 pt-5 pb-4 flex items-start justify-between gap-3 active:bg-white/10 transition-colors"
        style={{ background: "transparent", border: "none", boxShadow: "none" }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <img src="/1775819012245.png" alt="" className="h-4 w-auto object-contain shrink-0 brightness-0 invert opacity-60" />
            <span className="font-pixel text-white text-[11px] truncate leading-tight" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.5)" }}>
              {watchlist.name}
            </span>
            <span
              className="shrink-0 font-pixel text-[7px] px-1.5 py-0.5 leading-none tracking-widest uppercase"
              style={{
                background: watchlist.platform === "x" ? "rgba(29,155,240,0.18)" : "rgba(138,99,210,0.18)",
                border: `1px solid ${watchlist.platform === "x" ? "rgba(29,155,240,0.5)" : "rgba(138,99,210,0.5)"}`,
                color: watchlist.platform === "x" ? "#1d9bf0" : "#c4b5fd",
              }}
            >
              {watchlist.platform === "x" ? "X" : "FC"}
            </span>
            {watchlist.unreadAlerts > 0 && (
              <span className="shrink-0 bg-amber-400 text-black font-pixel text-[8px] px-2 py-0.5 pixel-box-sm leading-none">
                {watchlist.unreadAlerts}
              </span>
            )}
          </div>
          {watchlist.description && (
            <p className="text-xs text-white/55 truncate ml-7 font-mono">{watchlist.description}</p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 text-white/50 shrink-0 mt-0.5" />
      </button>

      {/* Pixel divider */}
      <div className="mx-4 pixel-divider my-0" />

      {/* Stats row */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-white/70 font-pixel text-[8px]">
            <Users className="h-3.5 w-3.5" />
            <span>{watchlist.farseerCount} seers</span>
          </div>
          <div className="flex items-center gap-1.5 text-white/70 font-pixel text-[8px]">
            <Bell className="h-3.5 w-3.5" />
            <span>×{watchlist.threshold}</span>
          </div>
          <div className="flex items-center gap-1.5 text-white/40 font-pixel text-[7px]">
            <Clock className="h-3 w-3" />
            <span>{lastSynced}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
