"use client";

import { Farseer } from "@/features/app/types";
import { Trash2 } from "lucide-react";

interface FarseerRowProps {
  farseer: Farseer;
  onRemove: (farseerFid: number) => void;
  onLabelUpdate?: (farseerFid: number, label: string) => void;
}

export function FarseerRow({ farseer, onRemove }: FarseerRowProps) {
  const displayName =
    farseer.customLabel ||
    farseer.farseerDisplayName ||
    farseer.farseerUsername ||
    `FID ${farseer.farseerFid}`;

  return (
    <div
      className="flex items-center gap-4 py-4"
      style={{ borderBottom: "2px solid rgba(255,255,255,0.15)" }}
    >
      {/* Avatar */}
      <div className="shrink-0">
        {farseer.farseerPfpUrl ? (
          <img
            src={farseer.farseerPfpUrl}
            alt={displayName}
            className="h-12 w-12 object-cover pixel-box-sm"
            style={{ border: "2px solid rgba(255,255,255,0.35)", borderRadius: 0 }}
          />
        ) : (
          <div
            className="h-12 w-12 bg-white/20 flex items-center justify-center text-white font-pixel text-xs pixel-box-sm"
            style={{ border: "2px solid rgba(255,255,255,0.30)", borderRadius: 0 }}
          >
            {(farseer.farseerUsername ?? "?")[0]?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="font-pixel text-[10px] text-white truncate" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.5)" }}>
          {displayName}
        </p>
        <p className="font-mono text-xs text-white/45 truncate mt-0.5">
          @{farseer.farseerUsername ?? `fid:${farseer.farseerFid}`}
        </p>
        {farseer.customLabel && farseer.farseerDisplayName && (
          <p className="font-mono text-xs text-white/30 truncate mt-0.5">{farseer.farseerDisplayName}</p>
        )}
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(farseer.farseerFid)}
        className="pixel-btn flex items-center justify-center text-white/30 hover:text-red-300 transition-colors shrink-0"
        style={{ width: 40, height: 40, border: "2px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)" }}
        aria-label="Remove seer"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
