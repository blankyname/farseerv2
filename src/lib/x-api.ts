/**
 * X (Twitter) API v2 client helpers.
 *
 * Uses app-only Bearer token for read endpoints (user lookup, following list).
 * Includes rate-limit-aware backoff: on 429 we sleep until the reset header,
 * up to a max wait, then retry.
 *
 * Required env: X_BEARER_TOKEN
 */

const API_BASE = "https://api.twitter.com/2";
const MAX_RETRIES = 3;
const MAX_WAIT_MS = 15 * 60 * 1000;
const FOLLOWING_PER_PAGE = 1000;
const FOLLOWING_PAGE_LIMIT = 25;

export type XUser = {
  id: string;
  username: string;
  name?: string;
  profile_image_url?: string;
  description?: string;
  public_metrics?: { followers_count?: number };
};

export type XFollow = {
  targetXId: string;
  handle: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
  followerCount?: number;
};

function bearer() {
  const t = process.env.X_BEARER_TOKEN;
  if (!t) throw new Error("X_BEARER_TOKEN not set");
  return t;
}

async function xfetch<T>(path: string, init?: RequestInit): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${bearer()}`,
        accept: "application/json",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) return (await res.json()) as T;

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const reset = Number(res.headers.get("x-rate-limit-reset") ?? 0);
      const waitMs = reset ? Math.max(0, reset * 1000 - Date.now()) + 1000 : 30_000;
      if (waitMs > MAX_WAIT_MS) throw new Error(`x rate limit: wait too long (${waitMs}ms)`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    const body = await res.text().catch(() => "");
    throw new Error(`x api ${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  throw new Error(`x api exhausted retries: ${path}`);
}

export async function searchXUser(handle: string): Promise<XUser | null> {
  const clean = handle.replace(/^@/, "").trim();
  if (!clean) return null;
  try {
    const json = await xfetch<{ data?: XUser }>(
      `/users/by/username/${encodeURIComponent(clean)}?user.fields=profile_image_url,description,public_metrics`,
    );
    return json.data ?? null;
  } catch (err) {
    console.error("searchXUser error:", err);
    return null;
  }
}

export async function fetchXUserById(xUserId: string): Promise<XUser | null> {
  try {
    const json = await xfetch<{ data?: XUser }>(
      `/users/${encodeURIComponent(xUserId)}?user.fields=profile_image_url,description,public_metrics`,
    );
    return json.data ?? null;
  } catch (err) {
    console.error("fetchXUserById error:", err);
    return null;
  }
}

/**
 * Fetch all accounts a user is following. Paginates up to FOLLOWING_PAGE_LIMIT
 * pages of FOLLOWING_PER_PAGE results each (25k cap). For most watchlist
 * members this returns everything in one or two pages.
 */
export async function fetchAllFollowing(xUserId: string): Promise<XFollow[]> {
  const out: XFollow[] = [];
  let next: string | undefined;

  for (let page = 0; page < FOLLOWING_PAGE_LIMIT; page++) {
    const params = new URLSearchParams({
      max_results: String(FOLLOWING_PER_PAGE),
      "user.fields": "profile_image_url,description,public_metrics",
    });
    if (next) params.set("pagination_token", next);

    let json: {
      data?: XUser[];
      meta?: { next_token?: string };
    };
    try {
      json = await xfetch(`/users/${encodeURIComponent(xUserId)}/following?${params}`);
    } catch (err) {
      console.error(`fetchAllFollowing(${xUserId}) page ${page} failed:`, err);
      break;
    }

    for (const u of json.data ?? []) {
      out.push({
        targetXId: u.id,
        handle: u.username,
        displayName: u.name,
        pfpUrl: u.profile_image_url,
        bio: u.description,
        followerCount: u.public_metrics?.followers_count,
      });
    }

    next = json.meta?.next_token;
    if (!next) break;
  }

  return out;
}
