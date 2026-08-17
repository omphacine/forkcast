import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const fredokaBold = await readFile(
    join(process.cwd(), "assets/Fredoka-Bold.ttf"),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#14264a",
          gap: 6,
        }}
      >
        <svg width="72" height="94" viewBox="54 15 91 117">
          <rect x="64" y="25" width="11" height="40" rx="5" fill="#f7f1e0" />
          <rect x="84" y="25" width="11" height="40" rx="5" fill="#f7f1e0" />
          <rect x="104" y="25" width="11" height="40" rx="5" fill="#f7f1e0" />
          <rect x="124" y="25" width="11" height="40" rx="5" fill="#f7f1e0" />
          <path d="M64,63 L135,63 L110,85 L89,85 Z" fill="#f7f1e0" />
          <rect x="89" y="82" width="21" height="40" rx="10" fill="#c1272d" />
          <circle cx="99.5" cy="112" r="3" fill="#f7f1e0" />
        </svg>
        <div
          style={{
            display: "flex",
            fontFamily: "Fredoka",
            fontSize: 26,
            fontWeight: 700,
            color: "#f7f1e0",
            letterSpacing: -0.5,
          }}
        >
          ForkCast
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fredoka", data: fredokaBold, style: "normal", weight: 700 },
      ],
    },
  );
}
