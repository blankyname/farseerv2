/**
 * Format a date as a relative time string (e.g. "3h ago", "2d ago")
 */
export function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format a future date as "in Xh Ym"
 */
export function formatTimeUntil(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return "Updating soon…";
  const diffMin = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (hours === 0) return `in ${mins}m`;
  return `in ${hours}h ${mins}m`;
}

/**
 * Returns the next sync Date: either 00:00 UTC or 12:00 UTC, whichever is sooner.
 */
export function getNextSyncTime(): Date {
  const now = new Date();

  const todayMidnight = new Date(now);
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const todayNoon = new Date(now);
  todayNoon.setUTCHours(12, 0, 0, 0);

  const candidates = [
    todayMidnight,
    todayNoon,
    new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000),
    new Date(todayNoon.getTime() + 24 * 60 * 60 * 1000),
  ];

  const future = candidates
    .filter((d) => d.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());

  return future[0] ?? new Date(now.getTime() + 12 * 60 * 60 * 1000);
}

/**
 * Format a countdown duration in ms as HH:MM:SS
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Truncate a string to a max length
 */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

/**
 * Parse comma-separated FID string to number array
 */
export function parseFids(fids: string): number[] {
  return fids
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}
