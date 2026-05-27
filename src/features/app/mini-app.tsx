"use client";

import { useState, useEffect } from "react";
import { useFarcasterUser } from "@/neynar-farcaster-sdk/mini";
import { upsertUser, getUnreadAlertCount } from "@/db/actions/watchlist-actions";
import { WatchlistsTab } from "@/features/farseer/tabs/watchlists-tab";
import { SignalsTab } from "@/features/farseer/tabs/signals-tab";
import { ActivityTab } from "@/features/farseer/tabs/activity-tab";
import type { TabId } from "@/features/app/types";
import { Zap, Activity } from "lucide-react";

// Darker purple palette
const BG = "#5B3FA0";
const NAV_BG = "#4A3282";
const BORDER = "#3A2566";

export function MiniApp() {
  const { data: user, isLoading } = useFarcasterUser();
  const [activeTab, setActiveTab] = useState<TabId>("watchlists");
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.fid) return;
    upsertUser(user.fid, user.username ?? `fid_${user.fid}`, user.displayName ?? undefined, user.pfpUrl ?? undefined);
    getUnreadAlertCount(user.fid).then(setUnreadCount);
  }, [user?.fid]);

  useEffect(() => {
    if (activeTab !== "signals" && user?.fid) {
      getUnreadAlertCount(user.fid).then(setUnreadCount);
    } else if (activeTab === "signals") {
      setUnreadCount(0);
    }
  }, [activeTab, user?.fid]);

  if (isLoading) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center relative scanlines" style={{ background: BG }}>
        <div className="h-10 w-10 border-4 border-white/40 border-t-white animate-spin mb-5" style={{ borderRadius: 0 }} />
        <p className="font-pixel text-white/60 text-[9px] tracking-widest uppercase animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden relative" style={{ background: BG }}>

      {/* ── Header ── */}
      <div
        className="shrink-0 px-4 pt-4 pb-3 flex items-center justify-between"
        style={{ borderBottom: `3px solid ${BORDER}`, background: NAV_BG, boxShadow: `0 3px 0 rgba(0,0,0,0.4)` }}
      >
        <div className="flex items-center gap-3">
          <img src="/1775819012245.png" alt="Farseer" className="h-6 w-auto object-contain brightness-0 invert opacity-90" />
          <span className="font-pixel text-white text-[11px] tracking-widest uppercase" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.5)" }}>
            Farseer
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          {user && (
            user.pfpUrl ? (
              <img src={user.pfpUrl} alt={user.username ?? ""} className="h-8 w-8 object-cover" style={{ border: `2px solid rgba(255,255,255,0.4)`, borderRadius: 0 }} />
            ) : (
              <div className="h-8 w-8 bg-white/20 flex items-center justify-center text-sm text-white font-pixel" style={{ border: `2px solid rgba(255,255,255,0.3)`, borderRadius: 0 }}>
                {(user.username ?? "?")[0]?.toUpperCase()}
              </div>
            )
          )}
          {user && (
            <span className="font-pixel text-[9px] text-white/70 max-w-[70px] truncate">
              @{user.username}
            </span>
          )}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "watchlists" && <WatchlistsTab />}
        {activeTab === "signals"    && <SignalsTab />}
        {activeTab === "activity"   && <ActivityTab />}
      </div>

      {/* ── Bottom nav ── */}
      <div
        className="shrink-0 pb-safe"
        style={{ borderTop: `3px solid ${BORDER}`, background: NAV_BG, boxShadow: `0 -3px 0 rgba(0,0,0,0.3)` }}
      >
        <div className="flex">

          <button
            onClick={() => setActiveTab("watchlists")}
            className={`flex-1 flex flex-col items-center gap-1.5 py-3.5 transition-all ${activeTab === "watchlists" ? "opacity-100" : "opacity-45 hover:opacity-70"}`}
            style={activeTab === "watchlists" ? { borderTop: `3px solid #FFD700`, marginTop: "-3px" } : { marginTop: "0px" }}
          >
            <img src="/1775819012245.png" alt="Visions" className="h-5 w-auto object-contain brightness-0 invert" />
            <span className="font-pixel text-[7px] tracking-widest uppercase text-white">Visions</span>
          </button>

          <button
            onClick={() => setActiveTab("signals")}
            className={`flex-1 flex flex-col items-center gap-1.5 py-3.5 transition-all relative text-white ${activeTab === "signals" ? "opacity-100" : "opacity-45 hover:opacity-70"}`}
            style={activeTab === "signals" ? { borderTop: `3px solid #FFD700`, marginTop: "-3px" } : { marginTop: "0px" }}
          >
            <div className="relative">
              <Zap className="h-5 w-5" />
              {unreadCount > 0 && activeTab !== "signals" && (
                <span className="absolute -top-1.5 -right-2.5 bg-amber-400 text-black font-pixel text-[7px] min-w-[16px] h-4 flex items-center justify-center px-1" style={{ borderRadius: 0, boxShadow: "2px 2px 0 rgba(0,0,0,0.5)" }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <span className="font-pixel text-[7px] tracking-widest uppercase">Omens</span>
          </button>

          <button
            onClick={() => setActiveTab("activity")}
            className={`flex-1 flex flex-col items-center gap-1.5 py-3.5 transition-all text-white ${activeTab === "activity" ? "opacity-100" : "opacity-45 hover:opacity-70"}`}
            style={activeTab === "activity" ? { borderTop: `3px solid #FFD700`, marginTop: "-3px" } : { marginTop: "0px" }}
          >
            <Activity className="h-5 w-5" />
            <span className="font-pixel text-[7px] tracking-widest uppercase">Scrolls</span>
          </button>

        </div>
      </div>

    </div>
  );
}
