"use client";

import { useUserFollowing } from "@/neynar-web-sdk/neynar";
import { Skeleton } from "@neynar/ui";
import { UserPlus } from "lucide-react";

interface FarseerLatestFollowsProps {
  farseerFid: number;
}

export function FarseerLatestFollows({ farseerFid }: FarseerLatestFollowsProps) {
  const { data, isLoading } = useUserFollowing(
    farseerFid,
    { sort_type: "desc_chron", limit: 5 },
  );

  const follows = data?.pages.flatMap((page) => page.items).slice(0, 5) ?? [];

  if (isLoading) {
    return (
      <div className="mt-2 space-y-1.5 pl-12">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full shrink-0" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    );
  }

  if (follows.length === 0) return null;

  return (
    <div className="mt-2 pl-12 space-y-1.5">
      <p className="text-[10px] text-slate-600 uppercase tracking-wider font-medium mb-1">
        Latest follows
      </p>
      {follows.map((f) => (
        <div key={f.user.fid} className="flex items-center gap-2">
          {f.user.pfp_url ? (
            <img
              src={f.user.pfp_url}
              alt={f.user.username}
              className="h-5 w-5 rounded-full object-cover border border-[#1e1e2e] shrink-0"
            />
          ) : (
            <div className="h-5 w-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
              <span className="text-[8px] text-slate-400 font-semibold">
                {f.user.username?.[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-xs text-slate-400 truncate">
            @{f.user.username}
          </span>
          {f.user.follower_count != null && (
            <span className="text-[10px] text-slate-600 shrink-0">
              {f.user.follower_count >= 1000
                ? `${(f.user.follower_count / 1000).toFixed(1)}k`
                : f.user.follower_count}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
