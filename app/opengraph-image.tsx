import { ImageResponse } from "next/og";
import { Mark } from "./icon";

export const alt = "Fantasy Trade Index: fantasy football trade values, trade analyzer and lineup optimizer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview card for social apps and texts. */
export default function OpengraphImage() {
  const chip = (label: string) => (
    <div style={{ display: "flex", padding: "12px 24px", borderRadius: 999, border: "2px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)", fontSize: 30, color: "#e9e9f2" }}>
      {label}
    </div>
  );
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(900px 500px at 90% 0%, rgba(59,130,246,0.45), transparent 60%), radial-gradient(700px 400px at 0% 100%, rgba(250,204,21,0.14), transparent 60%), #050912",
          color: "#f4f4f8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Mark size={96} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, letterSpacing: 8, color: "#8fa0ba" }}>FANTASY</div>
            <div style={{ fontSize: 56, fontWeight: 800 }}>Trade Index</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>Win every trade.</div>
          <div style={{ fontSize: 34, color: "#b8b8cc" }}>Live 1–100 trade values, fair trade finder and an auto lineup that scores the most points.</div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {chip("Trade values")}
          {chip("Trade analyzer")}
          {chip("Trade finder")}
          {chip("Auto lineup")}
        </div>
      </div>
    ),
    size,
  );
}
