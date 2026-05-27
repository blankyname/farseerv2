"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@neynar/ui";
import { ChevronLeft, Check, Search, Link } from "lucide-react";
import { addXFarseer } from "@/db/actions/watchlist-actions";

interface AddXFarseerScreenProps {
  watchlistId: string;
  onBack: () => void;
  onAdded: () => void;
}

interface XCandidate {
  xUserId: string;
  handle: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
  followerCount?: number;
}

const inputCls =
  "w-full bg-black/30 text-white text-sm font-mono outline-none placeholder-white/25 tracking-wide px-3 py-3 [border:2px_solid_rgba(255,255,255,0.25)] focus:[border-color:rgba(255,255,255,0.6)]";

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
 * Parses an X (Twitter) profile URL or raw handle into just the handle.
 * Handles:
 *   - https://x.com/elonmusk
 *   - https://twitter.com/elonmusk
 *   - x.com/elonmusk
 *   - @elonmusk
 *   - elonmusk
 */
function parseXInput(raw: string): string {
  const trimmed = raw.trim();
  try {
    const withProto = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    const knownHosts = ["x.com", "twitter.com"];
    if (knownHosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) return parts[0];
    }
  } catch {
    // not a URL, fall through
  }
  return trimmed.replace(/^@/, "");
}

export function AddXFarseerScreen({ watchlistId, onBack, onAdded }: AddXFarseerScreenProps) {
  const [query, setQuery] = useState("");
  const [candidate, setCandidate] = useState<XCandidate | null>(null);
  const [selected, setSelected] = useState<XCandidate | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const parsed = parseXInput(query);
  const isUrl = /^https?:\/\/|^(x\.|twitter\.)/.test(query.trim());

  // Debounced single-user lookup — X API has no fuzzy search on the free tier
  useEffect(() => {
    if (parsed.length < 2) {
      setCandidate(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/x/search-user?q=${encodeURIComponent(parsed)}`);
        const json = (await res.json()) as { user: XCandidate | null };
        if (!cancelled) setCandidate(json.user);
      } catch {
        if (!cancelled) setCandidate(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [parsed]);

  async function handleAdd(user: XCandidate) {
    setAdding(true);
    setError("");
    const result = await addXFarseer(
      watchlistId,
      user.xUserId,
      user.handle,
      user.displayName,
      user.pfpUrl,
      customLabel.trim() || undefined,
    );
    setAdding(false);
    if (result.success) {
      setAddedIds((prev) => new Set([...prev, user.xUserId]));
      setSelected(null);
      setCustomLabel("");
      setQuery("");
      onAdded();
    } else {
      setError(result.error ?? "Failed to summon seer");
    }
  }

  // ── Confirm screen ───────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="p-4 space-y-5">
        <button
          onClick={() => {
            setSelected(null);
            setCustomLabel("");
          }}
          className="flex items-center gap-2 text-white/55 font-pixel text-[8px]"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <PixelDivider label="Confirm Seer (X)" />

        <div
          className="flex items-center gap-4 p-4 pixel-box"
          style={{ background: "rgba(255,255,255,0.10)", border: "2px solid rgba(255,255,255,0.25)" }}
        >
          {selected.pfpUrl ? (
            <img
              src={selected.pfpUrl}
              alt={selected.handle}
              className="h-14 w-14 object-cover shrink-0"
              style={{ border: "2px solid rgba(255,255,255,0.30)", borderRadius: 0 }}
            />
          ) : (
            <div
              className="h-14 w-14 bg-white/20 flex items-center justify-center text-white font-pixel text-base shrink-0"
              style={{ border: "2px solid rgba(255,255,255,0.25)", borderRadius: 0 }}
            >
              {selected.handle[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p
              className="font-pixel text-[11px] text-white truncate"
              style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.5)" }}
            >
              {selected.displayName ?? selected.handle}
            </p>
            <p className="font-mono text-xs text-white/45 mt-0.5">@{selected.handle} · X</p>
            {selected.followerCount != null && (
              <p className="font-pixel text-[7px] text-white/30 mt-1">
                {selected.followerCount.toLocaleString()} followers
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="font-pixel text-[7px] text-white/45 tracking-widest uppercase block mb-2">
            Ritual label (optional)
          </label>
          <input
            autoFocus
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd(selected)}
            placeholder="e.g. DeFi Oracle…"
            className={inputCls}
            style={{ borderRadius: 0 }}
          />
        </div>

        {error && <p className="font-pixel text-[8px] text-red-300/80">{error}</p>}

        <button
          onClick={() => handleAdd(selected)}
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
      <PixelDivider label="Summon an X Seer" />

      <div className="relative">
        {isUrl ? (
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/70 pointer-events-none" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
        )}
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="@handle or x.com URL…"
          className={inputCls + " pl-9"}
          style={{ borderRadius: 0, borderColor: isUrl ? "rgba(255,215,0,0.5)" : undefined }}
        />
      </div>

      {isUrl && (
        <p className="font-pixel text-[6px] text-amber-400/60 -mt-3 pl-1">
          ★ X profile URL detected — resolving handle…
        </p>
      )}

      {!isUrl && query.trim().length === 0 && (
        <div
          className="p-3 space-y-1.5"
          style={{ border: "1px dashed rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
        >
          <p className="font-pixel text-[6px] text-white/30 leading-relaxed">Accepted formats:</p>
          {["x.com/handle", "twitter.com/handle", "@handle", "handle"].map((ex) => (
            <p key={ex} className="font-mono text-[10px] text-white/25">
              {ex}
            </p>
          ))}
        </div>
      )}

      {parsed.length >= 2 ? (
        loading ? (
          <div className="flex items-center gap-3 py-1">
            <Skeleton className="h-10 w-10 bg-white/12 shrink-0" style={{ borderRadius: 0 }} />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-28 bg-white/12" style={{ borderRadius: 0 }} />
              <Skeleton className="h-2.5 w-20 bg-white/12" style={{ borderRadius: 0 }} />
            </div>
          </div>
        ) : !candidate ? (
          <p className="font-pixel text-[8px] text-white/40 py-4 text-center">No seer found</p>
        ) : (
          (() => {
            const already = addedIds.has(candidate.xUserId);
            return (
              <button
                onClick={() => !already && setSelected(candidate)}
                disabled={already}
                className={`w-full flex items-center gap-3 py-2.5 px-3 text-left transition-colors ${
                  already ? "opacity-40 cursor-default" : "hover:bg-white/10"
                }`}
                style={{ borderRadius: 0 }}
              >
                {candidate.pfpUrl ? (
                  <img
                    src={candidate.pfpUrl}
                    alt={candidate.handle}
                    className="h-10 w-10 object-cover shrink-0"
                    style={{ border: "2px solid rgba(255,255,255,0.20)", borderRadius: 0 }}
                  />
                ) : (
                  <div
                    className="h-10 w-10 bg-white/20 flex items-center justify-center text-white font-pixel text-xs shrink-0"
                    style={{ borderRadius: 0 }}
                  >
                    {candidate.handle[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-pixel text-[9px] text-white truncate">
                    {candidate.displayName ?? candidate.handle}
                  </p>
                  <p className="font-mono text-xs text-white/45 mt-0.5">@{candidate.handle}</p>
                  {candidate.followerCount != null && (
                    <p className="font-pixel text-[6px] text-white/30 mt-0.5">
                      {candidate.followerCount.toLocaleString()} followers
                    </p>
                  )}
                </div>
                {already && <Check className="h-4 w-4 text-white/50 shrink-0" />}
              </button>
            );
          })()
        )
      ) : query.trim().length === 0 ? null : (
        <p className="font-pixel text-[7px] text-white/35 text-center py-6">Type 2+ runes to search</p>
      )}
    </div>
  );
}
