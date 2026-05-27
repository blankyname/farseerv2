"use server";

/**
 * Pool-aware Farcaster sync.
 *
 * The cron iterates over UNIQUE pool users referenced by any active FC
 * watchlist, fetches each user's follows ONCE, and writes into the global
 * follow graph. Confluence is then computed by a single SQL JOIN per
 * watchlist over fc_follows.
 *
 * X is delegated to x-sync.ts (mirror logic for the X pool).
 */

import { db } from "@/neynar-db-sdk/db";
import { watchlists, fcUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getAllActiveFcSeerUsers,
  getFcWatchlistSeers,
  recordFcFollows,
  computeFcConfluence,
  recordFcConfluenceAlert,
} from "@/db/actions/pool-actions";
import { sendFrameNotification } from "@/lib/notify";
import { syncXWatchlist, syncAllXPoolUsers } from "@/lib/x-sync";

const NEYNAR_API_BASE = "https://api.neynar.com/v2";
const FOLLOWS_PER_USER = 25;

interface NeynarUser {
  fid: number;
  username: string;
  display_name?: string;
  pfp_url?: string;
  profile?: { bio?: { text?: string } };
  follower_count?: number;
}
interface NeynarFollowEntry { user: NeynarUser; }
interface NeynarFollowingResponse {
  users: NeynarFollowEntry[];
  next?: { cursor?: string };
}

async function fetchFollowing(fid: number, limit = FOLLOWS_PER_USER): Promise<NeynarUser[]> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) throw new Error("NEYNAR_API_KEY not set");

  const url = `${NEYNAR_API_BASE}/farcaster/following?fid=${fid}&limit=${limit}&sort_type=desc_chron`;
  const res = await fetch(url, {
    headers: { "x-api-key": apiKey, accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error(`fetchFollowing(${fid}) → ${res.status}`);
    return [];
  }
  const data = (await res.json()) as NeynarFollowingResponse;
  return (data.users ?? []).map((entry) => entry.user).filter((u) => u?.fid != null);
}

// ─── Pool prefetch ────────────────────────────────────────────────────────────

export async function syncAllFcPoolUsers(): Promise<{
  usersSynced: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const poolUsers = await getAllActiveFcSeerUsers();
  let count = 0;

  for (const user of poolUsers) {
    try {
      const followees = await fetchFollowing(user.fid);
      if (followees.length === 0) continue;
      await recordFcFollows(
        user.id,
        followees.map((u) => ({
          fid: u.fid,
          profile: {
            username: u.username,
            displayName: u.display_name,
            pfpUrl: u.pfp_url,
            bio: u.profile?.bio?.text,
            followerCount: u.follower_count,
          },
        })),
        "cron",
      );
      count++;
    } catch (err) {
      errors.push(`fc pool user ${user.fid}: ${String(err)}`);
    }
  }

  return { usersSynced: count, errors };
}

// ─── Single watchlist ─────────────────────────────────────────────────────────

async function syncFcWatchlist(watchlistId: string): Promise<{
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

  const seers = await getFcWatchlistSeers(watchlistId);
  if (seers.length < watchlist.threshold) {
    return { farseersSynced: seers.length, alertsFired: 0, errors: [] };
  }

  const candidates = await computeFcConfluence(watchlistId, watchlist.threshold);

  const seerHandleMap = new Map(seers.map((s) => [s.fcUserId, s.username ?? `fid_${s.fid}`]));
  const newAlerts: Array<{ targetUserId: string; count: number; seerHandles: string[] }> = [];

  for (const c of candidates) {
    const { fired } = await recordFcConfluenceAlert(
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
      ? await db.select().from(fcUsers).where(eq(fcUsers.id, targetIds[0]))
      : [];

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
      const targetHandle = targetUsers[0]?.username ?? "someone";
      const seerList = alert.seerHandles.map((u) => `@${u}`).join(", ");
      await sendFrameNotification({
        targetFids: [watchlist.ownerFid],
        title: "New Omen Detected",
        body: `${seerList} all followed @${targetHandle}`,
        frameUrl: homeUrl,
      }).catch((e) => console.error("[notify] send error:", e));
    } else {
      await sendFrameNotification({
        targetFids: [watchlist.ownerFid],
        title: `${newAlerts.length} New Omens in ${watchlist.name}`,
        body: `Multiple convergences detected`,
        frameUrl: homeUrl,
      }).catch((e) => console.error("[notify] send error:", e));
    }
  }

  return { farseersSynced: seers.length, alertsFired: newAlerts.length, errors };
}

export async function refreshFcPoolUserAndWatchlist(
  fid: number,
  watchlistId: string,
): Promise<{ farseersSynced: number; alertsFired: number; errors: string[] }> {
  const errors: string[] = [];
  try {
    const [poolRow] = await db
      .select({ id: fcUsers.id })
      .from(fcUsers)
      .where(eq(fcUsers.fid, fid))
      .limit(1);
    if (poolRow) {
      const followees = await fetchFollowing(fid);
      if (followees.length > 0) {
        await recordFcFollows(
          poolRow.id,
          followees.map((u) => ({
            fid: u.fid,
            profile: {
              username: u.username,
              displayName: u.display_name,
              pfpUrl: u.pfp_url,
              bio: u.profile?.bio?.text,
              followerCount: u.follower_count,
            },
          })),
          "fast_refresh",
        );
      }
    }
  } catch (err) {
    errors.push(String(err));
  }
  const result = await syncFcWatchlist(watchlistId);
  return { ...result, errors: [...errors, ...result.errors] };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function syncWatchlist(watchlistId: string): Promise<{
  farseersSynced: number;
  alertsFired: number;
  errors: string[];
}> {
  const [watchlist] = await db
    .select({ platform: watchlists.platform })
    .from(watchlists)
    .where(eq(watchlists.id, watchlistId))
    .limit(1);

  if (!watchlist) {
    return { farseersSynced: 0, alertsFired: 0, errors: ["Watchlist not found"] };
  }

  return watchlist.platform === "x"
    ? syncXWatchlist(watchlistId)
    : syncFcWatchlist(watchlistId);
}

export async function syncAllWatchlists(): Promise<{
  watchlistsSynced: number;
  totalFarseers: number;
  totalAlerts: number;
  errors: string[];
}> {
  const allWatchlists = await db
    .select()
    .from(watchlists)
    .where(eq(watchlists.isActive, true));

  let totalFarseers = 0;
  let totalAlerts = 0;
  const errors: string[] = [];

  // Pool prefetch: fetch each unique pool user ONCE per cycle.
  try {
    const fcResult = await syncAllFcPoolUsers();
    errors.push(...fcResult.errors);
  } catch (err) {
    errors.push(`fc pool prefetch: ${String(err)}`);
  }
  try {
    const xResult = await syncAllXPoolUsers();
    errors.push(...xResult.errors);
  } catch (err) {
    errors.push(`x pool prefetch: ${String(err)}`);
  }

  for (const wl of allWatchlists) {
    try {
      const result = await syncWatchlist(wl.id);
      totalFarseers += result.farseersSynced;
      totalAlerts += result.alertsFired;
      errors.push(...result.errors.map((e) => `[${wl.name}] ${e}`));
    } catch (err) {
      errors.push(`watchlist ${wl.id}: ${String(err)}`);
    }
  }

  return { watchlistsSynced: allWatchlists.length, totalFarseers, totalAlerts, errors };
}
