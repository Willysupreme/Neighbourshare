import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#f1e6c8",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "620px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "28px" }}>
            <svg width="56" height="56" viewBox="0 0 32 32" style={{ marginRight: "16px" }}>
              <g transform="translate(16,16)">
                <circle r="5" fill="#1a1611" />
                <line x1="0" y1="0" x2="0" y2="-13" stroke="#1a1611" strokeWidth="2" strokeLinecap="round" />
                <line x1="0" y1="0" x2="9.2" y2="-9.2" stroke="#1a1611" strokeWidth="2" strokeLinecap="round" />
                <line x1="0" y1="0" x2="13" y2="0" stroke="#1a1611" strokeWidth="2" strokeLinecap="round" />
                <line x1="0" y1="0" x2="9.2" y2="9.2" stroke="#1a1611" strokeWidth="2" strokeLinecap="round" />
                <line x1="0" y1="0" x2="0" y2="13" stroke="#1a1611" strokeWidth="2" strokeLinecap="round" />
                <line x1="0" y1="0" x2="-9.2" y2="9.2" stroke="#1a1611" strokeWidth="2" strokeLinecap="round" />
                <line x1="0" y1="0" x2="-13" y2="0" stroke="#1a1611" strokeWidth="2" strokeLinecap="round" />
                <line x1="0" y1="0" x2="-9.2" y2="-9.2" stroke="#1a1611" strokeWidth="2" strokeLinecap="round" />
              </g>
            </svg>
            <div style={{ display: "flex", fontSize: "48px", fontWeight: 700, color: "#1a1611" }}>
              Neighbor<span style={{ color: "#a6790a" }}>Share</span>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: "28px", color: "#1a1611", opacity: 0.75, lineHeight: 1.4 }}>
            A web of trust, woven between neighbors.
          </div>
        </div>

        <svg width="380" height="380" viewBox="0 0 400 400">
          {[-90, -45, 0, 45, 90, 135, 180, 225].map((deg, i) => {
            const angle = (deg * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={200}
                y1={200}
                x2={200 + 175 * Math.cos(angle)}
                y2={200 + 175 * Math.sin(angle)}
                stroke="#b8a878"
                strokeWidth="1.5"
              />
            );
          })}
          {[55, 95, 135, 175].map((r) => (
            <polygon
              key={r}
              points={[-90, -45, 0, 45, 90, 135, 180, 225]
                .map((deg) => {
                  const angle = (deg * Math.PI) / 180;
                  return `${200 + r * Math.cos(angle)},${200 + r * Math.sin(angle)}`;
                })
                .join(" ")}
              fill="none"
              stroke="#b8a878"
              strokeWidth="1.5"
            />
          ))}
          <circle cx="200" cy="200" r="14" fill="#1a1611" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
