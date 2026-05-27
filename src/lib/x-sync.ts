"use server";

/**
 * Pool-aware X (Twitter) sync. Mirrors farseer-sync.ts for the X pool.
 * Reuses the lib/x-api.ts client (same 429 backoff).
 */

import { db } from "@/neynar-db-sdk/db";
import { watchlists, xUsers } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  getAllActiveXSeerUsers,
  getXWatchlistSeers,
  recordXFollows,
  computeXConfluence,
  recordXConfluenceAlert,
} from "@/db/actions/pool-actions";
import { fetchAllFollowing } from "@/lib/x-api";
import { sendFrameNotification } from "@/lib/notify";

const X_FOLLOWS_CAP_PER_USER = 1000;

export async function syncAllXPoolUsers(): Promise<{
  usersSynced: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const poolUsers = await getAllActiveXSeerUsers();
  let count = 0;

  for (const user of poolUsers) {
    try {
      const followees = (await fetchAllFollowing(user.xUserId)).slice(
        0,
        X_FOLLOWS_CAP_PER_USER,
      );
      if (followees.length === 0) continue;
      await recordXFollows(
        user.id,
        followees.map((f) => ({
          xUserId: f.targetXId,
          profile: {
            handle: f.handle,
            displayName: f.displayName,
            pfpUrl: f.pfpUrl,
            bio: f.bio,
            followerCount: f.followerCount,
          },
        })),
        "cron",
      );
      count++;
    } catch (err) {
      errors.push(`x pool user ${user.xUserId}: ${String(err)}`);
    }
  }

  return { usersSynced: count, errors };
}

export async function syncXWatchlist(watchlistId: string): Promise<{
  farseersSynced: number;
  alertsFired: number;
  errors: string[];
}> {
  const errors: string[] = [];

  const [watchlist] = await db
    .select()
    .from(watchlists)
    .where(eq(watchlists.id, watchlistId))
    .limit(1);

  if (!watchlist || !watchlist.isActive) {
    return { farseersSynced: 0, alertsFired: 0, errors: ["Watchlist not found or inactive"] };
  }
  if (watchlist.platform !== "x") {
    return { farseersSynced: 0, alertsFired: 0, errors: ["Wrong platform for X sync"] };
  }

  const seers = await getXWatchlistSeers(watchlistId);
  if (seers.length < watchlist.threshold) {
    return { farseersSynced: seers.length, alertsFired: 0, errors: [] };
  }

  const candidates = await computeXConfluence(watchlistId, watchlist.threshold);

  const seerHandleMap = new Map(
    seers.map((s) => [s.xUserPoolId, s.handle ?? `x_${s.xUserId}`]),
  );
  const newAlerts: Array<{
    targetUserId: string;
    count: number;
    seerHandles: string[];
  }> = [];

  for (const c of candidates) {
    const { fired } = await recordXConfluenceAlert(
      watchlistId,
      c.target_user_id,
      c.cnt,
      c.follower_ids,
      watchlist.threshold,
    );
    if (fired) {
      const seerHandles = c.follower_ids
        .map((id) => seerHandleMap.get(id) ?? "unknown")
        .slice(0, 3);
      newAlerts.push({
        targetUserId: c.target_user_id,
        count: c.cnt,
        seerHandles,
      });
    }
  }

  const targetIds = newAlerts.map((a) => a.targetUserId);
  const targetUsers =
    targetIds.length > 0
      ? await db.select().from(xUsers).where(inArray(xUsers.id, targetIds))
      : [];
  const handleById = new Map(targetUsers.map((u) => [u.id, u.handle ?? "someone"]));

  await db
    .update(watchlists)
    .set({ lastRefreshedAt: new Date(), updatedAt: new Date() })
    .where(eq(watchlists.id, watchlistId));

  if (newAlerts.length > 0) {
    const homeUrl = process.env.NEXT_PUBLIC_VERCEL_PRODUCTION_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_PRODUCTION_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL ?? "";

    if (newAlerts.length === 1) {
      const alert = newAlerts[0];
      const targetHandle = handleById.get(alert.targetUserId) ?? "someone";
      const seerList = alert.seerHandles.map((u) => `@${u}`).join(", ");
      await sendFrameNotification({
        targetFids: [watchlist.ownerFid],
        title: "New X Omen Detected",
        body: `${seerList} all followed @${targetHandle} on X`,
        frameUrl: homeUrl,
      }).catch((e) => console.error("[notify x] send error:", e));
    } else {
      await sendFrameNotification({
        targetFids: [watchlist.ownerFid],
        title: `${newAlerts.length} New X Omens in ${watchlist.name}`,
        body: `Multiple convergences detected`,
        frameUrl: homeUrl,
      }).catch((e) => console.error("[notify x] send error:", e));
    }
  }

  return { farseersSynced: seers.length, alertsFired: newAlerts.length, errors };
}

export async function refreshXPoolUserAndWatchlist(
  xUserIdString: string,
  watchlistId: string,
): Promise<{ farseersSynced: number; alertsFired: number; errors: string[] }> {
  const errors: string[] = [];
  try {
    const [poolRow] = await db
      .select({ id: xUsers.id })
      .from(xUsers)
      .where(eq(xUsers.xUserId, xUserIdString))
      .limit(1);
    if (poolRow) {
      const followees = (await fetchAllFollowing(xUserIdString)).slice(
        0,
        X_FOLLOWS_CAP_PER_USER,
      );
      if (followees.length > 0) {
        await recordXFollows(
          poolRow.id,
          followees.map((f) => ({
            xUserId: f.targetXId,
            profile: {
              handle: f.handle,
              displayName: f.displayName,
              pfpUrl: f.pfpUrl,
              bio: f.bio,
              followerCount: f.followerCount,
            },
          })),
          "fast_refresh",
        );
      }
    }
  } catch (err) {
    errors.push(String(err));
  }
  const result = await syncXWatchlist(watchlistId);
  return { ...result, errors: [...errors, ...result.errors] };
}
