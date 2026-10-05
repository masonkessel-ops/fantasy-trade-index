/**
 * Trade evaluation. Raw value sums overrate "2 quarters for a dollar" deals —
 * in fantasy, one star beats two average players because roster spots and
 * starting slots are limited. So each extra player on a side counts for a
 * little less (CONSOLIDATION_WEIGHTS).
 */
import type { PlayerValue } from "./types";

/** Weight of the 1st, 2nd, 3rd… most valuable player on each side of a trade. */
export const CONSOLIDATION_WEIGHTS = [1, 0.85, 0.7, 0.6, 0.5];

/** Trades within this many adjusted points (or this % of the bigger side) are "fair". */
export const FAIR_ABSOLUTE = 5;
export const FAIR_PERCENT = 0.08;

export function adjustedValue(values: number[]) {
  return [...values]
    .sort((a, b) => b - a)
    .reduce((sum, v, i) => sum + v * (CONSOLIDATION_WEIGHTS[i] ?? CONSOLIDATION_WEIGHTS.at(-1)!), 0);
}

export type Verdict = "fair" | "win" | "lose" | "empty";

export interface TradeResult {
  rawGive: number;
  rawGet: number;
  adjGive: number;
  adjGet: number;
  /** adjGet - adjGive: positive = you win */
  diff: number;
  /** -1 … 1, how lopsided relative to the bigger side (for the meter) */
  balance: number;
  verdict: Verdict;
}

export function evaluateTrade(give: PlayerValue[], get: PlayerValue[]): TradeResult {
  const rawGive = give.reduce((s, p) => s + p.value, 0);
  const rawGet = get.reduce((s, p) => s + p.value, 0);
  const adjGive = Math.round(adjustedValue(give.map((p) => p.value)));
  const adjGet = Math.round(adjustedValue(get.map((p) => p.value)));
  const diff = adjGet - adjGive;
  const bigger = Math.max(adjGive, adjGet, 1);
  const balance = Math.max(-1, Math.min(1, diff / bigger));
  let verdict: Verdict;
  if (!give.length || !get.length) verdict = "empty";
  else if (Math.abs(diff) <= Math.max(FAIR_ABSOLUTE, bigger * FAIR_PERCENT)) verdict = "fair";
  else verdict = diff > 0 ? "win" : "lose";
  return { rawGive, rawGet, adjGive, adjGet, diff, balance, verdict };
}

export interface Balancer {
  player: PlayerValue;
  /** which side the player should be added to */
  side: "give" | "get";
  newDiff: number;
}

/**
 * Find players that, added to the short side, bring the trade closest to even.
 * `pools` lets the caller restrict candidates to the right rosters.
 */
export function suggestBalancers(
  give: PlayerValue[],
  get: PlayerValue[],
  pools: { give: PlayerValue[]; get: PlayerValue[] },
  limit = 3,
): Balancer[] {
  const { diff } = evaluateTrade(give, get);
  if (!give.length || !get.length || Math.abs(diff) <= FAIR_ABSOLUTE) return [];
  // diff > 0: you receive more, so you should add to what you give (and vice versa).
  const side: "give" | "get" = diff > 0 ? "give" : "get";
  const inTrade = new Set([...give, ...get].map((p) => p.id));
  const pool = pools[side].filter((p) => !inTrade.has(p.id));
  return pool
    .map((player) => {
      const r = side === "give" ? evaluateTrade([...give, player], get) : evaluateTrade(give, [...get, player]);
      return { player, side, newDiff: r.diff };
    })
    .filter((b) => Math.abs(b.newDiff) < Math.abs(diff))
    .sort((a, b) => Math.abs(a.newDiff) - Math.abs(b.newDiff) || b.player.value - a.player.value)
    .slice(0, limit);
}
