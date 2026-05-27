import { NextRequest, NextResponse } from "next/server";
import { syncWatchlist } from "@/lib/farseer-sync";

export const maxDuration = 60;

/**
 * POST /api/farseer/refresh
 * Body: { watchlistId: string }
 *
 * Triggers a manual sync of a specific watchlist and its seers.
 */
export async function POST(req: NextRequest) {
  try {
    const { watchlistId } = (await req.json()) as { watchlistId?: string };

    if (!watchlistId) {
      return NextResponse.json(
        { ok: false, error: "watchlistId required" },
        { status: 400 },
      );
    }

    console.log(`[refresh] Syncing watchlist ${watchlistId}…`);
    const start = Date.now();

    const result = await syncWatchlist(watchlistId);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(
      `[refresh] Done in ${elapsed}s — ${result.farseersSynced} farseers synced, ${result.alertsFired} new omens`,
    );

    return NextResponse.json({
      ok: true,
      elapsed: `${elapsed}s`,
      farseersSynced: result.farseersSynced,
      alertsFired: result.alertsFired,
      errors: result.errors,
    });
  } catch (err) {
    console.error("[refresh] Error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
