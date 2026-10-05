import type { PlayerValue, Position } from "./types";

/** Sleeper roster slot names -> which positions can fill them. */
export const SLOT_ELIGIBLE: Record<string, Position[]> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  K: ["K"],
  DEF: ["DST"],
  FLEX: ["RB", "WR", "TE"],
  WRRB_FLEX: ["RB", "WR"],
  REC_FLEX: ["WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
};

export const SLOT_LABEL: Record<string, string> = {
  DEF: "DST",
  FLEX: "FLEX",
  WRRB_FLEX: "W/R",
  REC_FLEX: "W/T",
  SUPER_FLEX: "SF",
};

export interface LineupSlot {
  slot: string;
  player: PlayerValue | null;
}

/**
 * Best possible starting lineup: fill fixed slots first, then flex.
 * Ranks by trade value unless another `score` is given (e.g. this week's projection).
 */
export function bestLineup(
  players: PlayerValue[],
  rosterPositions: string[],
  score: (p: PlayerValue) => number = (p) => p.value,
) {
  const slots = rosterPositions.filter((s) => SLOT_ELIGIBLE[s]);
  const ordered = [...slots].sort((a, b) => SLOT_ELIGIBLE[a].length - SLOT_ELIGIBLE[b].length);
  const pool = [...players].sort((a, b) => score(b) - score(a));
  const used = new Set<string>();
  const filled = new Map<number, PlayerValue | null>();
  ordered.forEach((slot) => {
    const idx = slots.findIndex((s, i) => s === slot && !filled.has(i));
    const pick = pool.find((p) => !used.has(p.id) && SLOT_ELIGIBLE[slot].includes(p.position)) ?? null;
    if (pick) used.add(pick.id);
    filled.set(idx, pick);
  });
  const starters: LineupSlot[] = slots.map((slot, i) => ({ slot, player: filled.get(i) ?? null }));
  const bench = pool.filter((p) => !used.has(p.id));
  return { starters, bench };
}

export interface PositionStrength {
  position: Position;
  slots: number;
  mine: number;
  benchmark: number;
  /** mine / benchmark: 1.0 = league-average starters */
  ratio: number;
  grade: string;
  depth: number;
}

export function gradeFor(ratio: number) {
  if (ratio >= 1.5) return "A+";
  if (ratio >= 1.25) return "A";
  if (ratio >= 1.05) return "B";
  if (ratio >= 0.9) return "C";
  if (ratio >= 0.7) return "D";
  return "F";
}

export function gradeColor(grade: string) {
  if (grade.startsWith("A")) return "var(--color-up)";
  if (grade === "B") return "var(--color-volt)";
  if (grade === "C") return "var(--color-flame)";
  return "var(--color-down)";
}

const POS_ORDER: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

/**
 * Compare a roster's starters at each position against a league-average
 * starter. Benchmark for the k-th starter at a position = the median player at
 * that depth across the league (e.g. RB2 in a 12-team league ≈ the 18th RB).
 */
export function analyzeTeam(roster: PlayerValue[], board: PlayerValue[], rosterPositions: string[], teams = 12) {
  const dedicated = (pos: Position) => rosterPositions.filter((s) => SLOT_ELIGIBLE[s]?.length === 1 && SLOT_ELIGIBLE[s][0] === pos).length;
  const strengths: PositionStrength[] = [];
  for (const pos of POS_ORDER) {
    const slots = dedicated(pos);
    if (!slots) continue;
    const mineSorted = roster.filter((p) => p.position === pos).sort((a, b) => b.value - a.value);
    const boardSorted = board.filter((p) => p.position === pos).sort((a, b) => b.value - a.value);
    let mine = 0;
    let benchmark = 0;
    // Grades compare linear trade power (the displayed scale is compressed).
    let minePower = 0;
    let benchPower = 0;
    for (let k = 0; k < slots; k++) {
      const b = boardSorted[Math.min(boardSorted.length - 1, k * teams + Math.floor(teams / 2))];
      mine += mineSorted[k]?.value ?? 0;
      benchmark += b?.value ?? 1;
      minePower += mineSorted[k]?.power ?? 0;
      benchPower += b?.power ?? 0.1;
    }
    const ratio = minePower / Math.max(0.1, benchPower);
    const depth = mineSorted.slice(slots).reduce((s, p) => s + p.value, 0);
    strengths.push({ position: pos, slots, mine, benchmark, ratio, grade: gradeFor(ratio), depth });
  }

  const skill = strengths.filter((s) => !["K", "DST"].includes(s.position));
  const ranked = [...(skill.length ? skill : strengths)].sort((a, b) => b.ratio - a.ratio);
  const lineup = bestLineup(roster, rosterPositions);
  return {
    total: roster.reduce((s, p) => s + p.value, 0),
    starterTotal: lineup.starters.reduce((s, x) => s + (x.player?.value ?? 0), 0),
    strengths,
    strongest: ranked[0] ?? null,
    weakest: ranked[ranked.length - 1] ?? null,
    lineup,
  };
}
