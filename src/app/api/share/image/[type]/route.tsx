import { NextRequest } from "next/server";
import { publicConfig } from "@/config/public-config";
import { getShareImageResponse } from "@/neynar-farcaster-sdk/nextjs";

export const revalidate = 3600;

const { appEnv, heroImageUrl, imageUrl } = publicConfig;
const showDevWarning = appEnv !== "production";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  const { searchParams } = new URL(request.url);
  const personalize = searchParams.get("personalize") === "true";

  // Optional signal count for personalised share (e.g. ?signals=7)
  const signalCount = searchParams.get("signals");
  const username = searchParams.get("username");

  const overlay =
    personalize && signalCount ? (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0a0f 0%, #12101e 100%)",
          fontFamily: "sans-serif",
          padding: "40px",
        }}
      >
        {/* Logo row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "#4f46e5",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <span style={{ color: "white", fontSize: 32, fontWeight: 700 }}>
            Farseer
          </span>
        </div>

        {/* Signal count */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "rgba(79,70,229,0.15)",
            border: "1px solid rgba(79,70,229,0.4)",
            borderRadius: 24,
            padding: "32px 48px",
            marginBottom: "24px",
          }}
        >
          <span
            style={{ color: "#a5b4fc", fontSize: 20, marginBottom: 8 }}
          >
            caught
          </span>
          <span style={{ color: "#f59e0b", fontSize: 80, fontWeight: 800, lineHeight: 1 }}>
            {signalCount}
          </span>
          <span
            style={{ color: "#a5b4fc", fontSize: 20, marginTop: 8 }}
          >
            confluence signal{parseInt(signalCount) !== 1 ? "s" : ""}
          </span>
        </div>

        {username && (
          <span style={{ color: "#64748b", fontSize: 18 }}>
            @{username}
          </span>
        )}

        <span style={{ color: "#6366f1", fontSize: 18, marginTop: 16 }}>
          Smart money signals decoded
        </span>
      </div>
    ) : null;

  return getShareImageResponse(
    { type, heroImageUrl, imageUrl, showDevWarning, personalize },
    overlay,
  );
}
