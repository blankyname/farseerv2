# Report of Logs — V1 Removal from Farseer-v2

**Date:** 2026-05-14
**Branch / Clone:** `Farseer-v2` (separate from `Farseer-source`, which still holds v1)
**Reason:** Pre-launch. No production data to migrate. V1/V2 coexistence was dead weight.

---

## Before (v1 + v2 coexistence)

Two parallel architectures lived side-by-side, gated by `watchlists.schema_version`:

| Concern | V1 (legacy) | V2 (pool) |
|---|---|---|
| Seer membership | `watchlist_farseers` (FC) / `x_watchlist_farseers` (X) — cached profile per row, duplicated across watchlists | `fc_watchlist_seers` / `x_watchlist_seers` — UUID reference into a shared pool |
| Activity feed | `farseer_activity` / `x_farseer_activity` — per-seer follow rows, duplicated per watchlist | none (replaced by global graph) |
| Follow graph | `follow_signals` / `x_follow_signals` — per-watchlist projection | `fc_follows` / `x_follows` — single directed edge per (follower, followee) regardless of watchlist count |
| Alerts | `confluence_alerts` / `x_confluence_alerts` — CSV-encoded `farseer_fids` | `fc_confluence_alerts_v2` / `x_confluence_alerts_v2` — uuid[] `follower_ids` |
| Cron API calls | N×M (one fetch per `watchlist × seer`) | N (one fetch per unique pool user, regardless of watchlist count) |
| Confluence computation | Per-target loop in `recordFollowSignal` | Single SQL `JOIN` over `fc_follows` per watchlist |
| Sync files | `lib/farseer-sync.ts`, `lib/x-sync.ts` (legacy) + `lib/farseer-sync-v2.ts`, `lib/x-sync-v2.ts` (pool) — dispatcher in `syncWatchlist` switched by `schemaVersion` | n/a |
| Add-seer flow | `addFarseer`/`addXFarseer` had 2-branch routing on `schemaVersion` | n/a |
| Read flow (`getFarseers`, stats) | Same 2-branch routing everywhere | n/a |

`schemaVersion` default was `1`; new lists were created with `2`. Migration was offered via an opt-in `migrate-to-v2.ts` admin button. That migrator was already deleted earlier this session.

---

## Now (pool-only)

V1 fully removed. There is only one path.

### Schema (`src/db/schema.ts`)

**Removed:**
- `watchlists.schema_version` column
- `watchlist_farseers`, `farseer_activity`, `follow_signals`, `confluence_alerts`
- `x_watchlist_farseers`, `x_farseer_activity`, `x_follow_signals`, `x_confluence_alerts` (the legacy CSV-fids X tables)

**Renamed (drop the `V2` suffix):**
- `fc_confluence_alerts_v2` → `fc_confluence_alerts`
- `x_confluence_alerts_v2` → `x_confluence_alerts`

**Kept as-is:**
- `kv`, `users`, `watchlists` (minus `schema_version`), `fast_refresh_requests`, `processed_events`
- Pool tables: `fc_users`, `fc_follows`, `fc_watchlist_seers`, `x_users`, `x_follows`, `x_watchlist_seers`

### DB actions

**`src/db/actions/pool-actions.ts`**
- Dropped `schemaVersion = 2` filter in `getAllActiveFcSeerUsers` / `getAllActiveXSeerUsers` (every active watchlist is v2 now)
- Renamed `recordFcConfluenceAlertV2` → `recordFcConfluenceAlert`
- Renamed `recordXConfluenceAlertV2` → `recordXConfluenceAlert`
- Removed `getFcAlertsV2` (callers consolidated in watchlist-actions)

**`src/db/actions/watchlist-actions.ts`** — rewrite
- `createWatchlist` no longer writes `schemaVersion: 2` (column gone)
- `getFarseers` / `addFarseer` / `removeFarseer` / `updateFarseerLabel`: pool only, no schema branches
- Same for X variants (`getXFarseers` / `addXFarseer` / `removeXFarseer`)
- Removed entirely: `recordFollowSignal`, `recordConfluenceAlert`, `upsertFarseerActivity`, `getFarseerActivity`, `getWatchlistActivityFeed`, `recordXFollowSignal`, `recordXConfluenceAlert` (legacy), `upsertXFarseerActivity`, `getXConfluenceAlerts` (legacy)
- Rewrote `getAllConfluenceAlerts`, `getConfluenceAlerts`, `markAlertRead`, `getUnreadAlertCount` over pool alert tables — output shape preserved (`targetFid`, `targetUsername`, `targetPfpUrl`, `farseerFids` csv, `seers[]`) so the UI consumes them unchanged
- `getWatchlistWithStats` collapsed from 4 branches (v1/v2 × FC/X) to 1 branch (FC/X over pool seer + pool alert tables)

### Sync libraries

**`src/lib/farseer-sync.ts`** — full rewrite, now the pool-aware FC sync **and** top-level dispatcher
- `syncAllFcPoolUsers` — fetch each unique FC pool user's follows once per cron cycle
- `syncFcWatchlist` (internal) — runs `computeFcConfluence` + fires alerts via `recordFcConfluenceAlert`
- `refreshFcPoolUserAndWatchlist` — fast-refresh path
- `syncWatchlist` — dispatches by `platform` only (no more schemaVersion)
- `syncAllWatchlists` — runs FC + X pool prefetches, then per-watchlist confluence

**`src/lib/x-sync.ts`** — full rewrite, now the pool-aware X sync (was legacy CSV-fids sync)
- `syncAllXPoolUsers`, `syncXWatchlist`, `refreshXPoolUserAndWatchlist`

**Deleted:**
- `src/lib/farseer-sync-v2.ts`
- `src/lib/x-sync-v2.ts`

(Both were merged into the canonical `farseer-sync.ts` / `x-sync.ts`.)

### UI / types

**`src/features/app/types.ts`** — removed `schemaVersion: number` from `WatchlistWithStats`.

**No other UI changes needed.** `signals-tab.tsx`, `signal-card.tsx`, `mini-app.tsx`, `watchlists-tab.tsx`, `add-farseer-screen.tsx`, `add-x-farseer-screen.tsx` keep working because:
- The action signatures (`getFarseers`, `addFarseer`, etc.) are preserved
- `getAllConfluenceAlerts` returns the same `ConfluenceAlertWithWatchlist` shape (csv `farseerFids`, populated `seers[]`)
- `WatchlistWithStats` only lost a field the UI never read

---

## Why this is better

| | Before | After |
|---|---|---|
| Tables in DB | 13 watchlist-related | 6 watchlist-related |
| Sync libs | 4 files | 2 files |
| `schemaVersion` branches in code | scattered across actions/sync/types | none |
| Neynar/X API calls per cron (100 watchlists × shared 3 seers each) | ~300 | 3 |
| Most-tracked leaderboard query | impossible | one `GROUP BY` |

---

## Verification (run before merging into Farseer-source)

1. `pnpm install && pnpm run db:push` → schema applies cleanly to a fresh DB
2. Create a watchlist via the UI → no `schemaVersion` errors
3. Add 3 seers, hit `/api/cron/sync` with `Authorization: Bearer $CRON_SECRET` → confirm:
   - `fc_users` rows for all seers
   - `fc_follows` rows populated
   - `fc_confluence_alerts` row when 3 seers share a follow
   - One push notification fires
4. Signals tab renders alerts with seer avatars + target username
5. Force-refresh from watchlist detail completes successfully

---

## Files touched

```
modified:
  src/db/schema.ts
  src/db/actions/pool-actions.ts
  src/db/actions/watchlist-actions.ts
  src/lib/farseer-sync.ts
  src/lib/x-sync.ts
  src/features/app/types.ts

deleted:
  src/lib/farseer-sync-v2.ts
  src/lib/x-sync-v2.ts
  src/db/actions/migrate-to-v2.ts   (earlier in session)
  src/app/admin/migrate-button.tsx  (earlier in session)
```

## Notes

- IDE shows `drizzle-orm` / `process` / implicit-`any` errors — these are pre-existing because Farseer-v2 has no `node_modules` installed. `pnpm install` clears them.
- `src/app/admin/page.tsx` was reverted to original; no migrate UI remains.
- `Farseer-source` (the original v1-only project) is untouched and remains the production codebase until v2 is promoted.
