"use server";

/**
 * Server-side notification helper.
 * Calls the Neynar frame notifications REST endpoint directly —
 * no client hook needed since this runs in cron/API routes.
 */

const NEYNAR_NOTIFY_URL = "https://api.neynar.com/v2/farcaster/frame/notifications";

interface NotifyParams {
  targetFids: number[];
  title: string;
  body: string;
  frameUrl: string;
}

export async function sendFrameNotification({
  targetFids,
  title,
  body,
  frameUrl,
}: NotifyParams): Promise<boolean> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    console.warn("[notify] NEYNAR_API_KEY not set — skipping notification");
    return false;
  }

  if (targetFids.length === 0) return false;

  try {
    const res = await fetch(NEYNAR_NOTIFY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        title,
        body,
        target_url: frameUrl,
        target_fids: targetFids,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[notify] Failed (${res.status}): ${text}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[notify] Error:", err);
    return false;
  }
}
