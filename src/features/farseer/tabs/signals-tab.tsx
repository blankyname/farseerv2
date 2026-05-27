"use client";

import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@neynar/ui";
import { useFarcasterUser } from "@/neynar-farcaster-sdk/mini";
import { getAllConfluenceAlerts, markAlertRead } from "@/db/actions/watchlist-actions";
import { SignalCard } from "@/features/farseer/components/signal-card";
import { ConfluenceAlertWithWatchlist } from "@/features/app/types";
import { Zap } from "lucide-react";

function PixelSectionHeader({ label, badge }: { label: string; badge?: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 pixel-divider" />
      <div className="flex items-center gap-2">
        <span className="font-pixel text-[9px] tracking-widest uppercase" style={{ color: badge ? "#FFD700" : "rgba(255,255,255,0.40)" }}>
          {label}
        </span>
        {badge != null && (
          <span
            className="font-pixel text-[8px] text-black px-2 py-0.5 pixel-box-sm"
            style={{ background: "#FFD700", boxShadow: "2px 2px 0 rgba(0,0,0,0.5)" }}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="flex-1 pixel-divider" />
    </div>
  );
}

export function SignalsTab() {
  const { data: user } = useFarcasterUser();
  const [alerts, setAlerts] = useState<ConfluenceAlertWithWatchlist[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    if (!user?.fid) return;
    setLoading(true);
    const data = await getAllConfluenceAlerts(user.fid, 50);
    setAlerts(data as unknown as ConfluenceAlertWithWatchlist[]);
    setLoading(false);
  }, [user?.fid]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  async function handleRead(alertId: string) {
    await markAlertRead(alertId);
    setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, isRead: true, readAt: new Date() } : a));
  }

  const unread = alerts.filter((a) => !a.isRead);
  const read = alerts.filter((a) => a.isRead);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="pixel-box p-4 flex gap-4" style={{ background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.15)" }}>
            <Skeleton className="shrink-0 bg-white/15" style={{ width: 44, height: 44, borderRadius: 0 }} />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-32 bg-white/15" style={{ borderRadius: 0 }} />
              <Skeleton className="h-3 w-48 bg-white/15" style={{ borderRadius: 0 }} />
              <Skeleton className="h-2.5 w-24 bg-white/15" style={{ borderRadius: 0 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
        <div
          className="flex items-center justify-center mb-6 pixel-box"
          style={{ width: 72, height: 72, background: "rgba(255,255,255,0.10)", border: "3px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.4)" }}
        >
          <Zap className="h-9 w-9" />
        </div>
        <p className="font-pixel text-[10px] text-white tracking-widest uppercase mb-3" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.5)" }}>
          No Omens Yet
        </p>
        <p className="font-mono text-sm text-white/50 leading-relaxed max-w-xs">
          The crystal is quiet. When multiple seers follow the same soul, their convergence shall appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Heading */}
      <div className="text-center">
        <span className="font-pixel text-[11px] text-white tracking-widest uppercase" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.5)" }}>
          Omens
        </span>
      </div>

      {unread.length > 0 && (
        <div>
          <PixelSectionHeader label="New Omens" badge={unread.length} />
          <div className="space-y-3">
            {unread.map((alert) => <SignalCard key={alert.id} alert={alert} onRead={handleRead} />)}
          </div>
        </div>
      )}

      {read.length > 0 && (
        <div>
          {unread.length > 0 && <PixelSectionHeader label="Past Visions" />}
          <div className="space-y-3">
            {read.map((alert) => <SignalCard key={alert.id} alert={alert} onRead={handleRead} />)}
          </div>
        </div>
      )}
    </div>
  );
}
