import { NextResponse, type NextRequest } from "next/server";
import { randomBytes, createHash } from "crypto";

const PKCE_COOKIE = "x_oauth_pkce";

function appUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.NEXT_PUBLIC_VERCEL_PRODUCTION_URL)
    return `https://${process.env.NEXT_PUBLIC_VERCEL_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export async function GET(req: NextRequest) {
  const fid = req.nextUrl.searchParams.get("fid");
  if (!fid || !/^\d+$/.test(fid)) {
    return NextResponse.json({ error: "fid required" }, { status: 400 });
  }

  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "X_CLIENT_ID not configured" }, { status: 500 });
  }

  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: `${appUrl()}/api/auth/x/callback`,
    scope: "tweet.read users.read follows.read offline.access",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  const res = NextResponse.redirect(`https://twitter.com/i/oauth2/authorize?${params}`);
  res.cookies.set(PKCE_COOKIE, `${verifier}.${state}.${fid}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
