import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/neynar-db-sdk/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const PKCE_COOKIE = "x_oauth_pkce";

function appUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.NEXT_PUBLIC_VERCEL_PRODUCTION_URL)
    return `https://${process.env.NEXT_PUBLIC_VERCEL_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

function failRedirect(reason: string) {
  return NextResponse.redirect(`${appUrl()}/?x=err&reason=${encodeURIComponent(reason)}`);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) return failRedirect("missing_params");

  const cookie = req.cookies.get(PKCE_COOKIE)?.value;
  if (!cookie) return failRedirect("no_pkce_cookie");
  const [verifier, savedState, fidStr] = cookie.split(".");
  if (state !== savedState) return failRedirect("state_mismatch");
  const fid = Number(fidStr);
  if (!Number.isInteger(fid)) return failRedirect("bad_fid");

  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) return failRedirect("x_not_configured");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${appUrl()}/api/auth/x/callback`,
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) {
    console.error("[x/callback] token exchange failed", tokenRes.status, await tokenRes.text());
    return failRedirect("token_exchange");
  }
  const token = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const meRes = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!meRes.ok) return failRedirect("users_me");
  const me = (await meRes.json()) as { data: { id: string; username: string } };

  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000)
    : null;

  await db
    .update(users)
    .set({
      xUserId: me.data.id,
      xHandle: me.data.username,
      xAccessToken: token.access_token,
      xRefreshToken: token.refresh_token ?? null,
      xTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.fid, fid));

  const res = NextResponse.redirect(`${appUrl()}/?x=ok`);
  res.cookies.delete(PKCE_COOKIE);
  return res;
}
