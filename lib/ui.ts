import type { Position } from "./types";

export const POS_COLOR: Record<Position, string> = {
  QB: "var(--color-qb)",
  RB: "var(--color-rb)",
  WR: "var(--color-wr)",
  TE: "var(--color-te)",
  K: "var(--color-k)",
  DST: "var(--color-dst)",
};

/** Colour for a 1–100 trade value by tier: Elite (fuchsia) → Star → Starter → Flex → Depth (slate). */
export function valueColor(value: number) {
  if (value >= 93) return "#e879f9";
  if (value >= 85) return "#a78bfa";
  if (value >= 76) return "#60a5fa";
  if (value >= 65) return "#2dd4bf";
  return "#8b8ba3";
}

export const INJURY_SHORT: Record<string, string> = {
  Questionable: "Q",
  Doubtful: "D",
  Out: "O",
  IR: "IR",
  PUP: "PUP",
  Sus: "SUS",
  NA: "NA",
};
