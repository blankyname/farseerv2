"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@neynar/ui";
import { useFarcasterUser } from "@/neynar-farcaster-sdk/mini";
import { useUserFollowing } from "@/neynar-web-sdk/neynar";
import { getWatchlists, getFarseers } from "@/db/actions/watchlist-actions";
import { Activity, ExternalLink } from "lucide-react";
import type { Farseer } from "@/features/app/types";

function FarseerFollowSection({ farseer }: { farseer: Farseer }) {
  const { data, isLoading } = useUserFollowing(farseer.farseerFid, { sort_type: "desc_chron", limit: 5 });
  const follows = data?.pages.flatMap((p) => p.items).slice(0, 5) ?? [];
  const label = farseer.customLabel || farseer.farseerDisplayName || farseer.farseerUsername || `FID ${farseer.farseerFid}`;

  return (
    <div className="mb-7 last:mb-0">
      {/* Seer header */}
      <div className="flex items-center gap-3 mb-4">
        {farseer.farseerPfpUrl ? (
          <img src={farseer.farseerPfpUrl} alt={label} className="h-12 w-12 object-cover shrink-0" style={{ border: "2px solid rgba(255,255,255,0.35)", borderRadius: 0 }} />
        ) : (
          <div className="h-12 w-12 bg-white/20 flex items-center justify-center text-white font-pixel text-xs shrink-0" style={{ border: "2px solid rgba(255,255,255,0.30)", borderRadius: 0 }}>
            {(farseer.farseerUsername ?? "?")[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-pixel text-[10px] text-white truncate" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.5)" }}>{label}</p>
          {farseer.farseerUsername && (
            <p className="font-mono text-xs text-white/45 mt-0.5">@{farseer.farseerUsername}</p>
          )}
        </div>
        <span className="font-pixel text-[7px] text-white/30 uppercase tracking-widest shrink-0">Latest</span>
      </div>

      {/* Follows */}
      {isLoading ? (
        <div className="space-y-3 pl-15" style={{ paddingLeft: "60px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 bg-white/12 shrink-0" style={{ borderRadius: 0 }} />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-28 bg-white/12" style={{ borderRadius: 0 }} />
                <Skeleton className="h-2.5 w-20 bg-white/12" style={{ borderRadius: 0 }} />
              </div>
            </div>
          ))}
        </div>
      ) : follows.length === 0 ? (
        <p className="font-pixel text-[7px] text-white/35 py-1 italic" style={{ paddingLeft: "60px" }}>No recent follows</p>
      ) : (
        <div className="space-y-3" style={{ paddingLeft: "60px" }}>
          {follows.map((f) => (
            <div key={f.user.fid} className="flex items-center gap-3">
              {f.user.pfp_url ? (
                <img src={f.user.pfp_url} alt={f.user.username} className="h-10 w-10 object-cover shrink-0" style={{ border: "2px solid rgba(255,255,255,0.20)", borderRadius: 0 }} />
              ) : (
                <div className="h-10 w-10 bg-white/15 flex items-center justify-center text-white font-pixel text-xs shrink-0" style={{ borderRadius: 0 }}>
                  {f.user.username?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-pixel text-[9px] text-white truncate">{f.user.display_name ?? f.user.username}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="font-mono text-xs text-white/45 truncate">@{f.user.username}</p>
                  {f.user.follower_count != null && (
                    <span className="font-pixel text-[7px] text-white/30 shrink-0">
                      · {f.user.follower_count >= 1000 ? `${(f.user.follower_count / 1000).toFixed(1)}k` : f.user.follower_count}
                    </span>
                  )}
                </div>
              </div>
              <a
                href={`https://warpcast.com/${f.user.username}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-white/35 hover:text-white transition-colors p-2"
                style={{ border: "1px solid rgba(255,255,255,0.15)", borderRadius: 0 }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Section divider */}
      <div className="mt-6 pixel-divider" />
    </div>
  );
}

export function ActivityTab() {
  const { data: user } = useFarcasterUser();
  const [watchlists, setWatchlists] = useState<{ id: string; name: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [farseers, setFarseers] = useState<Farseer[]>([]);
  const [loading, setLoading] = useState(true);
  const [farseersLoading, setFarseersLoading] = useState(false);

  useEffect(() => {
    if (!user?.fid) return;
    getWatchlists(user.fid).then((data) => {
      setWatchlists(data.map((w) => ({ id: w.id, name: w.name })));
      if (data.length > 0) setSelectedId(data[0].id);
      setLoading(false);
    });
  }, [user?.fid]);

  useEffect(() => {
    if (!selectedId) return;
    setFarseersLoading(true);
    getFarseers(selectedId).then((data) => {
      setFarseers(data as Farseer[]);
      setFarseersLoading(false);
    });
  }, [selectedId]);

  if (loading) {
    return (
      <div className="p-4 space-y-5">
        <Skeleton className="h-9 w-full bg-white/12" style={{ borderRadius: 0 }} />
        {[1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 bg-white/12" style={{ borderRadius: 0 }} />
              <div className="space-y-2">
                <Skeleton className="h-3 w-28 bg-white/12" style={{ borderRadius: 0 }} />
                <Skeleton className="h-2.5 w-20 bg-white/12" style={{ borderRadius: 0 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (watchlists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
        <div
          className="flex items-center justify-center mb-6 pixel-box"
          style={{ width: 72, height: 72, background: "rgba(255,255,255,0.08)", border: "3px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.4)" }}
        >
          <Activity className="h-9 w-9" />
        </div>
        <p className="font-pixel text-[10px] text-white tracking-widest uppercase mb-3" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.5)" }}>
          Scrolls Empty
        </p>
        <p className="font-mono text-sm text-white/50 leading-relaxed max-w-xs">
          Create a vision and inscribe your seers to reveal their movements here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Heading */}
      <div className="text-center">
        <span className="font-pixel text-[11px] text-white tracking-widest uppercase" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.5)" }}>
          The Scrolls
        </span>
      </div>

      {/* Watchlist pills */}
      {watchlists.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {watchlists.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedId(w.id)}
              className={`shrink-0 font-pixel text-[8px] px-4 py-2 pixel-btn tracking-wide transition-colors ${selectedId === w.id ? "text-black" : "text-white/60 hover:text-white"}`}
              style={{
                borderRadius: 0,
                border: "2px solid rgba(255,255,255,0.30)",
                background: selectedId === w.id ? "#FFD700" : "rgba(255,255,255,0.10)",
                boxShadow: selectedId === w.id ? "3px 3px 0 rgba(0,0,0,0.5)" : "2px 2px 0 rgba(0,0,0,0.3)",
              }}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}

      {farseersLoading ? (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 bg-white/12" style={{ borderRadius: 0 }} />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24 bg-white/12" style={{ borderRadius: 0 }} />
                  <Skeleton className="h-2.5 w-16 bg-white/12" style={{ borderRadius: 0 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : farseers.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-pixel text-[8px] text-white/35">No seers in this vision</p>
        </div>
      ) : (
        <div>
          {farseers.map((farseer) => (
            <FarseerFollowSection key={farseer.id} farseer={farseer} />
          ))}
        </div>
      )}
    </div>
  );
}
