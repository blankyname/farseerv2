import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Key-Value Store Table
 *
 * Built-in table for simple key-value storage.
 * Available immediately without schema changes.
 *
 * ⚠️ CRITICAL: DO NOT DELETE OR EDIT THIS TABLE DEFINITION ⚠️
 * This table is required for the app to function properly.
 * DO NOT delete, modify, rename, or change any part of this table.
 * Removing or editing it will cause database schema conflicts and prevent
 * the app from starting.
 */
export const kv = pgTable("kv", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ─── USERS ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fid: integer("fid").unique().notNull(),
  username: text("username").notNull(),
  displayName: text("display_name"),
  pfpUrl: text("pfp_url"),
  notifEnabled: boolean("notif_enabled").notNull().default(true),
  // ── X.com linking (optional) ────────────────────────────────────────────
  xUserId: text("x_user_id").unique(),
  xHandle: text("x_handle"),
  xAccessToken: text("x_access_token"),
  xRefreshToken: text("x_refresh_token"),
  xTokenExpiresAt: timestamp("x_token_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── WATCHLISTS ───────────────────────────────────────────────────────────────

export const watchlists = pgTable("watchlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerFid: integer("owner_fid").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  // Platform-locked: 'farcaster' | 'x'.
  platform: text("platform").notNull().default("farcaster"),
  threshold: integer("threshold").notNull().default(3),
  isActive: boolean("is_active").notNull().default(true),
  lastRefreshedAt: timestamp("last_refreshed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── PROCESSED EVENTS (webhook idempotency) ───────────────────────────────────

export const processedEvents = pgTable("processed_events", {
  eventId: text("event_id").primaryKey(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

// ─── POOL ARCHITECTURE ────────────────────────────────────────────────────────
// Shared user pools (one per platform, never bridged) + global follow graph.

// FC pool: every Farcaster user we have ever observed (as seer or target).
export const fcUsers = pgTable("fc_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fid: integer("fid").unique().notNull(),
  username: text("username"),
  displayName: text("display_name"),
  pfpUrl: text("pfp_url"),
  bio: text("bio"),
  followerCount: integer("follower_count"),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastRefreshedAt: timestamp("last_refreshed_at").defaultNow().notNull(),
});

// Global FC follow graph. Each directed edge stored exactly once.
export const fcFollows = pgTable(
  "fc_follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    followerId: uuid("follower_id").notNull(),
    followeeId: uuid("followee_id").notNull(),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    source: text("source").notNull().default("cron"),
  },
  (t) => [unique("ff_edge_unique").on(t.followerId, t.followeeId)],
);

// Membership: which pool users a watchlist tracks as seers.
export const fcWatchlistSeers = pgTable(
  "fc_watchlist_seers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watchlistId: uuid("watchlist_id").notNull(),
    fcUserId: uuid("fc_user_id").notNull(),
    customLabel: text("custom_label"),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (t) => [unique("fws_watchlist_user_unique").on(t.watchlistId, t.fcUserId)],
);

// Alerts reference pool ids; follower ids stored as real array.
export const fcConfluenceAlerts = pgTable(
  "fc_confluence_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watchlistId: uuid("watchlist_id").notNull(),
    targetUserId: uuid("target_user_id").notNull(),
    farseerCount: integer("farseer_count").notNull(),
    followerIds: text("follower_ids").array().notNull(),
    thresholdMet: integer("threshold_met").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at"),
    notifiedAt: timestamp("notified_at").defaultNow().notNull(),
  },
  (t) => [unique("fca_watchlist_target_unique").on(t.watchlistId, t.targetUserId)],
);

// X pool: identical structure except platform IDs are text.
export const xUsers = pgTable("x_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  xUserId: text("x_user_id").unique().notNull(),
  handle: text("handle"),
  displayName: text("display_name"),
  pfpUrl: text("pfp_url"),
  bio: text("bio"),
  followerCount: integer("follower_count"),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastRefreshedAt: timestamp("last_refreshed_at").defaultNow().notNull(),
});

export const xFollows = pgTable(
  "x_follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    followerId: uuid("follower_id").notNull(),
    followeeId: uuid("followee_id").notNull(),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    source: text("source").notNull().default("cron"),
  },
  (t) => [unique("xf_edge_unique").on(t.followerId, t.followeeId)],
);

export const xWatchlistSeers = pgTable(
  "x_watchlist_seers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watchlistId: uuid("watchlist_id").notNull(),
    xUserId: uuid("x_user_id").notNull(),
    customLabel: text("custom_label"),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (t) => [unique("xws_watchlist_user_unique").on(t.watchlistId, t.xUserId)],
);

export const xConfluenceAlerts = pgTable(
  "x_confluence_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watchlistId: uuid("watchlist_id").notNull(),
    targetUserId: uuid("target_user_id").notNull(),
    farseerCount: integer("farseer_count").notNull(),
    followerIds: text("follower_ids").array().notNull(),
    thresholdMet: integer("threshold_met").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at"),
    notifiedAt: timestamp("notified_at").defaultNow().notNull(),
  },
  (t) => [unique("xca_watchlist_target_unique").on(t.watchlistId, t.targetUserId)],
);
