import { ImageResponse } from "next/og";
import { Mark } from "./icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "#050912" }}>
        <Mark size={150} />
      </div>
    ),
    size,
  );
}
