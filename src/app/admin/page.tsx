import { db } from "@/neynar-db-sdk/db";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";
import { headers } from "next/headers";

const CREATOR_FID = parseInt(process.env.NEXT_PUBLIC_USER_FID || "0", 10);

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  // Auth: check fid from query param (simple, no session needed for server tools)
  const hdrs = await headers();
  const url = new URL(hdrs.get("x-forwarded-proto") + "://" + hdrs.get("host") + (hdrs.get("x-invoke-path") ?? "/admin"));
  const fidParam = url.searchParams.get("fid");
  const requestFid = fidParam ? parseInt(fidParam, 10) : null;

  const isAuthorized = requestFid === CREATOR_FID;

  if (!isAuthorized) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0a0a0f", display: "flex",
        alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16,
        fontFamily: "'Press Start 2P', monospace",
      }}>
        <p style={{ color: "#ff4444", fontSize: 12, textAlign: "center" }}>ACCESS DENIED</p>
        <p style={{ color: "#ffffff40", fontSize: 8 }}>
          {CREATOR_FID > 0
            ? `Append ?fid=${CREATOR_FID} to the URL`
            : "Creator FID not configured"}
        </p>
      </div>
    );
  }

  const totalUsers = await db.$count(users);

  const BG = "#0a0a0f";
  const CARD = "#12121a";
  const BORDER = "#2a2040";
  const GOLD = "#FFD700";
  const PX = "'Press Start 2P', monospace";

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: PX, padding: "32px 24px" }}>

      {/* Header */}
      <div style={{ borderBottom: `3px solid ${BORDER}`, paddingBottom: 20, marginBottom: 28 }}>
        <p style={{ fontSize: 8, color: GOLD + "80", letterSpacing: 4, marginBottom: 8 }}>FARSEER ADMIN</p>
        <h1 style={{ fontSize: 14, color: GOLD, margin: 0, textShadow: "3px 3px 0 rgba(0,0,0,0.6)" }}>
          DASHBOARD
        </h1>
        <p style={{ fontSize: 7, color: "#ffffff40", marginTop: 8 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 32 }}>
        {[
          { label: "TOTAL USERS", value: totalUsers, color: "#a78bfa" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: CARD, border: `2px solid ${BORDER}`,
            boxShadow: "4px 4px 0 rgba(0,0,0,0.5)", padding: "14px 12px",
          }}>
            <p style={{ fontSize: 6, color: "#ffffff40", marginBottom: 10, letterSpacing: 2 }}>{label}</p>
            <p style={{ fontSize: 18, color, margin: 0, textShadow: `2px 2px 0 rgba(0,0,0,0.5)` }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 40, paddingTop: 16, borderTop: `2px dashed ${BORDER}` }}>
        <p style={{ fontSize: 6, color: "#ffffff20", textAlign: "center" }}>
          FARSEER ADMIN · FID {CREATOR_FID}
        </p>
      </div>
    </div>
  );
}
