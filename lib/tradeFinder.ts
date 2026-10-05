/**
 * Interactive trade finder (runs in the browser, no API calls).
 *  - shopPlayers: "I'd trade away X (and Y) — what can I get?"
 *  - findOffers:  "I want Z — what should I offer?"
 * Fairness uses the same trade-power math as the Trade Analyzer.
 */
import { bestLineup } from "./teamAnalysis";
import { evaluateTrade } from "./tradeAnalysis";
import type { PlayerValue } from "./types";

export interface FinderPool {
  rosterId: number | null;
  teamName: string;
  roster: PlayerValue[];
}

export interface FinderIdea {
  give: string[];
  get: string[];
  partner: { rosterId: number | null; teamName: string } | null;
  /** change in your starting lineup's total value */
  lineupGain: number;
  /** your edge, -1 … 1 (positive = you win) */
  balance: number;
}

/** Best edge we'll suggest when shopping: "good deal" but still something the other side might accept. */
export const MAX_EDGE = 0.15;
/** Most you should overpay when making an offer for a player you want. */
export const MAX_OVERPAY = 0.15;
/** Offers that cost your starting lineup more than this much value are left out. */
export const MAX_LINEUP_LOSS = 30;

const isFlexPos = (p: PlayerValue) => p.position !== "K" && p.position !== "DST";

function starterValue(roster: PlayerValue[], rosterPositions: string[]) {
  return bestLineup(roster, rosterPositions).starters.reduce((s, x) => s + (x.player?.value ?? 0), 0);
}

function combos<T>(items: T[], size: number): T[][] {
  if (size === 1) return items.map((x) => [x]);
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === size) return void out.push(acc);
    for (let i = start; i < items.length; i++) rec(i + 1, [...acc, items[i]]);
  };
  rec(0, []);
  return out;
}

export function shopPlayers(give: PlayerValue[], mine: PlayerValue[], pools: FinderPool[], rosterPositions: string[], limit = 9): FinderIdea[] {
  if (!give.length) return [];
  const mineIds = new Set(mine.map((p) => p.id));
  const giveIds = new Set(give.map((p) => p.id));
  const base = starterValue(mine, rosterPositions);
  const after = mine.filter((p) => !giveIds.has(p.id));
  const givePower = give.reduce((s, p) => s + p.power, 0);
  const wantsSpecial = give.some((p) => !isFlexPos(p));
  const ideas: (FinderIdea & { score: number })[] = [];

  for (const pool of pools) {
    const cands = pool.roster
      .filter((p) => !mineIds.has(p.id) && (wantsSpecial || isFlexPos(p)) && p.power <= givePower * 1.25)
      .sort((a, b) => b.value - a.value)
      .slice(0, pool.rosterId === null ? 90 : 18);
    const perPartner: (FinderIdea & { score: number })[] = [];
    for (const size of [1, 2]) {
      for (const get of combos(size === 1 ? cands : cands.slice(0, pool.rosterId === null ? 45 : 18), size)) {
        const t = evaluateTrade(give, get);
        if (t.verdict === "lose" || t.balance > MAX_EDGE) continue;
        const lineupGain = Math.round(starterValue([...after, ...get], rosterPositions) - base);
        const score = t.balance * 60 + lineupGain - (size - 1) * 2;
        perPartner.push({ give: give.map((p) => p.id), get: get.map((p) => p.id), partner: pool.rosterId === null ? null : { rosterId: pool.rosterId, teamName: pool.teamName }, lineupGain, balance: t.balance, score });
      }
    }
    perPartner.sort((a, b) => b.score - a.score);
    ideas.push(...perPartner.slice(0, pool.rosterId === null ? limit * 2 : 2));
  }
  return dedupe(ideas, limit);
}

export function findOffers(target: PlayerValue[], mine: PlayerValue[], rosterPositions: string[], partner: FinderPool | null, limit = 6): FinderIdea[] {
  if (!target.length) return [];
  const base = starterValue(mine, rosterPositions);
  const wantsSpecial = target.some((p) => !isFlexPos(p));
  const pool = mine.filter((p) => wantsSpecial || isFlexPos(p)).sort((a, b) => b.value - a.value).slice(0, 14);
  const ideas: (FinderIdea & { score: number })[] = [];
  for (const size of [1, 2, 3]) {
    for (const give of combos(pool, size)) {
      const t = evaluateTrade(give, target);
      // They need to see it as fair (or a small win for them); don't overpay a lot.
      if (t.balance > 0.1 || t.balance < -MAX_OVERPAY) continue;
      const giveIds = new Set(give.map((p) => p.id));
      const lineupGain = Math.round(starterValue([...mine.filter((p) => !giveIds.has(p.id)), ...target], rosterPositions) - base);
      if (lineupGain < -MAX_LINEUP_LOSS) continue; // would gut your lineup (e.g. trading your only QB)
      const score = lineupGain + t.balance * 30 - (size - 1) * 2;
      ideas.push({ give: give.map((p) => p.id), get: target.map((p) => p.id), partner: partner ? { rosterId: partner.rosterId, teamName: partner.teamName } : null, lineupGain, balance: t.balance, score });
    }
  }
  return dedupe(ideas, limit, "give");
}

/** Best ideas first, without repeating a combo or leaning on the same player more than twice. */
function dedupe(ideas: (FinderIdea & { score: number })[], limit: number, key: "get" | "give" = "get") {
  ideas.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const uses = new Map<string, number>();
  const out: FinderIdea[] = [];
  for (const i of ideas) {
    const k = i[key].join(",");
    if (seen.has(k) || i[key].some((id) => (uses.get(id) ?? 0) >= 2)) continue;
    seen.add(k);
    for (const id of i[key]) uses.set(id, (uses.get(id) ?? 0) + 1);
    out.push({ give: i.give, get: i.get, partner: i.partner, lineupGain: i.lineupGain, balance: i.balance });
    if (out.length >= limit) break;
  }
  return out;
}
