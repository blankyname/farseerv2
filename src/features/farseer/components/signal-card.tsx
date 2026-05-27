"use client";

import { Zap, ExternalLink, UserPlus } from "lucide-react";
import { ConfluenceAlertWithWatchlist } from "@/features/app/types";
import { formatDistanceToNow } from "@/features/farseer/utilities";
import sdk from "@farcaster/miniapp-sdk";

interface SignalCardProps {
  alert: ConfluenceAlertWithWatchlist;
  onRead: (alertId: string) => void;
}

export function SignalCard({ alert, onRead }: SignalCardProps) {
  const isUnread = !alert.isRead;
  const profileUrl = `https://warpcast.com/${alert.targetUsername}`;

  function handleCardClick() {
    if (!alert.isRead) onRead(alert.id);
  }

  function handleViewProfile(e: React.MouseEvent) {
    e.stopPropagation();
    sdk.actions.openUrl(profileUrl);
  }

  function handleFollow(e: React.MouseEvent) {
    e.stopPropagation();
    if (!alert.isRead) onRead(alert.id);
    sdk.actions.openUrl(profileUrl);
  }

  const seers = alert.seers ?? [];

  return (
    <div
      onClick={handleCardClick}
      className="pixel-box overflow-hidden cursor-pointer transition-all"
      style={{
        background: isUnread ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.08)",
        border: isUnread ? "2px solid rgba(255,215,0,0.55)" : "2px solid rgba(255,255,255,0.18)",
        boxShadow: isUnread ? "4px 4px 0px rgba(0,0,0,0.5)" : "3px 3px 0px rgba(0,0,0,0.4)",
      }}
    >
      {/* Unread pixel strip */}
      {isUnread && (
        <div style={{ height: "4px", background: "repeating-linear-gradient(90deg, #FFD700 0px, #FFD700 6px, transparent 6px, transparent 10px)" }} />
      )}

      <div className="p-4 flex items-start gap-4">
        {/* Avatar or icon */}
        <div
          className="shrink-0 flex items-center justify-center pixel-box-sm overflow-hidden"
          style={{
            width: 44, height: 44,
            background: isUnread ? "rgba(255,215,0,0.2)" : "rgba(255,255,255,0.1)",
            border: isUnread ? "2px solid rgba(255,215,0,0.6)" : "2px solid rgba(255,255,255,0.2)",
            color: isUnread ? "#FFD700" : "rgba(255,255,255,0.5)",
          }}
        >
          {alert.targetPfpUrl ? (
            <img src={alert.targetPfpUrl} alt={alert.targetUsername ?? ""} className="w-full h-full object-cover" />
          ) : (
            <Zap className="h-5 w-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Target + time */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="font-pixel text-[11px] text-white" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.5)" }}>
              @{alert.targetUsername ?? `FID ${alert.targetFid}`}
            </span>
            <span className="font-pixel text-[7px] text-white/40 shrink-0 mt-1">
              {formatDistanceToNow(new Date(alert.notifiedAt))}
            </span>
          </div>

          {/* Confluence count */}
          <p className="text-sm text-white/65 mb-2 font-mono leading-relaxed">
            <span className="font-pixel" style={{ fontSize: "16px", color: isUnread ? "#FFD700" : "white" }}>
              {alert.farseerCount}
            </span>
            <span className="text-white/45 text-xs"> / </span>
            <span className="font-pixel text-[10px] text-white">{alert.thresholdMet}</span>
            <span className="text-white/45 text-xs"> seers converged</span>
          </p>

          {/* ── Seer preview row ── */}
          {seers.length > 0 && (
            <div className="flex items-center gap-1.5 mb-3">
              {seers.slice(0, 5).map((seer) => (
                <div
                  key={seer.farseerFid}
                  className="relative group"
                  title={seer.farseerDisplayName ?? seer.farseerUsername ?? `FID ${seer.farseerFid}`}
                >
                  {seer.farseerPfpUrl ? (
                    <img
                      src={seer.farseerPfpUrl}
                      alt={seer.farseerUsername ?? ""}
                      className="h-6 w-6 object-cover"
                      style={{ border: "2px solid rgba(255,255,255,0.25)", borderRadius: 0 }}
                    />
                  ) : (
                    <div
                      className="h-6 w-6 flex items-center justify-center font-pixel text-[7px] text-white/60"
                      style={{ background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.2)", borderRadius: 0 }}
                    >
                      {(seer.farseerUsername ?? "?")[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
              {seers.length > 5 && (
                <span className="font-pixel text-[6px] text-white/40">+{seers.length - 5}</span>
              )}
              <span className="font-pixel text-[6px] text-white/40 ml-1">followed</span>
            </div>
          )}

          {/* Pixel divider */}
          <div className="pixel-divider mb-3" />

          {/* Actions row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {alert.watchlist_name && (
                <span
                  className="font-pixel text-[7px] text-white/80 px-2 py-1 pixel-box-sm"
                  style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)" }}
                >
                  {alert.watchlist_name}
                </span>
              )}
              {isUnread && (
                <span
                  className="font-pixel text-[7px] text-amber-300 px-2 py-1 pixel-box-sm uppercase"
                  style={{ background: "rgba(255,215,0,0.15)", border: "2px solid rgba(255,215,0,0.5)" }}
                >
                  ★ NEW
                </span>
              )}
            </div>

            {alert.targetUsername && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleViewProfile}
                  className="flex items-center gap-1 font-pixel text-[7px] text-white/40 hover:text-white transition-colors py-1.5 px-2 pixel-box-sm hover:bg-white/10"
                  style={{ border: "1px solid transparent" }}
                  title="View profile"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
                <button
                  onClick={handleFollow}
                  className="flex items-center gap-1.5 font-pixel text-[7px] tracking-widest uppercase py-1.5 px-2.5 transition-all hover:opacity-80"
                  style={{
                    background: "rgba(255,215,0,0.12)",
                    border: "2px solid #FFD700",
                    color: "#FFD700",
                    boxShadow: "2px 2px 0 rgba(0,0,0,0.4)",
                    borderRadius: 0,
                  }}
                  title="Follow on Warpcast"
                >
                  <UserPlus className="h-3 w-3" />
                  Follow
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
