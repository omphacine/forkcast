import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#14264a",
          borderRadius: 7,
        }}
      >
        <svg width="20" height="26" viewBox="54 15 91 117">
          <rect x="64" y="25" width="11" height="40" rx="5" fill="#f7f1e0" />
          <rect x="84" y="25" width="11" height="40" rx="5" fill="#f7f1e0" />
          <rect x="104" y="25" width="11" height="40" rx="5" fill="#f7f1e0" />
          <rect x="124" y="25" width="11" height="40" rx="5" fill="#f7f1e0" />
          <path d="M64,63 L135,63 L110,85 L89,85 Z" fill="#f7f1e0" />
          <rect x="89" y="82" width="21" height="40" rx="10" fill="#c1272d" />
          <circle cx="99.5" cy="112" r="3" fill="#f7f1e0" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
