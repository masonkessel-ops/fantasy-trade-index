/**
 * Trade evaluation.
 *
 * Trades are judged on each player's trade weight ("power"): his share of the
 * best player's worth, blended with real trade-market values (lib/market.ts).
 *
 * Packages count for less than their sum. A side's best player counts in full;
 * every other player on that side only fills a lineup spot you could otherwise
 * fill from your bench, so he counts for his weight minus a bench player's
 * (PACKAGE_SPOT_COST, plus PACKAGE_STAR_COST × the best player in the deal: the
 * better the star, the more it takes to pry him loose). That's why two good
 * players don't add up to a great one, and a throw-in barely moves a deal.
 */
import type { PlayerValue } from "./types";

/** Lineup-spot charge for every player after a side's best one, in trade weight (about a bench starter). */
export const PACKAGE_SPOT_COST = 6;
/** Extra charge per extra player, as a share of the best player's weight in the whole trade (the star premium). */
export const PACKAGE_STAR_COST = 0.08;
/** An extra player never loses more than this share of his own weight (so throw-ins still count a little). */
export const PACKAGE_MAX_DISCOUNT = 0.75;

/** What a side is worth in a trade: the full weight of its best player plus the discounted rest. */
export function packageWeight(players: PlayerValue[], top: number) {
  const sorted = [...players].sort((a, b) => b.power - a.power);
  const raw = sorted.reduce((s, p) => s + p.power, 0);
  const charge = PACKAGE_SPOT_COST + PACKAGE_STAR_COST * top;
  const discount = sorted.slice(1).reduce((s, p) => s + Math.min(PACKAGE_MAX_DISCOUNT * p.power, charge), 0);
  return { raw, discount, total: raw - discount };
}

/** A trade is "fair" when sides are within this share of the bigger side's power… */
export const FAIR_PERCENT = 0.08;
/** …or within this many power points (keeps low-value swaps from flip-flopping). */
export const FAIR_ABSOLUTE = 2;

export type Verdict = "fair" | "win" | "lose" | "empty";

export interface TradeResult {
  /** sum of displayed values on each side (what users see) */
  rawGive: number;
  rawGet: number;
  /** trade weight on each side after the package discount (what the verdict uses) */
  adjGive: number;
  adjGet: number;
  /** how much the package discount took off each side (0 for a single player) */
  discountGive: number;
  discountGet: number;
  /** adjGet - adjGive in power points: positive = you win */
  diff: number;
  /** -1 … 1, your edge as a share of the bigger side (drives the meter) */
  balance: number;
  verdict: Verdict;
}

export function evaluateTrade(give: PlayerValue[], get: PlayerValue[]): TradeResult {
  const rawGive = give.reduce((s, p) => s + p.value, 0);
  const rawGet = get.reduce((s, p) => s + p.value, 0);
  const top = Math.max(0, ...give.map((p) => p.power), ...get.map((p) => p.power));
  const g = packageWeight(give, top);
  const t = packageWeight(get, top);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const adjGive = r1(g.total);
  const adjGet = r1(t.total);
  const diff = Math.round((adjGet - adjGive) * 10) / 10;
  const bigger = Math.max(adjGive, adjGet, 0.1);
  const balance = Math.max(-1, Math.min(1, diff / bigger));
  let verdict: Verdict;
  if (!give.length || !get.length) verdict = "empty";
  else if (Math.abs(balance) <= FAIR_PERCENT || Math.abs(diff) <= FAIR_ABSOLUTE) verdict = "fair";
  else verdict = diff > 0 ? "win" : "lose";
  return { rawGive, rawGet, adjGive, adjGet, discountGive: r1(g.discount), discountGet: r1(t.discount), diff, balance, verdict };
}

/** Letter grade for your side of a trade, from your edge (-1 … 1). B+ = dead even. */
export function tradeGrade(balance: number) {
  const grades: [number, string][] = [
    [0.2, "A+"],
    [0.1, "A"],
    [0.04, "A-"],
    [-0.04, "B+"],
    [-0.08, "B"],
    [-0.12, "B-"],
    [-0.18, "C"],
    [-0.28, "D"],
  ];
  return grades.find(([min]) => balance >= min)?.[1] ?? "F";
}

/** Color for a grade: green for A's, violet for B's, amber for C, red for D/F. */
export function gradeTone(grade: string) {
  return grade.startsWith("A") ? "var(--color-up)" : grade.startsWith("B") ? "var(--color-rocket)" : grade === "C" ? "var(--color-flame)" : "var(--color-down)";
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
