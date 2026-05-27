"use server";

import { db } from "@/neynar-db-sdk/db";
import {
  watchlists,
  users,
  fcUsers,
  fcWatchlistSeers,
  fcConfluenceAlerts,
  xUsers,
  xWatchlistSeers,
  xConfluenceAlerts,
} from "@/db/schema";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import {
  addFcSeerToWatchlist,
  removeFcSeerFromWatchlist,
  getFcWatchlistSeers,
  addXSeerToWatchlist,
  removeXSeerFromWatchlist,
  getXWatchlistSeers,
} from "@/db/actions/pool-actions";

// ─── USERS ────────────────────────────────────────────────────────────────────

export async function upsertUser(
  fid: number,
  username: string,
  displayName?: string,
  pfpUrl?: string,
) {
  try {
    await db
      .insert(users)
      .values({ fid, username, displayName, pfpUrl })
      .onConflictDoUpdate({
        target: users.fid,
        set: { username, displayName, pfpUrl, updatedAt: new Date() },
      });
    return { success: true };
  } catch (error) {
    console.error("upsertUser error:", error);
    return { success: false, error: String(error) };
  }
}

export async function getUser(fid: number) {
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.fid, fid))
      .limit(1);
    return result[0] ?? null;
  } catch (error) {
    console.error("getUser error:", error);
    return null;
  }
}

// ─── WATCHLISTS ───────────────────────────────────────────────────────────────

export async function getWatchlists(ownerFid: number) {
  try {
    return await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.ownerFid, ownerFid), eq(watchlists.isActive, true)))
      .orderBy(desc(watchlists.createdAt));
  } catch (error) {
    console.error("getWatchlists error:", error);
    return [];
  }
}

export async function createWatchlist(
  ownerFid: number,
  name: string,
  description: string,
  threshold: number,
  platform: "farcaster" | "x" = "farcaster",
) {
  try {
    const result = await db
      .insert(watchlists)
      .values({ ownerFid, name, description, threshold, platform })
      .returning();
    return { success: true, watchlist: result[0] };
  } catch (error) {
    console.error("createWatchlist error:", error);
    return { success: false, error: String(error) };
  }
}

export async function updateWatchlist(
  id: string,
  ownerFid: number,
  updates: { name?: string; description?: string; threshold?: number },
) {
  try {
    await db
      .update(watchlists)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(watchlists.id, id), eq(watchlists.ownerFid, ownerFid)));
    return { success: true };
  } catch (error) {
    console.error("updateWatchlist error:", error);
    return { success: false, error: String(error) };
  }
}

export async function deleteWatchlist(id: string, ownerFid: number) {
  try {
    await db
      .update(watchlists)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(watchlists.id, id), eq(watchlists.ownerFid, ownerFid)));
    return { success: true };
  } catch (error) {
    console.error("deleteWatchlist error:", error);
    return { success: false, error: String(error) };
  }
}

// ─── FC SEERS ─────────────────────────────────────────────────────────────────

export async function getFarseers(watchlistId: string) {
  try {
    const rows = await getFcWatchlistSeers(watchlistId);
    return rows.map((r) => ({
      id: r.id,
      watchlistId: r.watchlistId,
      farseerFid: r.fid,
      farseerUsername: r.username,
      farseerDisplayName: r.displayName,
      farseerPfpUrl: r.pfpUrl,
      customLabel: r.customLabel,
      addedAt: r.addedAt,
      lastSyncedAt: r.addedAt,
    }));
  } catch (error) {
    console.error("getFarseers error:", error);
    return [];
  }
}

export async function addFarseer(
  watchlistId: string,
  farseerFid: number,
  farseerUsername: string,
  farseerDisplayName?: string,
  farseerPfpUrl?: string,
  customLabel?: string,
) {
  return await addFcSeerToWatchlist(
    watchlistId,
    farseerFid,
    { username: farseerUsername, displayName: farseerDisplayName, pfpUrl: farseerPfpUrl },
    customLabel,
  );
}

export async function removeFarseer(watchlistId: string, farseerFid: number) {
  try {
    const [poolRow] = await db
      .select({ id: fcUsers.id })
      .from(fcUsers)
      .where(eq(fcUsers.fid, farseerFid))
      .limit(1);
    if (!poolRow) return { success: true };
    return await removeFcSeerFromWatchlist(watchlistId, poolRow.id);
  } catch (error) {
    console.error("removeFarseer error:", error);
    return { success: false, error: String(error) };
  }
}

export async function updateFarseerLabel(
  watchlistId: string,
  farseerFid: number,
  customLabel: string,
) {
  try {
    const [poolRow] = await db
      .select({ id: fcUsers.id })
      .from(fcUsers)
      .where(eq(fcUsers.fid, farseerFid))
      .limit(1);
    if (!poolRow) return { success: true };
    await db
      .update(fcWatchlistSeers)
      .set({ customLabel })
      .where(
        and(
          eq(fcWatchlistSeers.watchlistId, watchlistId),
          eq(fcWatchlistSeers.fcUserId, poolRow.id),
        ),
      );
    return { success: true };
  } catch (error) {
    console.error("updateFarseerLabel error:", error);
    return { success: false, error: String(error) };
  }
}

// ─── X SEERS ──────────────────────────────────────────────────────────────────

export async function getXFarseers(watchlistId: string) {
  try {
    const rows = await getXWatchlistSeers(watchlistId);
    return rows.map((r) => ({
      id: r.id,
      watchlistId: r.watchlistId,
      farseerXId: r.xUserId,
      farseerHandle: r.handle ?? "",
      farseerDisplayName: r.displayName,
      farseerPfpUrl: r.pfpUrl,
      customLabel: r.customLabel,
      addedAt: r.addedAt,
      lastSyncedAt: r.addedAt,
    }));
  } catch (error) {
    console.error("getXFarseers error:", error);
    return [];
  }
}

export async function addXFarseer(
  watchlistId: string,
  farseerXId: string,
  farseerHandle: string,
  farseerDisplayName?: string,
  farseerPfpUrl?: string,
  customLabel?: string,
) {
  return await addXSeerToWatchlist(
    watchlistId,
    farseerXId,
    { handle: farseerHandle, displayName: farseerDisplayName, pfpUrl: farseerPfpUrl },
    customLabel,
  );
}

export async function removeXFarseer(watchlistId: string, farseerXId: string) {
  try {
    const [poolRow] = await db
      .select({ id: xUsers.id })
      .from(xUsers)
      .where(eq(xUsers.xUserId, farseerXId))
      .limit(1);
    if (!poolRow) return { success: true };
    return await removeXSeerFromWatchlist(watchlistId, poolRow.id);
  } catch (error) {
    console.error("removeXFarseer error:", error);
    return { success: false, error: String(error) };
  }
}

// ─── CONFLUENCE ALERTS ────────────────────────────────────────────────────────

type AlertRow = {
  id: string;
  watchlistId: string;
  watchlist_name: string;
  targetFid: number | null;
  targetUsername: string | null;
  targetPfpUrl: string | null;
  farseerCount: number;
  farseerFids: string;
  thresholdMet: number;
  isRead: boolean;
  readAt: Date | null;
  notifiedAt: Date;
  seers: Array<{
    farseerFid: number;
    farseerUsername: string | null;
    farseerDisplayName: string | null;
    farseerPfpUrl: string | null;
  }>;
};

async function loadFcAlerts(
  watchlistId: string,
  watchlistName: string,
  limit: number,
): Promise<AlertRow[]> {
  const alerts = await db
    .select()
    .from(fcConfluenceAlerts)
    .where(eq(fcConfluenceAlerts.watchlistId, watchlistId))
    .orderBy(desc(fcConfluenceAlerts.notifiedAt))
    .limit(limit);

  if (alerts.length === 0) return [];

  // Collect all pool ids we need to resolve
  const targetIds = Array.from(new Set(alerts.map((a) => a.targetUserId)));
  const followerIdSet = new Set<string>();
  for (const a of alerts) for (const id of a.followerIds) followerIdSet.add(id);
  const allPoolIds = Array.from(new Set([...targetIds, ...followerIdSet]));

  const poolRows =
    allPoolIds.length > 0
      ? await db
          .select({
            id: fcUsers.id,
            fid: fcUsers.fid,
            username: fcUsers.username,
            displayName: fcUsers.displayName,
            pfpUrl: fcUsers.pfpUrl,
          })
          .from(fcUsers)
          .where(inArray(fcUsers.id, allPoolIds))
      : [];

  const byId = new Map(poolRows.map((u) => [u.id, u]));

  return alerts.map((a) => {
    const target = byId.get(a.targetUserId);
    const seers = a.followerIds
      .map((id) => byId.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({
        farseerFid: s.fid,
        farseerUsername: s.username,
        farseerDisplayName: s.displayName,
        farseerPfpUrl: s.pfpUrl,
      }));
    return {
      id: a.id,
      watchlistId: a.watchlistId,
      watchlist_name: watchlistName,
      targetFid: target?.fid ?? null,
      targetUsername: target?.username ?? null,
      targetPfpUrl: target?.pfpUrl ?? null,
      farseerCount: a.farseerCount,
      farseerFids: seers.map((s) => s.farseerFid).join(","),
      thresholdMet: a.thresholdMet,
      isRead: a.isRead,
      readAt: a.readAt,
      notifiedAt: a.notifiedAt,
      seers,
    };
  });
}

async function loadXAlerts(
  watchlistId: string,
  watchlistName: string,
  limit: number,
): Promise<AlertRow[]> {
  const alerts = await db
    .select()
    .from(xConfluenceAlerts)
    .where(eq(xConfluenceAlerts.watchlistId, watchlistId))
    .orderBy(desc(xConfluenceAlerts.notifiedAt))
    .limit(limit);

  if (alerts.length === 0) return [];

  const targetIds = Array.from(new Set(alerts.map((a) => a.targetUserId)));
  const followerIdSet = new Set<string>();
  for (const a of alerts) for (const id of a.followerIds) followerIdSet.add(id);
  const allPoolIds = Array.from(new Set([...targetIds, ...followerIdSet]));

  const poolRows =
    allPoolIds.length > 0
      ? await db
          .select({
            id: xUsers.id,
            xUserId: xUsers.xUserId,
            handle: xUsers.handle,
            displayName: xUsers.displayName,
            pfpUrl: xUsers.pfpUrl,
          })
          .from(xUsers)
          .where(inArray(xUsers.id, allPoolIds))
      : [];

  const byId = new Map(poolRows.map((u) => [u.id, u]));

  return alerts.map((a) => {
    const target = byId.get(a.targetUserId);
    const seers = a.followerIds
      .map((id) => byId.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({
        farseerFid: 0,
        farseerUsername: s.handle,
        farseerDisplayName: s.displayName,
        farseerPfpUrl: s.pfpUrl,
      }));
    return {
      id: a.id,
      watchlistId: a.watchlistId,
      watchlist_name: watchlistName,
      targetFid: null,
      targetUsername: target?.handle ?? null,
      targetPfpUrl: target?.pfpUrl ?? null,
      farseerCount: a.farseerCount,
      farseerFids: "",
      thresholdMet: a.thresholdMet,
      isRead: a.isRead,
      readAt: a.readAt,
      notifiedAt: a.notifiedAt,
      seers,
    };
  });
}

export async function getConfluenceAlerts(watchlistId: string, limit = 20) {
  try {
    const [wl] = await db
      .select({ platform: watchlists.platform, name: watchlists.name })
      .from(watchlists)
      .where(eq(watchlists.id, watchlistId))
      .limit(1);
    if (!wl) return [];
    return wl.platform === "x"
      ? await loadXAlerts(watchlistId, wl.name, limit)
      : await loadFcAlerts(watchlistId, wl.name, limit);
  } catch (error) {
    console.error("getConfluenceAlerts error:", error);
    return [];
  }
}

export async function getAllConfluenceAlerts(ownerFid: number, limit = 50) {
  try {
    const userWatchlists = await db
      .select({ id: watchlists.id, name: watchlists.name, platform: watchlists.platform })
      .from(watchlists)
      .where(and(eq(watchlists.ownerFid, ownerFid), eq(watchlists.isActive, true)));

    if (userWatchlists.length === 0) return [];

    const all: AlertRow[] = [];
    for (const w of userWatchlists) {
      const rows =
        w.platform === "x"
          ? await loadXAlerts(w.id, w.name, limit)
          : await loadFcAlerts(w.id, w.name, limit);
      all.push(...rows);
    }

    all.sort((a, b) => new Date(b.notifiedAt).getTime() - new Date(a.notifiedAt).getTime());
    return all.slice(0, limit);
  } catch (error) {
    console.error("getAllConfluenceAlerts error:", error);
    return [];
  }
}

export async function markAlertRead(alertId: string) {
  try {
    const now = new Date();
    // Alert id is unique across platforms by UUID — try both tables.
    const fc = await db
      .update(fcConfluenceAlerts)
      .set({ isRead: true, readAt: now })
      .where(eq(fcConfluenceAlerts.id, alertId))
      .returning({ id: fcConfluenceAlerts.id });
    if (fc.length === 0) {
      await db
        .update(xConfluenceAlerts)
        .set({ isRead: true, readAt: now })
        .where(eq(xConfluenceAlerts.id, alertId));
    }
    return { success: true };
  } catch (error) {
    console.error("markAlertRead error:", error);
    return { success: false, error: String(error) };
  }
}

export async function getUnreadAlertCount(ownerFid: number) {
  try {
    const userWatchlists = await db
      .select({ id: watchlists.id, platform: watchlists.platform })
      .from(watchlists)
      .where(and(eq(watchlists.ownerFid, ownerFid), eq(watchlists.isActive, true)));

    if (userWatchlists.length === 0) return 0;

    let total = 0;
    for (const w of userWatchlists) {
      const t = w.platform === "x" ? xConfluenceAlerts : fcConfluenceAlerts;
      const result = await db
        .select({ c: count() })
        .from(t)
        .where(and(eq(t.watchlistId, w.id), eq(t.isRead, false)));
      total += result[0]?.c ?? 0;
    }
    return total;
  } catch (error) {
    return 0;
  }
}

// ─── COMBINED STATS ───────────────────────────────────────────────────────────

export async function getWatchlistWithStats(ownerFid: number) {
  try {
    const allWatchlists = await getWatchlists(ownerFid);

    return await Promise.all(
      allWatchlists.map(async (w) => {
        const isX = w.platform === "x";
        const seerT = isX ? xWatchlistSeers : fcWatchlistSeers;
        const alertT = isX ? xConfluenceAlerts : fcConfluenceAlerts;

        const [farseerList, alertCount] = await Promise.all([
          db.select({ id: seerT.id })
            .from(seerT)
            .where(eq(seerT.watchlistId, w.id)),
          db.select({ c: count() })
            .from(alertT)
            .where(and(eq(alertT.watchlistId, w.id), eq(alertT.isRead, false))),
        ]);

        return {
          ...w,
          farseerCount: farseerList.length,
          unreadAlerts: alertCount[0]?.c ?? 0,
        };
      }),
    );
  } catch (error) {
    console.error("getWatchlistWithStats error:", error);
    return [];
  }
}
