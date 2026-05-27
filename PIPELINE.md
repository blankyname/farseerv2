# Farseer — Pipeline

**Last updated:** 2026-05-14
**Companion docs:** [REPORT_OF_LOGS.md](./REPORT_OF_LOGS.md) (internal architecture changelog)

---

## 1. What Farseer is

A follow-convergence alert system for Farcaster and X.com. You build a **watchlist (Vision)** of accounts you respect (**seers**). You set a **threshold N**. When N of your seers all follow the same target — a *convergence* — you get pushed an **omen** through Warpcast notifications. Each watchlist is platform-locked: a Farcaster Vision tracks Farcaster, an X Vision tracks X. The two pools never bridge.

---

## 2. User journey

### First launch — inside Warpcast

The app opens as a Farcaster Mini App. **No login screen.** Sign In With Farcaster runs automatically through the Neynar SDK; the user's `fid`, username, and pfp are available immediately. The user lands on the **Visions** tab.

Linking X.com is **opt-in, not blocking**. You can use the app fully on Farcaster without ever touching X.

> See: [`src/features/app/mini-app.tsx`](src/features/app/mini-app.tsx)

### Three tabs

The bottom nav has exactly three tabs:

| Tab | What it shows | What you do |
|---|---|---|
| **Visions** | Your watchlists as cards (name, platform badge, seer count, threshold, last sync) | Create / open / refresh a Vision |
| **Omens** | Confluence alerts: "New Omens" (unread) and "Past Visions" (read) | Tap an omen to mark read and jump to the target's profile |
| **Scrolls** | Recent follows from each seer in a selected Vision | Browse the raw activity feed driving the omens |

### Creating a Vision

From the Visions tab, tap **+** (hidden when at plan max). The create form asks for:

- **Platform** — Farcaster or X (locked once chosen)
- **Name** (required) and **Description** (optional)
- **Threshold** — how many seers must converge before an omen fires (free min = 2, pro min = 1)

> See: [`src/features/farseer/tabs/watchlists-tab.tsx`](src/features/farseer/tabs/watchlists-tab.tsx)

### Inscribing Seers

Inside a Vision, tap **+ Add Seer**. A search screen opens:

- **Farcaster:** Neynar user search, accepts `@username`, full Warpcast URL, or plain username
- **X.com:** debounced lookup against `/api/x/search-user`, accepts `@handle`, full `x.com` URL, or handle

Tap a result → confirm with an optional **ritual label** (a private nickname like "DeFi Oracle") → done. Limits per plan: **free 10**, **pro 20**, **elite 50** seers per Vision.

> See: [`add-farseer-screen.tsx`](src/features/farseer/components/add-farseer-screen.tsx), [`add-x-farseer-screen.tsx`](src/features/farseer/components/add-x-farseer-screen.tsx)

### Getting Omens

Twice a day (every 12 hours), the cron syncs every seer's follows. If your threshold is met for any target, a Warpcast push notification arrives:

```
Title:  New Omen Detected
Body:   @alice, @bob, @carol all followed @target
```

Tap → the mini-app opens to the Omens tab.

### Force Scry — on-demand refresh

If you can't wait 12h, tap the refresh icon on a watchlist card:

- **Free users:** 3 monthly credits (reset every 30 days)
- **Pro users:** $0.50 per scry from in-app coin balance

The sync runs in seconds and any new omens fire immediately.

> See: `requestFastRefresh` in [`watchlist-actions.ts`](src/db/actions/watchlist-actions.ts), POST handler in [`/api/farseer/refresh`](src/app/api/farseer/refresh/route.ts)

### Upgrading to Pro

Hit the seer or vision cap → "★ GO PRO" appears. The upgrade screen shows perks and a **Pay with USDC** button:

1. Wallet popup → send **5 USDC on Base** to the recipient wallet
2. Client sends the tx hash to `/api/verify-subscription`
3. Server reads the tx receipt, verifies the transfer recipient + amount ≥ 5 USDC, sets `users.plan = "pro"` with 30-day expiry

> See: [`pro-upgrade-screen.tsx`](src/features/farseer/components/pro-upgrade-screen.tsx), [`/api/verify-subscription/route.ts`](src/app/api/verify-subscription/route.ts)

---

## 3. Background pipeline

Two flows. The user only feels the cron through notifications; the fast-refresh runs while they wait.

### Scheduled — every 12h via Vercel Cron

```
GET /api/cron/sync   (CRON_SECRET-gated, maxDuration 5min)
  │
  ▼
syncAllWatchlists()
  │
  ├── 1. syncAllFcPoolUsers
  │      │
  │      ▼ for each UNIQUE FC pool user referenced by any active watchlist:
  │           fetchFollowing (Neynar)   ← ONE call per unique user, not per (watchlist × seer)
  │           recordFcFollows
  │           ├─ upsert fc_users   (profile snapshot)
  │           └─ upsert fc_follows (directed edges, last_seen_at = now)
  │
  ├── 2. syncAllXPoolUsers   (same shape, X-API + x_users + x_follows)
  │
  └── 3. For each active watchlist:
            computeFcConfluence / computeXConfluence
              ├─ single SQL JOIN over follows + watchlist_seers
              └─ HAVING count(distinct follower) >= threshold

            For each candidate:
              recordFcConfluenceAlert / recordXConfluenceAlert
              └─ ON CONFLICT DO NOTHING   (one alert per watchlist+target)

            If any new alerts fired this cycle:
              sendFrameNotification → Warpcast push to watchlist owner
```

**Why this matters:** Before the pool, 100 watchlists tracking the same 3 seers = **300 API calls per cron**. With the pool: **3 API calls.** Linear in unique seers, not in `watchlists × seers`.

### Fast refresh — on demand

```
User taps Scry / Refresh
  │
  ▼
requestFastRefresh()
  ├─ deduct coin balance (Pro) OR consume credit (Free)
  └─ insert fast_refresh_requests row, status="processing"
  │
  ▼
POST /api/farseer/refresh
  │
  ▼
syncWatchlist(id)   ← dispatches by platform
  │
  ├── FC: refreshFcPoolUserAndWatchlist
  │      ├─ refetch each seer in this watchlist
  │      ├─ recordFcFollows
  │      └─ run confluence + fire alerts
  │
  └── X:  refreshXPoolUserAndWatchlist   (same)
  │
  ▼
mark fast_refresh_requests done, set watchlist.lastRefreshedAt
```

---

## 4. Data model

| Table | One-liner |
|---|---|
| `users` | Farseer accounts. Plan, coin balance, force-scry credits, X OAuth tokens. |
| `watchlists` | Visions. `platform` is locked at creation. `threshold` and `is_active` are user-editable. |
| `fc_users` / `x_users` | The shared **pool** — one row per observed user (seer or target). UUID PK, platform-native ID is a unique column. |
| `fc_follows` / `x_follows` | Global directed follow graph. One row per (follower_id, followee_id), with `last_seen_at` for windowing. |
| `fc_watchlist_seers` / `x_watchlist_seers` | Membership: which pool users a watchlist tracks. UUID references. |
| `fc_confluence_alerts` / `x_confluence_alerts` | Fired omens. `follower_ids` is a real Postgres `uuid[]`. Deduped on (watchlist, target). |
| `fast_refresh_requests` | Audit log of force-scry calls + status. |
| `processed_events` | Webhook idempotency. |
| `kv` | Built-in framework table. Do not modify. |

> Full schema: [`src/db/schema.ts`](src/db/schema.ts)

---

## 5. Auth, billing, notifications

- **Sign In With Farcaster** — handled by Neynar SDK on app entry; no manual login.
- **X OAuth 2 + PKCE** — initiated via `/api/auth/x/start?fid=<fid>`, returns through `/callback`. Tokens land in `users.x_access_token` / `users.x_refresh_token` / `users.x_token_expires_at`. Used by the X API client for fetching follows.
- **Pro upgrade — USDC on Base** — 5 USDC to a fixed recipient, verified server-side by reading the on-chain tx receipt and validating recipient + amount. 30-day expiry rolling.
- **Push notifications** — `sendFrameNotification` calls Neynar's frame-notification endpoint. The target FID receives a Warpcast notification with a body and a deep-link URL back into the mini-app.

> See: [`/api/auth/x/start/route.ts`](src/app/api/auth/x/start/route.ts), [`/api/auth/x/callback/route.ts`](src/app/api/auth/x/callback/route.ts), [`/api/verify-subscription/route.ts`](src/app/api/verify-subscription/route.ts), [`src/lib/notify.ts`](src/lib/notify.ts)

---

## 6. Roadmap — pool-architecture section

### ✅ Done this session
- Add pool tables: `fc_users`, `fc_follows`, `fc_watchlist_seers`, `fc_confluence_alerts` (+ X parallel)
- Pool-aware cron: one fetch per unique pool user
- Confluence as a single SQL JOIN per watchlist
- Wire add-seer / remove-seer / get-seers / stats / alerts through the pool
- Rip out v1 entirely (legacy tables, `schemaVersion` column, dispatcher branches, migrator)
- Rename `*_v2` tables/functions to canonical names

### ☐ Next up — blocks first user-visible release
- Run `pnpm install` + `pnpm run db:push` against a fresh Supabase DB; verify the schema applies cleanly
- End-to-end smoke test: create FC Vision, add 3 seers known to share a follow, trigger `/api/cron/sync`, verify alert fires + notification arrives
- Same smoke for X once X OAuth is connected
- **Surface the "Connect X" button** in the UI — currently `/api/auth/x/start` has no UI entry point
- **Platform-aware profile links** in `signal-card.tsx` — currently hardcoded to `https://warpcast.com/<handle>`; X omens should link to `x.com/<handle>`

### ☐ Near-term polish
- Better multi-omen notification body — currently "Multiple convergences detected"; should resolve target handles for the digest
- **Scrolls (Activity) tab regression check** — legacy `farseer_activity` is gone; the activity stream must now be derived from `fc_follows` joined to pool seers. Likely needs a new query in `watchlist-actions.ts`.
- Profile-refresh batch — TTL-based job that refreshes stale `fc_users.last_refreshed_at` rows independently of the follow-graph sync

### ☐ Pool-architecture follow-ups (deferred)
- "Most-tracked" leaderboard UI on top of `getMostTrackedFcUsers` / `getMostTrackedXUsers` (data is collected; no screen yet)
- Pool-user garbage collection — drop `fc_users` / `x_users` rows not referenced by any active watchlist or any `*_follows` edge in 90 days
- Per-watchlist confluence window setting (currently hardcoded 30 days)

### ☐ Beyond the pool section
- Push-notification settings — `users.notif_enabled` exists but no UI toggle
- Elite plan upgrade path — `PLAN_LIMITS.elite` is defined; no purchase flow

---

## 7. Where to look — file map

| Concern | File |
|---|---|
| App entry / tab nav | [`src/features/app/mini-app.tsx`](src/features/app/mini-app.tsx) |
| Watchlists tab | [`src/features/farseer/tabs/watchlists-tab.tsx`](src/features/farseer/tabs/watchlists-tab.tsx) |
| Signals tab | [`src/features/farseer/tabs/signals-tab.tsx`](src/features/farseer/tabs/signals-tab.tsx) |
| Activity tab | [`src/features/farseer/tabs/activity-tab.tsx`](src/features/farseer/tabs/activity-tab.tsx) |
| Add FC seer | [`src/features/farseer/components/add-farseer-screen.tsx`](src/features/farseer/components/add-farseer-screen.tsx) |
| Add X seer | [`src/features/farseer/components/add-x-farseer-screen.tsx`](src/features/farseer/components/add-x-farseer-screen.tsx) |
| Pro upgrade screen | [`src/features/farseer/components/pro-upgrade-screen.tsx`](src/features/farseer/components/pro-upgrade-screen.tsx) |
| Signal card | [`src/features/farseer/components/signal-card.tsx`](src/features/farseer/components/signal-card.tsx) |
| Sync — FC | [`src/lib/farseer-sync.ts`](src/lib/farseer-sync.ts) |
| Sync — X | [`src/lib/x-sync.ts`](src/lib/x-sync.ts) |
| Notifications | [`src/lib/notify.ts`](src/lib/notify.ts) |
| X API client | [`src/lib/x-api.ts`](src/lib/x-api.ts) |
| Pool DB actions | [`src/db/actions/pool-actions.ts`](src/db/actions/pool-actions.ts) |
| High-level DB actions | [`src/db/actions/watchlist-actions.ts`](src/db/actions/watchlist-actions.ts) |
| Schema | [`src/db/schema.ts`](src/db/schema.ts) |
| Cron route | [`src/app/api/cron/sync/route.ts`](src/app/api/cron/sync/route.ts) |
| Fast refresh route | [`src/app/api/farseer/refresh/route.ts`](src/app/api/farseer/refresh/route.ts) |
| X OAuth start | [`src/app/api/auth/x/start/route.ts`](src/app/api/auth/x/start/route.ts) |
| X OAuth callback | [`src/app/api/auth/x/callback/route.ts`](src/app/api/auth/x/callback/route.ts) |
| USDC verification | [`src/app/api/verify-subscription/route.ts`](src/app/api/verify-subscription/route.ts) |
| Types & PLAN_LIMITS | [`src/features/app/types.ts`](src/features/app/types.ts) |
