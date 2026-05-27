import { NextResponse, type NextRequest } from "next/server";
import { searchXUser } from "@/lib/x-api";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ user: null });
  const user = await searchXUser(q);
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      xUserId: user.id,
      handle: user.username,
      displayName: user.name,
      pfpUrl: user.profile_image_url,
      bio: user.description,
      followerCount: user.public_metrics?.followers_count,
    },
  });
}
