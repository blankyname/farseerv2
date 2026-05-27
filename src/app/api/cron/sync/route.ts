import { NextRequest, NextResponse } from "next/server";
import { syncAllWatchlists } from "@/lib/farseer-sync";

// Vercel Cron: runs every 12 hours
// vercel.json: { "crons": [{ "path": "/api/cron/sync", "schedule": "0 */12 * * *" }] }

export const maxDuration = 300; // 5 min max (Vercel Pro)

export async function GET(req: NextRequest) {
  // Protect with CRON_SECRET to prevent public triggering
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron/sync] Starting full sync…");
  const start = Date.now();

  try {
    const result = await syncAllWatchlists();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(
      `[cron/sync] Done in ${elapsed}s — ${result.watchlistsSynced} watchlists, ` +
        `${result.totalFarseers} farseers synced, ${result.totalAlerts} new omens fired`,
    );

    if (result.errors.length > 0) {
      console.warn("[cron/sync] Errors:", result.errors);
    }

    return NextResponse.json({
      ok: true,
      elapsed: `${elapsed}s`,
      watchlistsSynced: result.watchlistsSynced,
      totalFarseers: result.totalFarseers,
      totalAlerts: result.totalAlerts,
      errors: result.errors,
    });
  } catch (err) {
    console.error("[cron/sync] Fatal error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
