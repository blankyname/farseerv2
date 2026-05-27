"use client";

import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@neynar/ui";
import { Plus, ChevronLeft, UserPlus, Minus, Plus as PlusIcon, Settings } from "lucide-react";
import { useFarcasterUser } from "@/neynar-farcaster-sdk/mini";
import {
  getWatchlistWithStats, createWatchlist, getFarseers,
  removeFarseer, updateFarseerLabel, updateWatchlist,
  deleteWatchlist,
  getXFarseers, removeXFarseer,
} from "@/db/actions/watchlist-actions";
import { WatchlistCard } from "@/features/farseer/components/watchlist-card";
import { FarseerRow } from "@/features/farseer/components/farseer-row";
import { AddFarseerScreen } from "@/features/farseer/components/add-farseer-screen";
import { AddXFarseerScreen } from "@/features/farseer/components/add-x-farseer-screen";
import { StarterPackScreen } from "@/features/farseer/components/starter-pack-screen";
import { WatchlistWithStats, Farseer, XFarseer, Platform } from "@/features/app/types";
import { SyncCountdown } from "@/features/farseer/components/sync-countdown";
import { FaqModal } from "@/features/farseer/components/faq-modal";

const inputCls =
  "w-full bg-black/30 text-white text-sm font-mono outline-none placeholder-white/25 tracking-wide px-3 py-3"
  + " border-0" // override browser default
  + " [border:2px_solid_rgba(255,255,255,0.25)] focus:[border-color:rgba(255,255,255,0.6)]";

const BORDER_COLOR = "rgba(255,255,255,0.20)";

function PixelDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 pixel-divider" />
      <span className="font-pixel text-[8px] text-white/50 tracking-widest uppercase px-1">{label}</span>
      <div className="flex-1 pixel-divider" />
    </div>
  );
}

function PixelBtn({ onClick, disabled, children, className = "", style = {} }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`pixel-btn font-pixel text-white disabled:opacity-40 transition-all ${className}`}
      style={{ border: `2px solid ${BORDER_COLOR}`, background: "rgba(255,255,255,0.15)", ...style }}
    >
      {children}
    </button>
  );
}

export function WatchlistsTab() {
  const { data: user } = useFarcasterUser();
  const [watchlists, setWatchlists] = useState<WatchlistWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWatchlist, setActiveWatchlist] = useState<WatchlistWithStats | null>(null);
  const [farseers, setFarseers] = useState<Farseer[]>([]);
  const [xFarseers, setXFarseers] = useState<XFarseer[]>([]);
  const [farseersLoading, setFarseersLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddFarseer, setShowAddFarseer] = useState(false);
  const [showStarterPack, setShowStarterPack] = useState(false);
  const [showEditWatchlist, setShowEditWatchlist] = useState(false);
  const [showFaq, setShowFaq] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newThreshold, setNewThreshold] = useState(3);
  const [newPlatform, setNewPlatform] = useState<Platform>("farcaster");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editThreshold, setEditThreshold] = useState(3);

  const loadWatchlists = useCallback(async () => {
    if (!user?.fid) return;
    setLoading(true);
    const data = await getWatchlistWithStats(user.fid);
    setWatchlists(data as WatchlistWithStats[]);
    setLoading(false);
  }, [user?.fid]);

  useEffect(() => { loadWatchlists(); }, [loadWatchlists]);

  async function loadFarseers(watchlist: WatchlistWithStats) {
    setFarseersLoading(true);
    if (watchlist.platform === "x") {
      const data = await getXFarseers(watchlist.id);
      setXFarseers(data as XFarseer[]);
      setFarseers([]);
    } else {
      const data = await getFarseers(watchlist.id);
      setFarseers(data as Farseer[]);
      setXFarseers([]);
    }
    setFarseersLoading(false);
  }

  function handleOpenWatchlist(watchlist: WatchlistWithStats) {
    setActiveWatchlist(watchlist);
    loadFarseers(watchlist);
  }

  async function handleCreateWatchlist() {
    if (!user?.fid || !newName.trim()) return;
    const result = await createWatchlist(
      user.fid,
      newName.trim(),
      newDesc.trim(),
      newThreshold,
      newPlatform,
    );
    if (result.success) {
      setNewName(""); setNewDesc(""); setNewThreshold(3); setNewPlatform("farcaster");
      setShowCreate(false);
      await loadWatchlists();
    }
  }

  async function handleRemoveFarseer(farseerFid: number) {
    if (!activeWatchlist) return;
    await removeFarseer(activeWatchlist.id, farseerFid);
    await loadFarseers(activeWatchlist);
    await loadWatchlists();
  }

  async function handleRemoveXFarseer(farseerXId: string) {
    if (!activeWatchlist) return;
    await removeXFarseer(activeWatchlist.id, farseerXId);
    await loadFarseers(activeWatchlist);
    await loadWatchlists();
  }

  async function handleLabelUpdate(farseerFid: number, label: string) {
    if (!activeWatchlist) return;
    await updateFarseerLabel(activeWatchlist.id, farseerFid, label);
    await loadFarseers(activeWatchlist);
  }

  async function handleSaveEdit() {
    if (!activeWatchlist || !user?.fid) return;
    await updateWatchlist(activeWatchlist.id, user.fid, {
      name: editName.trim(), description: editDesc.trim(), threshold: editThreshold,
    });
    setShowEditWatchlist(false);
    await loadWatchlists();
    setActiveWatchlist((prev) =>
      prev ? { ...prev, name: editName, description: editDesc, threshold: editThreshold } : null,
    );
  }

  async function handleDeleteWatchlist() {
    if (!activeWatchlist || !user?.fid) return;
    await deleteWatchlist(activeWatchlist.id, user.fid);
    setActiveWatchlist(null);
    await loadWatchlists();
  }

  // ── EDIT VIEW ───────────────────────────────────────────────────────────────
  if (activeWatchlist && showEditWatchlist) {
    return (
      <div className="p-4 space-y-5">
        <button onClick={() => setShowEditWatchlist(false)} className="flex items-center gap-2 text-white/55 font-pixel text-[8px] tracking-wide">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <PixelDivider label="Edit Vision" />
        <div className="space-y-4">
          <div>
            <label className="font-pixel text-[7px] text-white/45 tracking-widest uppercase block mb-2">Name</label>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} style={{ borderRadius: 0 }} />
          </div>
          <div>
            <label className="font-pixel text-[7px] text-white/45 tracking-widest uppercase block mb-2">Description</label>
            <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className={inputCls} style={{ borderRadius: 0 }} />
          </div>
          <div>
            <label className="font-pixel text-[7px] text-white/45 tracking-widest uppercase block mb-3">
              Threshold — <span className="text-white">{editThreshold}</span>
            </label>
            <div className="flex items-center gap-4">
              <PixelBtn onClick={() => setEditThreshold(Math.max(1, editThreshold - 1))} className="h-10 w-10 flex items-center justify-center text-base">
                <Minus className="h-4 w-4" />
              </PixelBtn>
              <div className="flex-1 pixel-divider relative" style={{ height: "6px", background: "rgba(255,255,255,0.15)" }}>
                <div className="h-full bg-white transition-all" style={{ width: `${((editThreshold - 1) / Math.max(farseers.length - 1, 1)) * 100}%` }} />
              </div>
              <PixelBtn onClick={() => setEditThreshold(Math.min(farseers.length || 10, editThreshold + 1))} className="h-10 w-10 flex items-center justify-center">
                <PlusIcon className="h-4 w-4" />
              </PixelBtn>
            </div>
            <p className="font-pixel text-[7px] text-white/35 mt-2">Alert when {editThreshold} seers follow the same soul</p>
          </div>
        </div>
        <PixelBtn onClick={handleSaveEdit} className="w-full font-pixel text-[9px] tracking-widest uppercase h-12 flex items-center justify-center">
          Seal Changes
        </PixelBtn>
        <button onClick={handleDeleteWatchlist} className="w-full font-pixel text-[8px] text-red-300/50 py-2 hover:text-red-300 transition-colors tracking-wide">
          Dissolve this vision
        </button>
      </div>
    );
  }

  // ── ADD FARSEER ─────────────────────────────────────────────────────────────
  if (activeWatchlist && showAddFarseer) {
    const Screen = activeWatchlist.platform === "x" ? AddXFarseerScreen : AddFarseerScreen;
    return (
      <Screen
        watchlistId={activeWatchlist.id}
        onBack={() => setShowAddFarseer(false)}
        onAdded={async () => {
          await loadFarseers(activeWatchlist);
          await loadWatchlists();
        }}
      />
    );
  }

  // ── STARTER PACK (Farcaster only) ──────────────────────────────────────────
  if (activeWatchlist && showStarterPack && activeWatchlist.platform === "farcaster") {
    return (
      <StarterPackScreen
        watchlistId={activeWatchlist.id}
        currentFarseerCount={farseers.length}
        onBack={() => setShowStarterPack(false)}
        onAdded={async () => {
          await loadFarseers(activeWatchlist);
          await loadWatchlists();
        }}
      />
    );
  }

  // ── WATCHLIST DETAIL ────────────────────────────────────────────────────────
  if (activeWatchlist) {
    const isX = activeWatchlist.platform === "x";
    const memberCount = isX ? xFarseers.length : farseers.length;
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setActiveWatchlist(null)} className="flex items-center gap-2 text-white/55 font-pixel text-[8px] tracking-wide">
            <ChevronLeft className="h-4 w-4" /> Visions
          </button>
          <button
            onClick={() => {
              setEditName(activeWatchlist.name);
              setEditDesc(activeWatchlist.description ?? "");
              setEditThreshold(activeWatchlist.threshold);
              setShowEditWatchlist(true);
            }}
            className="p-2 text-white/35 hover:text-white transition-colors pixel-box-sm"
            style={{ border: "2px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)" }}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <div>
          <h2 className="font-pixel text-[13px] text-white" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.5)" }}>{activeWatchlist.name}</h2>
          {activeWatchlist.description && (
            <p className="font-mono text-sm text-white/55 mt-1 italic">{activeWatchlist.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span
              className="font-pixel text-[7px] px-2 py-1 pixel-box-sm tracking-widest uppercase"
              style={{
                background: isX ? "rgba(29,155,240,0.18)" : "rgba(138,99,210,0.18)",
                border: `2px solid ${isX ? "rgba(29,155,240,0.5)" : "rgba(138,99,210,0.5)"}`,
                color: isX ? "#1d9bf0" : "#c4b5fd",
              }}
            >
              {isX ? "X" : "FC"}
            </span>
            <span
              className="font-pixel text-[7px] text-white/75 px-2 py-1 pixel-box-sm tracking-widest uppercase"
              style={{ background: "rgba(255,255,255,0.12)", border: "2px solid rgba(255,255,255,0.25)" }}
            >
              ×{activeWatchlist.threshold}
            </span>
            <span className="font-pixel text-[7px] text-white/35">
              {memberCount}
            </span>
          </div>
        </div>

        <PixelDivider label="Inscribed Seers" />

        <div className="pixel-box-inset px-4" style={{ background: "rgba(0,0,0,0.2)", border: "2px solid rgba(255,255,255,0.12)" }}>
          {farseersLoading ? (
            <div className="py-4 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 bg-white/10" style={{ borderRadius: 0 }} />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-32 bg-white/10" style={{ borderRadius: 0 }} />
                    <Skeleton className="h-2.5 w-20 bg-white/10" style={{ borderRadius: 0 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : memberCount === 0 ? (
            <div className="py-10 text-center">
              <p className="font-pixel text-3xl mb-3 opacity-20">👁</p>
              <p className="font-pixel text-[8px] text-white/40">No seers inscribed</p>
            </div>
          ) : isX ? (
            xFarseers.map((f) => (
              <div key={f.id} className="flex items-center gap-3 py-3 border-b border-white/5 last:border-b-0">
                {f.farseerPfpUrl ? (
                  <img src={f.farseerPfpUrl} alt={f.farseerHandle} className="h-10 w-10 object-cover shrink-0" style={{ border: "2px solid rgba(255,255,255,0.20)", borderRadius: 0 }} />
                ) : (
                  <div className="h-10 w-10 bg-white/20 flex items-center justify-center text-white font-pixel text-xs shrink-0" style={{ borderRadius: 0 }}>
                    {f.farseerHandle[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-pixel text-[9px] text-white truncate">{f.farseerDisplayName ?? f.farseerHandle}</p>
                  <p className="font-mono text-xs text-white/45 mt-0.5">@{f.farseerHandle}</p>
                  {f.customLabel && (
                    <p className="font-pixel text-[6px] text-amber-300/60 mt-0.5">{f.customLabel}</p>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveXFarseer(f.farseerXId)}
                  className="text-white/35 hover:text-red-300 px-2 py-1 font-pixel text-[7px] tracking-widest"
                >
                  REMOVE
                </button>
              </div>
            ))
          ) : (
            farseers.map((f) => (
              <FarseerRow key={f.id} farseer={f} onRemove={handleRemoveFarseer} onLabelUpdate={handleLabelUpdate} />
            ))
          )}
        </div>

        <div className="flex gap-2">
            <PixelBtn
              onClick={() => setShowAddFarseer(true)}
              className="flex-1 h-12 flex items-center justify-center gap-2 font-pixel text-[8px] tracking-widest uppercase"
            >
              <UserPlus className="h-4 w-4" />
              Add Seer
            </PixelBtn>
            {!isX && (
              <PixelBtn
                onClick={() => setShowStarterPack(true)}
                className="flex-1 h-12 flex items-center justify-center gap-2 font-pixel text-[8px] tracking-widest uppercase"
                style={{ border: "2px solid rgba(255,215,0,0.4)", background: "rgba(255,215,0,0.12)" }}
              >
                <span style={{ color: "#FFD700" }}>★</span>
                Starter Pack
              </PixelBtn>
            )}
          </div>
      </div>
    );
  }

  // ── CREATE VIEW ─────────────────────────────────────────────────────────────
  if (showCreate) {
    return (
      <div className="p-4 space-y-5">
        <button onClick={() => setShowCreate(false)} className="flex items-center gap-2 text-white/55 font-pixel text-[8px] tracking-wide">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <PixelDivider label="New Vision" />
        <div className="space-y-4">
          <div>
            <label className="font-pixel text-[7px] text-white/45 tracking-widest uppercase block mb-2">Platform</label>
            <div className="flex gap-2">
              {(["farcaster", "x"] as Platform[]).map((p) => {
                const selected = newPlatform === p;
                return (
                  <button
                    key={p}
                    onClick={() => setNewPlatform(p)}
                    className="flex-1 h-10 font-pixel text-[8px] tracking-widest uppercase transition-all"
                    style={{
                      background: selected
                        ? p === "x"
                          ? "rgba(29,155,240,0.20)"
                          : "rgba(138,99,210,0.20)"
                        : "rgba(255,255,255,0.06)",
                      border: `2px solid ${
                        selected
                          ? p === "x"
                            ? "rgba(29,155,240,0.6)"
                            : "rgba(138,99,210,0.6)"
                          : "rgba(255,255,255,0.18)"
                      }`,
                      color: selected ? (p === "x" ? "#1d9bf0" : "#c4b5fd") : "rgba(255,255,255,0.55)",
                      borderRadius: 0,
                    }}
                  >
                    {p === "x" ? "X.com" : "Farcaster"}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="font-pixel text-[7px] text-white/45 tracking-widest uppercase block mb-2">Name</label>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. DeFi Prophets" className={inputCls} style={{ borderRadius: 0 }} />
          </div>
          <div>
            <label className="font-pixel text-[7px] text-white/45 tracking-widest uppercase block mb-2">Description</label>
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="optional" className={inputCls} style={{ borderRadius: 0 }} />
          </div>
          <div>
            <label className="font-pixel text-[7px] text-white/45 tracking-widest uppercase block mb-3">
              Threshold — <span className="text-white">{newThreshold}</span>
            </label>
            <div className="flex items-center gap-5">
              <PixelBtn onClick={() => setNewThreshold(Math.max(1, newThreshold - 1))} className="h-10 w-10 flex items-center justify-center">
                <Minus className="h-4 w-4" />
              </PixelBtn>
              <span className="flex-1 text-center font-pixel text-[28px] text-white" style={{ textShadow: "3px 3px 0 rgba(0,0,0,0.5)" }}>{newThreshold}</span>
              <PixelBtn onClick={() => setNewThreshold(Math.min(newThreshold + 10, newThreshold + 1))} className="h-10 w-10 flex items-center justify-center">
                <PlusIcon className="h-4 w-4" />
              </PixelBtn>
            </div>
            <p className="font-pixel text-[7px] text-white/35 mt-2 text-center">Fire when {newThreshold} seers follow the same soul</p>
          </div>
        </div>
        <PixelBtn
          onClick={handleCreateWatchlist}
          disabled={!newName.trim()}
          className="w-full h-12 font-pixel text-[9px] tracking-widest uppercase flex items-center justify-center"
        >
          Inscribe Vision
        </PixelBtn>
      </div>
    );
  }

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {showFaq && <FaqModal onClose={() => setShowFaq(false)} />}

      {/* Floating ? button */}
      <button
        onClick={() => setShowFaq(true)}
        className="fixed bottom-24 right-4 z-40 flex items-center justify-center font-pixel text-[13px] text-black pixel-btn"
        style={{ width: 40, height: 40, background: "#FFD700", border: "3px solid rgba(0,0,0,0.35)", boxShadow: "3px 3px 0 rgba(0,0,0,0.6)", borderRadius: 0 }}
        aria-label="How it works"
      >
        ?
      </button>

      <div className="relative flex items-center justify-center">
        <span className="font-pixel text-[11px] text-white tracking-widest uppercase" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.5)" }}>
          Your Visions
        </span>
        {watchlists.length < 100 && (
          <button
            onClick={() => setShowCreate(true)}
            className="absolute right-0 h-9 w-9 flex items-center justify-center text-white/55 hover:text-white pixel-btn"
            style={{ border: "2px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.1)" }}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <SyncCountdown />

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="pixel-box p-4 space-y-3" style={{ background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.15)" }}>
              <Skeleton className="h-4 w-36 bg-white/10" style={{ borderRadius: 0 }} />
              <Skeleton className="h-3 w-52 bg-white/10" style={{ borderRadius: 0 }} />
              <Skeleton className="h-2.5 w-24 bg-white/10" style={{ borderRadius: 0 }} />
            </div>
          ))}
        </div>
      ) : watchlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div
            className="h-20 w-20 flex items-center justify-center mb-6 pixel-box"
            style={{ background: "rgba(255,255,255,0.08)", border: "3px solid rgba(255,255,255,0.25)" }}
          >
            <div
              className="h-10 w-10 flex items-center justify-center pixel-box-sm"
              style={{ background: "rgba(255,255,255,0.12)", border: "2px solid rgba(255,255,255,0.30)" }}
            >
              <div className="h-4 w-4 bg-white/50" />
            </div>
          </div>
          <p className="font-pixel text-[10px] text-white tracking-widest uppercase mb-3" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.5)" }}>
            Crystal Awaits
          </p>
          <p className="font-mono text-sm text-white/50 mb-8 max-w-xs leading-relaxed">
            Create your first vision, inscribe your seers, and let the convergence begin.
          </p>
          <PixelBtn onClick={() => setShowCreate(true)} className="flex items-center gap-2 font-pixel text-[8px] h-12 px-6 tracking-widest uppercase">
            <Plus className="h-4 w-4" />
            Open a Vision
          </PixelBtn>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {watchlists.map((w) => (
              <WatchlistCard
                key={w.id}
                watchlist={w}
                onOpen={handleOpenWatchlist}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
