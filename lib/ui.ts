import type { Position } from "./types";

export const POS_COLOR: Record<Position, string> = {
  QB: "var(--color-qb)",
  RB: "var(--color-rb)",
  WR: "var(--color-wr)",
  TE: "var(--color-te)",
  K: "var(--color-k)",
  DST: "var(--color-dst)",
};

/** Colour for a 1–100 trade value: hot orange at the top, cooling to slate. */
export function valueColor(value: number) {
  if (value >= 85) return "#ff5a2c";
  if (value >= 65) return "#ffb21e";
  if (value >= 45) return "#2ee8ff";
  if (value >= 25) return "#7c8cff";
  return "#6b7690";
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
