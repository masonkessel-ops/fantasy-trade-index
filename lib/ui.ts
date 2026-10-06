import type { Position } from "./types";

export const POS_COLOR: Record<Position, string> = {
  QB: "var(--color-qb)",
  RB: "var(--color-rb)",
  WR: "var(--color-wr)",
  TE: "var(--color-te)",
  K: "var(--color-k)",
  DST: "var(--color-dst)",
};

/** Colour for a 1–100 trade value by tier: Elite (gold) → Star (blue) → Starter (cyan) → Flex (violet) → Depth (slate). */
export function valueColor(value: number) {
  if (value >= 93) return "#facc15";
  if (value >= 85) return "#60a5fa";
  if (value >= 76) return "#22d3ee";
  if (value >= 65) return "#a78bfa";
  return "#8494ad";
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
