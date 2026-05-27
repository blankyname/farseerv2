"use client";

import { useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";

const BORDER = "rgba(255,255,255,0.20)";

const FAQ_ITEMS = [
  {
    q: "What is Farseer?",
    a: "Farseer watches a curated list of people you trust on Farcaster and fires an alert when several of them follow the same new account — a convergence signal that someone worth watching just appeared.",
  },
  {
    q: "What is a Vision?",
    a: "A Vision is a watchlist of Seers. You can have multiple Visions for different strategies — e.g. one for DeFi people, one for NFT collectors. Each Vision has its own confluence threshold.",
  },
  {
    q: "What is a Seer?",
    a: "A Seer is a Farcaster account you add to a Vision — someone whose follows you want to track. When enough Seers follow the same new account, Farseer fires an Omen. You can add Seers one by one or import a whole Starter Pack at once.",
  },
  {
    q: "What is an Omen?",
    a: "An Omen is a confluence alert. It fires when the number of Seers who followed the same account reaches your Vision's threshold. You get a push notification and the Omen appears in the Omens tab.",
  },
  {
    q: "What is the Confluence Threshold?",
    a: "The minimum number of Seers that must follow the same account before an Omen fires. Set it to 2 to catch early signals, or 4+ for stronger conviction. Configurable per Vision.",
  },
  {
    q: "When does Farseer sync?",
    a: "Seers are synced twice daily — at 00:00 UTC and 12:00 UTC. The countdown on the Visions tab shows exactly how long until the next sync. Each sync fetches the 25 most recent follows per Seer.",
  },
  {
    q: "Will I get notified?",
    a: "Yes — when a new Omen fires you receive a Farcaster push notification after the sync completes. Make sure you have frame notifications enabled in Warpcast.",
  },
  {
    q: "What are the Scrolls?",
    a: "The Scrolls tab shows the raw activity feed — the latest follows for each of your Seers, straight from Farcaster. No filtering, just their recent moves.",
  },
  {
    q: "Will the same target trigger multiple Omens?",
    a: "No. Each target account fires at most one Omen per Vision, ever. Once an Omen is recorded it won't re-fire even if more Seers follow the same account later.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `2px solid ${BORDER}` }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 py-4 text-left"
      >
        <span className="font-pixel text-[9px] text-white leading-relaxed pr-2" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.5)" }}>
          {q}
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 text-white/40 shrink-0 mt-0.5" />
          : <ChevronDown className="h-4 w-4 text-white/40 shrink-0 mt-0.5" />
        }
      </button>
      {open && (
        <p className="font-mono text-xs text-white/60 leading-relaxed pb-4 pr-2">
          {a}
        </p>
      )}
    </div>
  );
}

export function FaqModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden"
        style={{
          maxHeight: "88dvh",
          background: "#3D2875",
          borderTop: "3px solid rgba(255,255,255,0.30)",
          boxShadow: "0 -6px 0 rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="shrink-0 flex items-center justify-between px-4 py-4"
          style={{ borderBottom: `3px solid ${BORDER}`, background: "#4A3282" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-7 w-7 flex items-center justify-center font-pixel text-[11px] text-black"
              style={{ background: "#FFD700", boxShadow: "2px 2px 0 rgba(0,0,0,0.5)", borderRadius: 0 }}
            >
              ?
            </div>
            <span className="font-pixel text-[11px] text-white tracking-widest uppercase" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.5)" }}>
              How It Works
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center text-white/50 hover:text-white transition-colors"
            style={{ width: 36, height: 36, border: `2px solid ${BORDER}`, background: "rgba(255,255,255,0.08)", borderRadius: 0, boxShadow: "2px 2px 0 rgba(0,0,0,0.4)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* FAQ list */}
        <div className="flex-1 overflow-y-auto px-4">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
