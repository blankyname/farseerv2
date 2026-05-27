"use client";

import { useState } from "react";
import { ChevronLeft, Link, Check, Loader } from "lucide-react";
import { addFarseer } from "@/db/actions/watchlist-actions";

interface PackUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string | null;
  follower_count: number | null;
}

interface StarterPackResult {
  id: string;
  name: string;
  description: string;
  totalCount: number;
  users: PackUser[];
}

interface Props {
  watchlistId: string;
  currentFarseerCount: number;
  onBack: () => void;
  onAdded: () => void;
}

const inputCls =
  "w-full bg-black/30 text-white text-sm font-mono outline-none placeholder-white/25 tracking-wide px-3 py-3" +
  " [border:2px_solid_rgba(255,255,255,0.25)] focus:[border-color:rgba(255,255,255,0.6)]";

function parseStarterPackId(input: string): string | null {
  const urlMatch = input.match(/\/pack\/([^/?#\s]+)/);
  if (urlMatch) return urlMatch[1];
  const trimmed = input.trim();
  if (trimmed && !trimmed.includes(" ") && trimmed.includes("-")) return trimmed;
  return null;
}

export function StarterPackScreen({ watchlistId, currentFarseerCount, onBack, onAdded }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [pack, setPack] = useState<StarterPackResult | null>(null);
  const [error, setError] = useState("");
  const [addedFids, setAddedFids] = useState<Set<number>>(new Set());
  const [addingFids, setAddingFids] = useState<Set<number>>(new Set());
  const [addingAll, setAddingAll] = useState(false);

  async function handleFetch() {
    const id = parseStarterPackId(url);
    if (!id) {
      setError("Paste a farcaster.xyz pack link or slug");
      return;
    }
    setLoading(true);
    setError("");
    setPack(null);
    try {
      const res = await fetch(`/api/starter-pack?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Not found");
      setPack(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pack");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUser(user: PackUser) {
    if (addedFids.has(user.fid)) return;
    setAddingFids((prev) => new Set([...prev, user.fid]));
    const result = await addFarseer(
      watchlistId, user.fid, user.username,
      user.display_name, user.pfp_url ?? undefined,
    );
    setAddingFids((prev) => { const s = new Set(prev); s.delete(user.fid); return s; });
    if (result.success) {
      setAddedFids((prev) => new Set([...prev, user.fid]));
      onAdded();
    } else {
      setError(result.error ?? "Failed to add");
    }
  }

  async function handleAddAll() {
    if (!pack) return;
    setAddingAll(true);
    setError("");
    const toAdd = pack.users.filter((u) => !addedFids.has(u.fid));
    for (const user of toAdd) {
      await handleAddUser(user);
    }
    setAddingAll(false);
  }

  const unadded = pack?.users.filter((u) => !addedFids.has(u.fid)) ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Fixed top */}
      <div className="p-4 space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-white/55 font-pixel text-[8px]">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 pixel-divider" />
          <span className="font-pixel text-[8px] text-white/50 tracking-widest uppercase px-1">Starter Pack</span>
          <div className="flex-1 pixel-divider" />
        </div>

        {/* URL input */}
        <div>
          <label className="font-pixel text-[7px] text-white/45 tracking-widest uppercase block mb-2">
            Paste pack link
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
              <input
                autoFocus
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="farcaster.xyz/…/pack/Name-abc123"
                className={inputCls + " pl-9"}
                style={{ borderRadius: 0 }}
              />
            </div>
            <button
              onClick={handleFetch}
              disabled={loading || !url.trim()}
              className="pixel-btn font-pixel text-[8px] text-white disabled:opacity-40 px-4 flex items-center gap-2 shrink-0"
              style={{ border: "2px solid rgba(255,255,255,0.30)", background: "rgba(255,255,255,0.15)", borderRadius: 0 }}
            >
              {loading ? <Loader className="h-4 w-4 animate-spin" /> : "Load"}
            </button>
          </div>
          {error && <p className="font-pixel text-[7px] text-red-300/80 mt-2">{error}</p>}
        </div>

        {/* Pack header + add all */}
        {pack && (
          <div className="space-y-3">
            <div
              className="p-3 pixel-box"
              style={{ background: "rgba(255,255,255,0.10)", border: "2px solid rgba(255,255,255,0.25)" }}
            >
              <p className="font-pixel text-[10px] text-white mb-1" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.5)" }}>
                {pack.name}
              </p>
              {pack.description && (
                <p className="font-mono text-xs text-white/50 leading-relaxed mb-2">{pack.description}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="font-pixel text-[7px] text-white/40">
                  Showing {pack.users.length} of {pack.totalCount} members
                </span>
              </div>
              {pack.totalCount > pack.users.length && (
                <p className="font-pixel text-[6px] text-amber-300/60 mt-1.5 leading-relaxed">
                  ★ Warpcast API returns the first {pack.users.length} in pack-defined order — no ranking, no pagination
                </p>
              )}
            </div>

            {unadded.length > 0 && (
              <button
                onClick={handleAddAll}
                disabled={addingAll}
                className="pixel-btn w-full h-11 font-pixel text-[8px] text-black tracking-widest uppercase flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "#FFD700", border: "2px solid rgba(0,0,0,0.25)", borderRadius: 0, boxShadow: "3px 3px 0 rgba(0,0,0,0.5)" }}
              >
                {addingAll
                  ? <><Loader className="h-4 w-4 animate-spin" /> Adding…</>
                  : `★ Add All (${unadded.length})`
                }
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable user list */}
      {pack && (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div
            className="pixel-box-inset"
            style={{ background: "rgba(0,0,0,0.2)", border: "2px solid rgba(255,255,255,0.12)" }}
          >
            {pack.users.map((user) => {
              const added = addedFids.has(user.fid);
              const adding = addingFids.has(user.fid);
              return (
                <div
                  key={user.fid}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: "2px solid rgba(255,255,255,0.10)" }}
                >
                  {user.pfp_url ? (
                    <img
                      src={user.pfp_url}
                      alt={user.username}
                      className="h-10 w-10 object-cover shrink-0"
                      style={{ border: "2px solid rgba(255,255,255,0.20)", borderRadius: 0 }}
                    />
                  ) : (
                    <div
                      className="h-10 w-10 bg-white/20 flex items-center justify-center font-pixel text-xs text-white shrink-0"
                      style={{ borderRadius: 0 }}
                    >
                      {user.username[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-pixel text-[9px] text-white truncate">{user.display_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="font-mono text-xs text-white/45 truncate">@{user.username}</p>
                      {user.follower_count != null && (
                        <span className="font-pixel text-[6px] text-white/25 shrink-0">
                          · {user.follower_count >= 1000
                            ? `${(user.follower_count / 1000).toFixed(1)}k`
                            : user.follower_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddUser(user)}
                    disabled={added || adding}
                    className="pixel-btn shrink-0 font-pixel text-[7px] flex items-center justify-center gap-1 disabled:opacity-40"
                    style={{
                      width: 52, height: 32,
                      background: added ? "rgba(80,220,80,0.15)" : "rgba(255,255,255,0.12)",
                      border: added ? "2px solid rgba(80,220,80,0.45)" : "2px solid rgba(255,255,255,0.25)",
                      borderRadius: 0,
                      color: added ? "#6ffa6f" : "white",
                    }}
                  >
                    {adding
                      ? <Loader className="h-3 w-3 animate-spin" />
                      : added
                        ? <Check className="h-3.5 w-3.5" />
                        : "+ Add"
                    }
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
