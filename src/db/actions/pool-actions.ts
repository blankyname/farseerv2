"use server";

/**
 * V2 pool-architecture DB actions.
 *
 * Shared user pools deduplicate identities globally so we only fetch each
 * unique seer's follow list once per cron cycle (regardless of how many
 * watchlists reference them). Two pools (FC + X) are never bridged.
 */

import { db } from "@/neynar-db-sdk/db";
import {
  fcUsers,
  fcFollows,
  fcWatchlistSeers,
  fcConfluenceAlerts,
  xUsers,
  xFollows,
  xWatchlistSeers,
  xConfluenceAlerts,
  watchlists,
} from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

// ─── FC POOL ──────────────────────────────────────────────────────────────────

export type FcUserProfile = {
  username?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
  bio?: string | null;
  followerCount?: number | null;
};

/**
 * Upsert a Farcaster user into the pool. Idempotent under concurrency thanks
 * to the unique constraint on `fid`. Returns the pool UUID.
 */
export async function upsertFcUser(
  fid: number,
  profile: FcUserProfile = {},
): Promise<string> {
  const rows = await db
    .insert(fcUsers)
    .values({
      fid,
      username: profile.username ?? null,
      displayName: profile.displayName ?? null,
      pfpUrl: profile.pfpUrl ?? null,
      bio: profile.bio ?? null,
      followerCount: profile.followerCount ?? null,
    })
    .onConflictDoUpdate({
      target: fcUsers.fid,
      set: {
        username: profile.username ?? undefined,
        displayName: profile.displayName ?? undefined,
        pfpUrl: profile.pfpUrl ?? undefined,
        bio: profile.bio ?? undefined,
        followerCount: profile.followerCount ?? undefined,
        lastRefreshedAt: new Date(),
      },
    })
    .returning({ id: fcUsers.id });
  return rows[0].id;
}

export async function getFcUserByFid(fid: number) {
  const rows = await db
    .select()
    .from(fcUsers)
    .where(eq(fcUsers.fid, fid))
    .limit(1);
  return rows[0] ?? null;
}

export async function addFcSeerToWatchlist(
  watchlistId: string,
  fid: number,
  profile: FcUserProfile = {},
  customLabel?: string,
) {
  try {
    const fcUserId = await upsertFcUser(fid, profile);
    await db
      .insert(fcWatchlistSeers)
      .values({ watchlistId, fcUserId, customLabel })
      .onConflictDoNothing();
    return { success: true, fcUserId };
  } catch (error) {
    console.error("addFcSeerToWatchlist error:", error);
    return { success: false, error: String(error) };
  }
}

export async function removeFcSeerFromWatchlist(
  watchlistId: string,
  fcUserId: string,
) {
  try {
    await db
      .delete(fcWatchlistSeers)
      .where(
        and(
          eq(fcWatchlistSeers.watchlistId, watchlistId),
          eq(fcWatchlistSeers.fcUserId, fcUserId),
        ),
      );
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getFcWatchlistSeers(watchlistId: string) {
  return db
    .select({
      id: fcWatchlistSeers.id,
      watchlistId: fcWatchlistSeers.watchlistId,
      fcUserId: fcWatchlistSeers.fcUserId,
      customLabel: fcWatchlistSeers.customLabel,
      addedAt: fcWatchlistSeers.addedAt,
      fid: fcUsers.fid,
      username: fcUsers.username,
      displayName: fcUsers.displayName,
      pfpUrl: fcUsers.pfpUrl,
    })
    .from(fcWatchlistSeers)
    .innerJoin(fcUsers, eq(fcUsers.id, fcWatchlistSeers.fcUserId))
    .where(eq(fcWatchlistSeers.watchlistId, watchlistId))
    .orderBy(fcWatchlistSeers.addedAt);
}

/**
 * Unique pool users referenced by at least one v2 watchlist that is active.
 * Used by the cron to fetch follows once per pool user rather than once per
 * (watchlist × seer).
 */
export async function getAllActiveFcSeerUsers() {
  return db
    .selectDistinct({
      id: fcUsers.id,
      fid: fcUsers.fid,
      username: fcUsers.username,
    })
    .from(fcWatchlistSeers)
    .innerJoin(fcUsers, eq(fcUsers.id, fcWatchlistSeers.fcUserId))
    .innerJoin(watchlists, eq(watchlists.id, fcWatchlistSeers.watchlistId))
    .where(
      and(
        eq(watchlists.isActive, true),
        eq(watchlists.platform, "farcaster"),
      ),
    );
}

/**
 * Bulk-record a seer's current follow set. Upserts each followee into the
 * pool, then upserts each directed edge. Idempotent: re-running just bumps
 * lastSeenAt.
 */
export async function recordFcFollows(
  followerId: string,
  followees: Array<{ fid: number; profile?: FcUserProfile }>,
  source: string = "cron",
) {
  if (followees.length === 0) return { upserted: 0 };

  // 1. Upsert all followees into the pool. Use bulk insert with ON CONFLICT.
  const followeeRows = followees.map((f) => ({
    fid: f.fid,
    username: f.profile?.username ?? null,
    displayName: f.profile?.displayName ?? null,
    pfpUrl: f.profile?.pfpUrl ?? null,
    bio: f.profile?.bio ?? null,
    followerCount: f.profile?.followerCount ?? null,
  }));

  await db
    .insert(fcUsers)
    .values(followeeRows)
    .onConflictDoUpdate({
      target: fcUsers.fid,
      set: {
        username: sql`COALESCE(EXCLUDED.username, fc_users.username)`,
        displayName: sql`COALESCE(EXCLUDED.display_name, fc_users.display_name)`,
        pfpUrl: sql`COALESCE(EXCLUDED.pfp_url, fc_users.pfp_url)`,
        bio: sql`COALESCE(EXCLUDED.bio, fc_users.bio)`,
        followerCount: sql`COALESCE(EXCLUDED.follower_count, fc_users.follower_count)`,
        lastRefreshedAt: new Date(),
      },
    });

  // 2. Look up pool ids for all followees.
  const fids = followees.map((f) => f.fid);
  const followeePool = await db
    .select({ id: fcUsers.id, fid: fcUsers.fid })
    .from(fcUsers)
    .where(inArray(fcUsers.fid, fids));

  // 3. Upsert edges in chunks (Postgres can struggle with very wide inserts).
  const now = new Date();
  const edges = followeePool.map((row) => ({
    followerId,
    followeeId: row.id,
    lastSeenAt: now,
    source,
  }));

  const chunk = 500;
  for (let i = 0; i < edges.length; i += chunk) {
    await db
      .insert(fcFollows)
      .values(edges.slice(i, i + chunk))
      .onConflictDoUpdate({
        target: [fcFollows.followerId, fcFollows.followeeId],
        set: { lastSeenAt: now, source },
      });
  }

  return { upserted: edges.length };
}

/**
 * Compute confluence for an FC watchlist in a single SQL pass. Returns
 * candidates whose count meets the watchlist threshold inside the configured
 * window (30 days, currently hardcoded).
 */
export async function computeFcConfluence(
  watchlistId: string,
  threshold: number,
  windowDays: number = 30,
) {
  const rows = await db.execute(sql`
    SELECT
      ff.followee_id::text AS target_user_id,
      COUNT(DISTINCT ff.follower_id)::int AS cnt,
      ARRAY_AGG(DISTINCT ff.follower_id::text) AS follower_ids
    FROM fc_watchlist_seers fws
    JOIN fc_follows ff ON ff.follower_id = fws.fc_user_id
    WHERE fws.watchlist_id = ${watchlistId}
      AND ff.last_seen_at > NOW() - (${windowDays} || ' days')::interval
    GROUP BY ff.followee_id
    HAVING COUNT(DISTINCT ff.follower_id) >= ${threshold}
  `);
  return rows as unknown as Array<{
    target_user_id: string;
    cnt: number;
    follower_ids: string[];
  }>;
}

export async function recordFcConfluenceAlert(
  watchlistId: string,
  targetUserId: string,
  farseerCount: number,
  followerIds: string[],
  thresholdMet: number,
): Promise<{ fired: boolean }> {
  try {
    const result = await db
      .insert(fcConfluenceAlerts)
      .values({
        watchlistId,
        targetUserId,
        farseerCount,
        followerIds,
        thresholdMet,
      })
      .onConflictDoNothing()
      .returning({ id: fcConfluenceAlerts.id });
    return { fired: (result?.length ?? 0) > 0 };
  } catch (error) {
    console.error("recordFcConfluenceAlert error:", error);
    return { fired: false };
  }
}

// ─── X POOL ───────────────────────────────────────────────────────────────────

export type XUserProfile = {
  handle?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
  bio?: string | null;
  followerCount?: number | null;
};

export async function upsertXUser(
  xUserIdString: string,
  profile: XUserProfile = {},
): Promise<string> {
  const rows = await db
    .insert(xUsers)
    .values({
      xUserId: xUserIdString,
      handle: profile.handle ?? null,
      displayName: profile.displayName ?? null,
      pfpUrl: profile.pfpUrl ?? null,
      bio: profile.bio ?? null,
      followerCount: profile.followerCount ?? null,
    })
    .onConflictDoUpdate({
      target: xUsers.xUserId,
      set: {
        handle: profile.handle ?? undefined,
        displayName: profile.displayName ?? undefined,
        pfpUrl: profile.pfpUrl ?? undefined,
        bio: profile.bio ?? undefined,
        followerCount: profile.followerCount ?? undefined,
        lastRefreshedAt: new Date(),
      },
    })
    .returning({ id: xUsers.id });
  return rows[0].id;
}

export async function addXSeerToWatchlist(
  watchlistId: string,
  xUserIdString: string,
  profile: XUserProfile = {},
  customLabel?: string,
) {
  try {
    const xUserPoolId = await upsertXUser(xUserIdString, profile);
    await db
      .insert(xWatchlistSeers)
      .values({ watchlistId, xUserId: xUserPoolId, customLabel })
      .onConflictDoNothing();
    return { success: true, xUserPoolId };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function removeXSeerFromWatchlist(
  watchlistId: string,
  xUserPoolId: string,
) {
  try {
    await db
      .delete(xWatchlistSeers)
      .where(
        and(
          eq(xWatchlistSeers.watchlistId, watchlistId),
          eq(xWatchlistSeers.xUserId, xUserPoolId),
        ),
      );
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getXWatchlistSeers(watchlistId: string) {
  return db
    .select({
      id: xWatchlistSeers.id,
      watchlistId: xWatchlistSeers.watchlistId,
      xUserPoolId: xWatchlistSeers.xUserId,
      customLabel: xWatchlistSeers.customLabel,
      addedAt: xWatchlistSeers.addedAt,
      xUserId: xUsers.xUserId,
      handle: xUsers.handle,
      displayName: xUsers.displayName,
      pfpUrl: xUsers.pfpUrl,
    })
    .from(xWatchlistSeers)
    .innerJoin(xUsers, eq(xUsers.id, xWatchlistSeers.xUserId))
    .where(eq(xWatchlistSeers.watchlistId, watchlistId))
    .orderBy(xWatchlistSeers.addedAt);
}

export async function getAllActiveXSeerUsers() {
  return db
    .selectDistinct({
      id: xUsers.id,
      xUserId: xUsers.xUserId,
      handle: xUsers.handle,
    })
    .from(xWatchlistSeers)
    .innerJoin(xUsers, eq(xUsers.id, xWatchlistSeers.xUserId))
    .innerJoin(watchlists, eq(watchlists.id, xWatchlistSeers.watchlistId))
    .where(
      and(
        eq(watchlists.isActive, true),
        eq(watchlists.platform, "x"),
      ),
    );
}

export async function recordXFollows(
  followerId: string,
  followees: Array<{ xUserId: string; profile?: XUserProfile }>,
  source: string = "cron",
) {
  if (followees.length === 0) return { upserted: 0 };

  const followeeRows = followees.map((f) => ({
    xUserId: f.xUserId,
    handle: f.profile?.handle ?? null,
    displayName: f.profile?.displayName ?? null,
    pfpUrl: f.profile?.pfpUrl ?? null,
    bio: f.profile?.bio ?? null,
    followerCount: f.profile?.followerCount ?? null,
  }));

  await db
    .insert(xUsers)
    .values(followeeRows)
    .onConflictDoUpdate({
      target: xUsers.xUserId,
      set: {
        handle: sql`COALESCE(EXCLUDED.handle, x_users.handle)`,
        displayName: sql`COALESCE(EXCLUDED.display_name, x_users.display_name)`,
        pfpUrl: sql`COALESCE(EXCLUDED.pfp_url, x_users.pfp_url)`,
        bio: sql`COALESCE(EXCLUDED.bio, x_users.bio)`,
        followerCount: sql`COALESCE(EXCLUDED.follower_count, x_users.follower_count)`,
        lastRefreshedAt: new Date(),
      },
    });

  const xIds = followees.map((f) => f.xUserId);
  const followeePool = await db
    .select({ id: xUsers.id, xUserId: xUsers.xUserId })
    .from(xUsers)
    .where(inArray(xUsers.xUserId, xIds));

  const now = new Date();
  const edges = followeePool.map((row) => ({
    followerId,
    followeeId: row.id,
    lastSeenAt: now,
    source,
  }));

  const chunk = 500;
  for (let i = 0; i < edges.length; i += chunk) {
    await db
      .insert(xFollows)
      .values(edges.slice(i, i + chunk))
      .onConflictDoUpdate({
        target: [xFollows.followerId, xFollows.followeeId],
        set: { lastSeenAt: now, source },
      });
  }

  return { upserted: edges.length };
}

export async function computeXConfluence(
  watchlistId: string,
  threshold: number,
  windowDays: number = 30,
) {
  const rows = await db.execute(sql`
    SELECT
      xf.followee_id::text AS target_user_id,
      COUNT(DISTINCT xf.follower_id)::int AS cnt,
      ARRAY_AGG(DISTINCT xf.follower_id::text) AS follower_ids
    FROM x_watchlist_seers xws
    JOIN x_follows xf ON xf.follower_id = xws.x_user_id
    WHERE xws.watchlist_id = ${watchlistId}
      AND xf.last_seen_at > NOW() - (${windowDays} || ' days')::interval
    GROUP BY xf.followee_id
    HAVING COUNT(DISTINCT xf.follower_id) >= ${threshold}
  `);
  return rows as unknown as Array<{
    target_user_id: string;
    cnt: number;
    follower_ids: string[];
  }>;
}

export async function recordXConfluenceAlert(
  watchlistId: string,
  targetUserId: string,
  farseerCount: number,
  followerIds: string[],
  thresholdMet: number,
): Promise<{ fired: boolean }> {
  try {
    const result = await db
      .insert(xConfluenceAlerts)
      .values({
        watchlistId,
        targetUserId,
        farseerCount,
        followerIds,
        thresholdMet,
      })
      .onConflictDoNothing()
      .returning({ id: xConfluenceAlerts.id });
    return { fired: (result?.length ?? 0) > 0 };
  } catch (error) {
    return { fired: false };
  }
}

// ─── ANALYTICS (no UI yet — data is ready for future leaderboard) ────────────

export async function getMostTrackedFcUsers(limit = 50) {
  return db
    .select({
      fcUserId: fcWatchlistSeers.fcUserId,
      fid: fcUsers.fid,
      username: fcUsers.username,
      pfpUrl: fcUsers.pfpUrl,
      appearsIn: sql<number>`COUNT(*)::int`,
    })
    .from(fcWatchlistSeers)
    .innerJoin(fcUsers, eq(fcUsers.id, fcWatchlistSeers.fcUserId))
    .innerJoin(watchlists, eq(watchlists.id, fcWatchlistSeers.watchlistId))
    .where(eq(watchlists.isActive, true))
    .groupBy(
      fcWatchlistSeers.fcUserId,
      fcUsers.fid,
      fcUsers.username,
      fcUsers.pfpUrl,
    )
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);
}

export async function getMostTrackedXUsers(limit = 50) {
  return db
    .select({
      xUserPoolId: xWatchlistSeers.xUserId,
      xUserId: xUsers.xUserId,
      handle: xUsers.handle,
      pfpUrl: xUsers.pfpUrl,
      appearsIn: sql<number>`COUNT(*)::int`,
    })
    .from(xWatchlistSeers)
    .innerJoin(xUsers, eq(xUsers.id, xWatchlistSeers.xUserId))
    .innerJoin(watchlists, eq(watchlists.id, xWatchlistSeers.watchlistId))
    .where(eq(watchlists.isActive, true))
    .groupBy(
      xWatchlistSeers.xUserId,
      xUsers.xUserId,
      xUsers.handle,
      xUsers.pfpUrl,
    )
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);
}
