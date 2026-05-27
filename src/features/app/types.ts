export type Platform = "farcaster" | "x";

export type TabId = "watchlists" | "signals" | "activity";

export interface WatchlistWithStats {
  id: string;
  ownerFid: number;
  name: string;
  description: string | null;
  platform: Platform;
  threshold: number;
  isActive: boolean;
  lastRefreshedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  farseerCount: number;
  unreadAlerts: number;
}

export interface Farseer {
  id: string;
  watchlistId: string;
  farseerFid: number;
  farseerUsername: string | null;
  farseerDisplayName: string | null;
  farseerPfpUrl: string | null;
  customLabel: string | null;
  addedAt: Date;
  lastSyncedAt: Date;
}

export interface XFarseer {
  id: string;
  watchlistId: string;
  farseerXId: string;
  farseerHandle: string;
  farseerDisplayName: string | null;
  farseerPfpUrl: string | null;
  customLabel: string | null;
  addedAt: Date;
  lastSyncedAt: Date;
}

export interface ActivityEntry {
  id: string;
  farseer_fid: number;
  target_fid: number;
  target_username: string | null;
  target_display_name: string | null;
  target_pfp_url: string | null;
  target_bio: string | null;
  target_follower_count: number | null;
  followed_at: Date;
  ingested_at: Date;
  source: string;
  farseer_username: string | null;
  farseer_display_name: string | null;
  farseer_pfp_url: string | null;
  custom_label: string | null;
  follow_rank: number;
}

export interface ConfluenceAlert {
  id: string;
  watchlistId: string;
  targetFid: number;
  targetUsername: string | null;
  targetPfpUrl: string | null;
  farseerCount: number;
  farseerFids: string;
  thresholdMet: number;
  isRead: boolean;
  readAt: Date | null;
  notifiedAt: Date;
}

export interface AlertSeer {
  farseerFid: number;
  farseerUsername: string | null;
  farseerDisplayName: string | null;
  farseerPfpUrl: string | null;
}

export interface ConfluenceAlertWithWatchlist extends ConfluenceAlert {
  watchlist_name?: string;
  seers?: AlertSeer[];
}
