/**
 * Trade evaluation.
 *
 * Displayed values (1–100) are compressed so good players read 70+, which
 * would make "two 70s for a 100" look fair. It isn't, so trades are judged
 * on each player's linear trade *power* (proportional to production) instead.
 * On top of that, each extra player on a side counts for a little less
 * (CONSOLIDATION_WEIGHTS), because one star beats two role players when
 * roster spots and starting slots are limited.
 */
import type { PlayerValue } from "./types";

/** Weight of the 1st, 2nd, 3rd… most valuable player on each side of a trade. */
export const CONSOLIDATION_WEIGHTS = [1, 0.85, 0.7, 0.6, 0.5];

/** A trade is "fair" when sides are within this share of the bigger side's power… */
export const FAIR_PERCENT = 0.1;
/** …or within this many power points (keeps low-value swaps from flip-flopping). */
export const FAIR_ABSOLUTE = 2;

export function adjustedPower(powers: number[]) {
  return [...powers]
    .sort((a, b) => b - a)
    .reduce((sum, v, i) => sum + v * (CONSOLIDATION_WEIGHTS[i] ?? CONSOLIDATION_WEIGHTS.at(-1)!), 0);
}

export type Verdict = "fair" | "win" | "lose" | "empty";

export interface TradeResult {
  /** sum of displayed values on each side (what users see) */
  rawGive: number;
  rawGet: number;
  /** consolidation-adjusted trade power on each side (what the verdict uses) */
  adjGive: number;
  adjGet: number;
  /** adjGet - adjGive in power points: positive = you win */
  diff: number;
  /** -1 … 1, your edge as a share of the bigger side (drives the meter) */
  balance: number;
  verdict: Verdict;
}

export function evaluateTrade(give: PlayerValue[], get: PlayerValue[]): TradeResult {
  const rawGive = give.reduce((s, p) => s + p.value, 0);
  const rawGet = get.reduce((s, p) => s + p.value, 0);
  const adjGive = Math.round(adjustedPower(give.map((p) => p.power)) * 10) / 10;
  const adjGet = Math.round(adjustedPower(get.map((p) => p.power)) * 10) / 10;
  const diff = Math.round((adjGet - adjGive) * 10) / 10;
  const bigger = Math.max(adjGive, adjGet, 0.1);
  const balance = Math.max(-1, Math.min(1, diff / bigger));
  let verdict: Verdict;
  if (!give.length || !get.length) verdict = "empty";
  else if (Math.abs(balance) <= FAIR_PERCENT || Math.abs(diff) <= FAIR_ABSOLUTE) verdict = "fair";
  else verdict = diff > 0 ? "win" : "lose";
  return { rawGive, rawGet, adjGive, adjGet, diff, balance, verdict };
}

/** "+12% in your favor" style label for a trade's edge. */
export function edgeLabel(r: TradeResult) {
  const pct = Math.round(Math.abs(r.balance) * 100);
  if (pct === 0) return "Dead even";
  return `${pct}% ${r.balance > 0 ? "in your favor" : "against you"}`;
}

export interface Balancer {
  player: PlayerValue;
  /** which side the player should be added to */
  side: "give" | "get";
  /** your edge after adding this player (-1 … 1) */
  newBalance: number;
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
  const { diff, verdict } = evaluateTrade(give, get);
  if (!give.length || !get.length || verdict === "fair") return [];
  // diff > 0: you receive more, so you should add to what you give (and vice versa).
  const side: "give" | "get" = diff > 0 ? "give" : "get";
  const inTrade = new Set([...give, ...get].map((p) => p.id));
  const pool = pools[side].filter((p) => !inTrade.has(p.id));
  return pool
    .map((player) => {
      const r = side === "give" ? evaluateTrade([...give, player], get) : evaluateTrade(give, [...get, player]);
      return { player, side, newBalance: r.balance, newDiff: r.diff };
    })
    .filter((b) => Math.abs(b.newDiff) < Math.abs(diff))
    .sort((a, b) => Math.abs(a.newDiff) - Math.abs(b.newDiff) || b.player.value - a.player.value)
    .map(({ player, side, newBalance }) => ({ player, side, newBalance }))
    .slice(0, limit);
}
