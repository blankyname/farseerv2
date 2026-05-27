"use client";

import { useState } from "react";
import { useUserSearch } from "@/neynar-web-sdk/neynar";
import { Skeleton } from "@neynar/ui";
import { ChevronLeft, Check, Search, Link } from "lucide-react";
import { addFarseer } from "@/db/actions/watchlist-actions";

interface AddFarseerScreenProps {
  watchlistId: string;
  onBack: () => void;
  onAdded: () => void;
}

interface NeynarUser {
  fid: number;
  username: string;
  display_name?: string;
  pfp_url?: string;
  follower_count?: number;
}

const inputCls = "w-full bg-black/30 text-white text-sm font-mono outline-none placeholder-white/25 tracking-wide px-3 py-3 [border:2px_solid_rgba(255,255,255,0.25)] focus:[border-color:rgba(255,255,255,0.6)]";

function PixelDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 pixel-divider" />
      <span className="font-pixel text-[8px] text-white/50 tracking-widest uppercase px-1">{label}</span>
      <div className="flex-1 pixel-divider" />
    </div>
  );
}

/**
 * Parses a Farcaster profile URL or raw username into just the username.
 * Handles:
 *   - https://warpcast.com/dwr.eth
 *   - https://farcaster.xyz/dwr.eth
 *   - warpcast.com/dwr.eth
 *   - @dwr.eth
 *   - dwr.eth  (pass-through)
 */
function parseQueryInput(raw: string): string {
  const trimmed = raw.trim();

  // Full URL or pasted without protocol
  try {
    const withProto = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    const knownHosts = ["warpcast.com", "farcaster.xyz"];
    if (knownHosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) {
      // pathname = "/username" or "/username/..."
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) return parts[0];
    }
  } catch {
    // not a URL, fall through
  }

  // Strip leading @
  return trimmed.replace(/^@/, "");
}

export function AddFarseerScreen({ watchlistId, onBack, onAdded }: AddFarseerScreenProps) {
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<NeynarUser | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [addedFids, setAddedFids] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  const parsed = parseQueryInput(query);
  const isUrl = /^https?:\/\/|^(warpcast|farcaster)\./.test(query.trim());

  const { data, isLoading } = useUserSearch(
    parsed,
    { limit: isUrl ? 1 : 5 },
    { enabled: parsed.length >= 2 },
  );

  const users: NeynarUser[] =
    data?.pages.flatMap((page) => (page as unknown as { items: NeynarUser[] }).items) ?? [];

  async function handleAdd(user: NeynarUser) {
    setAdding(true);
    setError("");
    const result = await addFarseer(watchlistId, user.fid, user.username, user.display_name, user.pfp_url, customLabel.trim() || undefined);
    setAdding(false);
    if (result.success) {
      setAddedFids((prev) => new Set([...prev, user.fid]));
      setSelectedUser(null);
      setCustomLabel("");
      setQuery("");
      onAdded();
    } else {
      setError(result.error ?? "Failed to summon seer");
    }
  }

  // ── Confirm screen ───────────────────────────────────────────────────────
  if (selectedUser) {
    return (
      <div className="p-4 space-y-5">
        <button onClick={() => { setSelectedUser(null); setCustomLabel(""); }} className="flex items-center gap-2 text-white/55 font-pixel text-[8px]">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <PixelDivider label="Confirm Seer" />

        <div className="flex items-center gap-4 p-4 pixel-box" style={{ background: "rgba(255,255,255,0.10)", border: "2px solid rgba(255,255,255,0.25)" }}>
          {selectedUser.pfp_url ? (
            <img src={selectedUser.pfp_url} alt={selectedUser.username} className="h-14 w-14 object-cover shrink-0" style={{ border: "2px solid rgba(255,255,255,0.30)", borderRadius: 0 }} />
          ) : (
            <div className="h-14 w-14 bg-white/20 flex items-center justify-center text-white font-pixel text-base shrink-0" style={{ border: "2px solid rgba(255,255,255,0.25)", borderRadius: 0 }}>
              {selectedUser.username[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-pixel text-[11px] text-white truncate" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.5)" }}>
              {selectedUser.display_name ?? selectedUser.username}
            </p>
            <p className="font-mono text-xs text-white/45 mt-0.5">@{selectedUser.username}</p>
            {selectedUser.follower_count != null && (
              <p className="font-pixel text-[7px] text-white/30 mt-1">{selectedUser.follower_count.toLocaleString()} followers</p>
            )}
          </div>
        </div>

        <div>
          <label className="font-pixel text-[7px] text-white/45 tracking-widest uppercase block mb-2">Ritual label (optional)</label>
          <input
            autoFocus
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd(selectedUser)}
            placeholder="e.g. DeFi Oracle…"
            className={inputCls}
            style={{ borderRadius: 0 }}
          />
        </div>

        {error && <p className="font-pixel text-[8px] text-red-300/80">{error}</p>}

        <button
          onClick={() => handleAdd(selectedUser)}
          disabled={adding}
          className="pixel-btn w-full h-12 font-pixel text-[9px] tracking-widest uppercase text-white disabled:opacity-40 flex items-center justify-center"
          style={{ border: "2px solid rgba(255,255,255,0.30)", background: "rgba(255,255,255,0.15)", borderRadius: 0 }}
        >
          {adding ? "Summoning…" : "Summon Seer"}
        </button>
      </div>
    );
  }

  // ── Search screen ────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-white/55 font-pixel text-[8px]">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <PixelDivider label="Summon a Seer" />

      <div className="relative">
        {isUrl
          ? <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/70 pointer-events-none" />
          : <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
        }
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Username, @handle, or profile URL…"
          className={inputCls + " pl-9"}
          style={{ borderRadius: 0, borderColor: isUrl ? "rgba(255,215,0,0.5)" : undefined }}
        />
      </div>

      {/* URL hint */}
      {isUrl && (
        <p className="font-pixel text-[6px] text-amber-400/60 -mt-3 pl-1">
          ★ Profile URL detected — resolving username…
        </p>
      )}

      {/* Hint text */}
      {!isUrl && query.trim().length === 0 && (
        <div
          className="p-3 space-y-1.5"
          style={{ border: "1px dashed rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
        >
          <p className="font-pixel text-[6px] text-white/30 leading-relaxed">Accepted formats:</p>
          {[
            "warpcast.com/username",
            "farcaster.xyz/username",
            "@username",
            "username",
          ].map((ex) => (
            <p key={ex} className="font-mono text-[10px] text-white/25">{ex}</p>
          ))}
        </div>
      )}

      {parsed.length >= 2 ? (
        isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <Skeleton className="h-10 w-10 bg-white/12 shrink-0" style={{ borderRadius: 0 }} />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-28 bg-white/12" style={{ borderRadius: 0 }} />
                  <Skeleton className="h-2.5 w-20 bg-white/12" style={{ borderRadius: 0 }} />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="font-pixel text-[8px] text-white/40 py-4 text-center">No seers found</p>
        ) : (
          <div className="space-y-1">
            {users.map((u) => {
              const already = addedFids.has(u.fid);
              return (
                <button
                  key={u.fid}
                  onClick={() => !already && setSelectedUser(u)}
                  disabled={already}
                  className={`w-full flex items-center gap-3 py-2.5 px-3 text-left transition-colors ${already ? "opacity-40 cursor-default" : "hover:bg-white/10"}`}
                  style={{ borderRadius: 0 }}
                >
                  {u.pfp_url ? (
                    <img src={u.pfp_url} alt={u.username} className="h-10 w-10 object-cover shrink-0" style={{ border: "2px solid rgba(255,255,255,0.20)", borderRadius: 0 }} />
                  ) : (
                    <div className="h-10 w-10 bg-white/20 flex items-center justify-center text-white font-pixel text-xs shrink-0" style={{ borderRadius: 0 }}>
                      {u.username[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-pixel text-[9px] text-white truncate">{u.display_name ?? u.username}</p>
                    <p className="font-mono text-xs text-white/45 mt-0.5">@{u.username}</p>
                    {u.follower_count != null && (
                      <p className="font-pixel text-[6px] text-white/30 mt-0.5">{u.follower_count.toLocaleString()} followers</p>
                    )}
                  </div>
                  {already && <Check className="h-4 w-4 text-white/50 shrink-0" />}
                </button>
              );
            })}
          </div>
        )
      ) : (
        query.trim().length === 0
          ? null
          : <p className="font-pixel text-[7px] text-white/35 text-center py-6">Type 2+ runes to search</p>
      )}
    </div>
  );
}
