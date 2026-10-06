/**
 * Interactive trade finder (runs in the browser, no API calls).
 *  - shopPlayers: "I'd trade away X (and Y) — what can I get?"
 *  - findOffers:  "I want Z — what should I offer?"
 *
 * Fairness uses the same market-calibrated trade weights as the Trade Analyzer.
 * Roster rules, like a real fantasy team:
 *  - a trade can't leave one of your starting slots empty,
 *  - with an imported league, it can't gut the other team's lineup either (they'd never accept),
 *  - getting more players than you send means dropping someone (flagged on the card).
 */
import { tradeRiskReward } from "./risk";
import { SLOT_LABEL, bestLineup } from "./teamAnalysis";
import { evaluateTrade } from "./tradeAnalysis";
import type { PlayerValue } from "./types";

/** Best edge we'll suggest when shopping: stays inside the "fair" band so the other side would accept. */
export const MAX_EDGE = 0.1;
/** When shopping a player, don't suggest selling him for less than this (you're the seller). */
export const MAX_SHOP_DISCOUNT = 0.06;
/** Edge beyond this doesn't rank an idea higher (a fair deal that fits your lineup beats squeezing them). */
const EDGE_CREDIT_CAP = 0.05;
/** Most you should overpay when making an offer for a player you want. */
export const MAX_OVERPAY = 0.15;
/** Offers that cost your starting lineup more than this much value are left out. */
export const MAX_LINEUP_LOSS = 30;
/** In a league, trades that cost the other team's starting lineup more than this are a tough sell. */
export const MAX_PARTNER_LOSS = 8;
/** Ranking cost of each extra player you take back (a roster spot, and a drop). */
const EXTRA_PLAYER_COST = 4;
/** How much taking on extra risk (0–1 scale) lowers an idea's ranking. */
export const RISK_PENALTY = 25;

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
  /** change in the other team's starting lineup (league trades only) */
  theirGain: number | null;
  /** your edge, -1 … 1 (positive = you win) */
  balance: number;
  /** players you get minus players you send (positive = you'd have to drop someone) */
  rosterChange: number;
  /** why the other team might say no (only when you named the player you want) */
  theirConcern: string | null;
}

const isFlexPos = (p: PlayerValue) => p.position !== "K" && p.position !== "DST";

function lineup(roster: PlayerValue[], rosterPositions: string[]) {
  const { starters } = bestLineup(roster, rosterPositions);
  const empty = starters.filter((x) => !x.player).map((x) => SLOT_LABEL[x.slot] ?? x.slot);
  return { value: starters.reduce((s, x) => s + (x.player?.value ?? 0), 0), empty };
}

const without = (roster: PlayerValue[], out: PlayerValue[]) => {
  const ids = new Set(out.map((p) => p.id));
  return roster.filter((p) => !ids.has(p.id));
};

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

/**
 * Lineup effects of a trade for both sides; null when it breaks a roster rule.
 * `strict`: the other team's problems rule a trade out (shopping, where there are plenty of other ideas).
 * Otherwise they're kept as a concern to show (you asked for a specific player).
 */
function rosterCheck(give: PlayerValue[], get: PlayerValue[], mine: PlayerValue[], rp: string[], partner: FinderPool | null, strict: boolean) {
  const before = lineup(mine, rp);
  const after = lineup([...without(mine, give), ...get], rp);
  if (after.empty.length > before.empty.length) return null; // would leave one of your starting slots empty
  let theirGain: number | null = null;
  let theirConcern: string | null = null;
  if (partner && partner.rosterId !== null) {
    const tb = lineup(partner.roster, rp);
    const ta = lineup([...without(partner.roster, get), ...give], rp);
    theirGain = Math.round(ta.value - tb.value);
    if (ta.empty.length > tb.empty.length) theirConcern = `They'd have no starting ${ta.empty.find((x) => !tb.empty.includes(x)) ?? ta.empty[0]} left, so they'd want one back.`;
    else if (theirGain < -MAX_PARTNER_LOSS) theirConcern = "It weakens their starting lineup, so expect them to ask for a bit more.";
    if (strict && theirConcern) return null;
  }
  return { lineupGain: Math.round(after.value - before.value), theirGain, theirConcern };
}

export function shopPlayers(give: PlayerValue[], mine: PlayerValue[], pools: FinderPool[], rosterPositions: string[], limit = 9): FinderIdea[] {
  if (!give.length) return [];
  const mineIds = new Set(mine.map((p) => p.id));
  const givePower = give.reduce((s, p) => s + p.power, 0);
  const wantsSpecial = give.some((p) => !isFlexPos(p));
  const ideas: (FinderIdea & { score: number })[] = [];

  for (const pool of pools) {
    const market = pool.rosterId === null;
    const cands = pool.roster
      .filter((p) => !mineIds.has(p.id) && (wantsSpecial || isFlexPos(p)) && p.power <= givePower * 1.2)
      .sort((a, b) => b.power - a.power)
      .slice(0, market ? 90 : 18);
    const perPartner: (FinderIdea & { score: number })[] = [];
    for (const size of [1, 2]) {
      for (const get of combos(size === 1 ? cands : cands.slice(0, market ? 45 : 18), size)) {
        const t = evaluateTrade(give, get);
        if (t.balance < -MAX_SHOP_DISCOUNT || t.balance > MAX_EDGE) continue;
        const r = rosterCheck(give, get, mine, rosterPositions, pool, true);
        if (!r) continue;
        const risk = tradeRiskReward(give, get)?.riskChange ?? 0;
        const extra = Math.max(0, get.length - give.length);
        const score = Math.min(t.balance, EDGE_CREDIT_CAP) * 60 + r.lineupGain + 0.4 * (r.theirGain ?? 0) - extra * EXTRA_PLAYER_COST - risk * RISK_PENALTY;
        perPartner.push({
          give: give.map((p) => p.id),
          get: get.map((p) => p.id),
          partner: market ? null : { rosterId: pool.rosterId, teamName: pool.teamName },
          lineupGain: r.lineupGain,
          theirGain: r.theirGain,
          balance: t.balance,
          rosterChange: get.length - give.length,
          theirConcern: null,
          score,
        });
      }
    }
    perPartner.sort((a, b) => b.score - a.score);
    if (!market) ideas.push(...perPartner.slice(0, 2));
    else for (const n of [1, 2]) ideas.push(...perPartner.filter((i) => i.get.length === n).slice(0, limit * 2));
  }
  return dedupe(ideas, limit);
}

export function findOffers(target: PlayerValue[], mine: PlayerValue[], rosterPositions: string[], partner: FinderPool | null, limit = 6): FinderIdea[] {
  if (!target.length) return [];
  const wantsSpecial = target.some((p) => !isFlexPos(p));
  const pool = mine.filter((p) => wantsSpecial || isFlexPos(p)).sort((a, b) => b.power - a.power).slice(0, 14);
  const ideas: (FinderIdea & { score: number })[] = [];
  for (const size of [1, 2, 3]) {
    for (const give of combos(pool, size)) {
      const t = evaluateTrade(give, target);
      // They need to see it as fair (or a small win for them); don't overpay a lot.
      if (t.balance > MAX_EDGE || t.balance < -MAX_OVERPAY) continue;
      const r = rosterCheck(give, target, mine, rosterPositions, partner, false);
      if (!r || r.lineupGain < -MAX_LINEUP_LOSS) continue;
      const risk = tradeRiskReward(give, target)?.riskChange ?? 0;
      const score = r.lineupGain + t.balance * 30 + 0.4 * (r.theirGain ?? 0) - (r.theirConcern ? 10 : 0) - (size - 1) * 2 - risk * RISK_PENALTY;
      ideas.push({
        give: give.map((p) => p.id),
        get: target.map((p) => p.id),
        partner: partner ? { rosterId: partner.rosterId, teamName: partner.teamName } : null,
        lineupGain: r.lineupGain,
        theirGain: r.theirGain,
        balance: t.balance,
        rosterChange: target.length - give.length,
        theirConcern: r.theirConcern,
        score,
      });
    }
  }
  return dedupe(ideas, limit, "give");
}

/**
 * Best ideas first, without repeating a combo, leaning on the same player more than twice,
 * or filling the list with one shape of deal (e.g. all 2-for-1s) when others are close.
 */
function dedupe(ideas: (FinderIdea & { score: number })[], limit: number, key: "get" | "give" = "get") {
  ideas.sort((a, b) => b.score - a.score);
  const maxPerShape = Math.ceil(limit * 0.6);
  const seen = new Set<string>();
  const uses = new Map<string, number>();
  const shapes = new Map<string, number>();
  const picked: (FinderIdea & { score: number })[] = [];
  for (const pass of [0, 1]) {
    for (const i of ideas) {
      if (picked.length >= limit) break;
      const k = i[key].join(",");
      const shape = `${i.give.length}-${i.get.length}`;
      if (seen.has(k) || i[key].some((id) => (uses.get(id) ?? 0) >= 2)) continue;
      // First pass keeps the mix varied; the second fills any space left.
      if (pass === 0 && (shapes.get(shape) ?? 0) >= maxPerShape) continue;
      seen.add(k);
      shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
      for (const id of i[key]) uses.set(id, (uses.get(id) ?? 0) + 1);
      picked.push(i);
    }
  }
  return picked.sort((a, b) => b.score - a.score).map(({ score: _score, ...i }) => (void _score, i));
}
