import { NextRequest, NextResponse } from "next/server";

interface WarpcastItem {
  type: string;
  item: {
    fid: number;
    username: string;
    displayName?: string;
    pfp?: { url: string };
    followerCount?: number;
  };
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const res = await fetch(
      `https://client.warpcast.com/v2/starter-pack?id=${encodeURIComponent(id)}`,
      {
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Starter pack not found" }, { status: 404 });
    }

    const data = await res.json();
    const sp = data?.result?.starterPack;
    if (!sp) return NextResponse.json({ error: "Invalid response" }, { status: 404 });

    const users = (sp.items ?? [])
      .filter((item: WarpcastItem) => item.type === "account")
      .map((item: WarpcastItem) => ({
        fid: item.item.fid,
        username: item.item.username,
        display_name: item.item.displayName ?? item.item.username,
        pfp_url: item.item.pfp?.url ?? null,
        follower_count: item.item.followerCount ?? null,
      }));

    return NextResponse.json({
      id: sp.id,
      name: sp.name,
      description: sp.description ?? "",
      totalCount: sp.itemCount ?? users.length,
      users,
    });
  } catch (err) {
    console.error("[starter-pack]", err);
    return NextResponse.json({ error: "Failed to fetch starter pack" }, { status: 500 });
  }
}
