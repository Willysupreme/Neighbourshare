import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f1e6c8",
        }}
      >
        <svg width="130" height="130" viewBox="0 0 32 32">
          <g transform="translate(16,16)">
            <circle r="5.5" fill="#1a1611" />
            <line x1="0" y1="0" x2="0" y2="-13" stroke="#1a1611" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="0" y1="0" x2="9.2" y2="-9.2" stroke="#1a1611" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="0" y1="0" x2="13" y2="0" stroke="#1a1611" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="0" y1="0" x2="9.2" y2="9.2" stroke="#1a1611" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="0" y1="0" x2="0" y2="13" stroke="#1a1611" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="0" y1="0" x2="-9.2" y2="9.2" stroke="#1a1611" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="0" y1="0" x2="-13" y2="0" stroke="#1a1611" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="0" y1="0" x2="-9.2" y2="-9.2" stroke="#1a1611" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
