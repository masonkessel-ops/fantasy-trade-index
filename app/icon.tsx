import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The logo mark: rising index bars on the violet → blue brand gradient. */
export default function Icon() {
  return new ImageResponse(<Mark size={64} />, size);
}

export function Mark({ size: s }: { size: number }) {
  const u = s / 32;
  const bar = (x: number, y: number, h: number) => (
    <div style={{ position: "absolute", left: x * u, top: y * u, width: 4 * u, height: h * u, borderRadius: 1.2 * u, background: "#fff" }} />
  );
  return (
    <div
      style={{
        width: s,
        height: s,
        display: "flex",
        position: "relative",
        borderRadius: s * 0.28,
        background: "linear-gradient(45deg, #2563eb, #7c3aed)",
      }}
    >
      {bar(7.5, 18, 7)}
      {bar(14, 13.5, 11.5)}
      {bar(20.5, 9, 16)}
    </div>
  );
}
