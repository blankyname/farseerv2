"use client";

import { ActivityEntry } from "@/features/app/types";
import { formatDistanceToNow } from "@/features/farseer/utilities";
import { UserPlus } from "lucide-react";

interface ActivityRowProps {
  entry: ActivityEntry;
}

export function ActivityEntryRow({ entry }: ActivityRowProps) {
  const farseerLabel =
    entry.custom_label ||
    entry.farseer_display_name ||
    entry.farseer_username ||
    `FID ${entry.farseer_fid}`;

  const targetLabel =
    entry.target_display_name ||
    entry.target_username ||
    `FID ${entry.target_fid}`;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#1e1e2e] last:border-0">
      {/* Target avatar */}
      <div className="shrink-0 relative">
        {entry.target_pfp_url ? (
          <img
            src={entry.target_pfp_url}
            alt={targetLabel}
            className="h-10 w-10 rounded-full object-cover border border-[#1e1e2e]"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-sm font-semibold">
            {(entry.target_username ?? "?")[0]?.toUpperCase()}
          </div>
        )}
        <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-emerald-500 rounded-full flex items-center justify-center">
          <UserPlus className="h-2.5 w-2.5 text-white" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-white truncate">
            @{entry.target_username ?? `FID ${entry.target_fid}`}
          </p>
          <span className="text-xs text-slate-500 shrink-0">
            {formatDistanceToNow(new Date(entry.followed_at))}
          </span>
        </div>

        <p className="text-xs text-slate-400 truncate">
          followed by{" "}
          <span className="text-indigo-400">{farseerLabel}</span>
        </p>

        {entry.target_bio && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
            {entry.target_bio}
          </p>
        )}

        {entry.target_follower_count != null && (
          <p className="text-xs text-slate-500 mt-0.5">
            {entry.target_follower_count.toLocaleString()} followers
          </p>
        )}
      </div>
    </div>
  );
}
