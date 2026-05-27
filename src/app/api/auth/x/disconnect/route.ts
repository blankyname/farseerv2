import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/neynar-db-sdk/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { fid } = (await req.json().catch(() => ({}))) as { fid?: number };
  if (!fid || !Number.isInteger(fid)) {
    return NextResponse.json({ error: "fid required" }, { status: 400 });
  }
  await db
    .update(users)
    .set({
      xUserId: null,
      xHandle: null,
      xAccessToken: null,
      xRefreshToken: null,
      xTokenExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.fid, fid));
  return NextResponse.json({ ok: true });
}
