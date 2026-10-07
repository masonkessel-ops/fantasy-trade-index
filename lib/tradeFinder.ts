/**
 * Interactive trade finder (runs in the browser, no API calls).
 *  - shopPlayers: "I'd trade away X (and Y) — what can I get?"
 *  - findOffers:  "I want Z — what should I offer?"
 *
 * Fairness uses the same market-calibrated trade weights as the Trade Analyzer,
 * and every idea stays close to even so the other manager would say yes.
 * Lineup effects are measured in projected points per week (PlayerValue.weekly).
 * Roster rules, like a real fantasy team:
 *  - a trade can't leave one of your starting slots empty,
 *  - with an imported league, it can't weaken the other team's lineup either (they'd never accept),
 *  - getting more players than you send means dropping someone (flagged on the card).
 * Ideas that make both lineups better rank first.
 */
import { tradeRiskReward } from "./risk";
import { SLOT_LABEL, bestLineup } from "./teamAnalysis";
import { evaluateTrade } from "./tradeAnalysis";
import type { PlayerValue } from "./types";

/** Best edge we'll suggest: small enough that the other manager still sees a fair deal. */
export const MAX_EDGE = 0.06;
/** When shopping a player, don't suggest selling him for less than this (you're the seller). */
export const MAX_SHOP_DISCOUNT = 0.06;
/** Most you should overpay when making an offer for a player you want. */
export const MAX_OVERPAY = 0.12;
/** Offers that cost your starting lineup more than this many projected points a week are left out. */
export const MAX_LINEUP_LOSS = 4;
/** In a league, a trade that costs the other team's lineup more than this (points a week) is a tough sell. */
export const MAX_PARTNER_LOSS = 0.5;
/** Ranking cost (points a week) of each extra player you take back: a roster spot, and a drop. */
const EXTRA_PLAYER_COST = 0.6;
/** How much taking on extra risk (0–1 scale) lowers an idea's ranking, in points a week. */
const RISK_PENALTY = 2.5;
/** Ranking cost of a lopsided deal (per 100% of edge either way): even deals get accepted. */
const LOPSIDED_COST = 8;

export interface FinderPool {
  rosterId: number | null;
  teamName: string;
  roster: PlayerValue[];
}

export interface FinderIdea {
  give: string[];
  get: string[];
  partner: { rosterId: number | null; teamName: string } | null;
  /** change in your starting lineup's projected points per week */
  lineupGain: number;
  /** change in the other team's starting lineup, points per week (league trades only) */
  theirGain: number | null;
  /** your edge, -1 … 1 (positive = you win) */
  balance: number;
  /** players you get minus players you send (positive = you'd have to drop someone) */
  rosterChange: number;
  /** why the other team might say no (only when you named the player you want) */
  theirConcern: string | null;
}

const isFlexPos = (p: PlayerValue) => p.position !== "K" && p.position !== "DST";

/** Best lineup by projected points a week, its total, and any slots it can't fill. */
export function lineupPoints(roster: PlayerValue[], rosterPositions: string[]) {
  const { starters } = bestLineup(roster, rosterPositions, (p) => p.weekly);
  const empty = starters.filter((x) => !x.player).map((x) => SLOT_LABEL[x.slot] ?? x.slot);
  return { points: starters.reduce((s, x) => s + (x.player?.weekly ?? 0), 0), empty };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * A package shouldn't be padded with filler: every player in a multi-player side must be worth
 * at least a fifth of the deal's best player (and more than a bench body). Otherwise it's really
 * a smaller trade with a throw-in nobody wants to roster.
 */
function hasFiller(give: PlayerValue[], get: PlayerValue[]) {
  const top = Math.max(...give.map((p) => p.power), ...get.map((p) => p.power));
  const floor = Math.max(6, 0.2 * top);
  return [give, get].some((side) => side.length > 1 && side.some((p) => p.power < floor));
}

/** Both lineups get better: the kind of deal the other manager actually accepts. */
export const isWinWin = (lineupGain: number, theirGain: number | null) => theirGain !== null && lineupGain > 0 && theirGain > 0;

/** Ranking credit for helping both lineups (points a week): a deal both managers want beats one only you like. */
export function bothWin(mine: number, theirs: number | null) {
  return theirs === null ? mine : mine + 0.8 * theirs + Math.min(mine, theirs);
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
  const before = lineupPoints(mine, rp);
  const after = lineupPoints([...without(mine, give), ...get], rp);
  if (after.empty.length > before.empty.length) return null; // would leave one of your starting slots empty
  let theirGain: number | null = null;
  let theirConcern: string | null = null;
  if (partner && partner.rosterId !== null) {
    const tb = lineupPoints(partner.roster, rp);
    const ta = lineupPoints([...without(partner.roster, get), ...give], rp);
    theirGain = r1(ta.points - tb.points);
    if (ta.empty.length > tb.empty.length) theirConcern = `They'd have no starting ${ta.empty.find((x) => !tb.empty.includes(x)) ?? ta.empty[0]} left, so they'd want one back.`;
    else if (theirGain < -MAX_PARTNER_LOSS) theirConcern = "It weakens their starting lineup, so expect them to ask for a bit more.";
    if (strict && theirConcern) return null;
  }
  return { lineupGain: r1(after.points - before.points), theirGain, theirConcern };
}

/** `getCount`: only deals where you get back exactly this many players (e.g. 2 for a 1-for-2). */
export function shopPlayers(give: PlayerValue[], mine: PlayerValue[], pools: FinderPool[], rosterPositions: string[], limit = 9, getCount: number | null = null): FinderIdea[] {
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
    const sizes = getCount ? [getCount] : [1, 2];
    for (const size of sizes) {
      const top = size === 1 ? cands : cands.slice(0, size === 2 ? (market ? 45 : 18) : market ? 24 : 14);
      for (const get of combos(top, size)) {
        if (hasFiller(give, get)) continue;
        const t = evaluateTrade(give, get);
        if (t.balance < -MAX_SHOP_DISCOUNT || t.balance > MAX_EDGE) continue;
        const r = rosterCheck(give, get, mine, rosterPositions, pool, true);
        if (!r) continue;
        const risk = tradeRiskReward(give, get)?.riskChange ?? 0;
        const extra = Math.max(0, get.length - give.length);
        const score = bothWin(r.lineupGain, r.theirGain) - Math.abs(t.balance) * LOPSIDED_COST - extra * EXTRA_PLAYER_COST - risk * RISK_PENALTY;
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
    else for (const n of sizes) ideas.push(...perPartner.filter((i) => i.get.length === n).slice(0, limit * 2));
  }
  return dedupe(ideas, limit);
}

/** `giveCount`: only offers of exactly this many of your players (e.g. 2 for a 2-for-1). */
export function findOffers(target: PlayerValue[], mine: PlayerValue[], rosterPositions: string[], partner: FinderPool | null, limit = 6, giveCount: number | null = null): FinderIdea[] {
  if (!target.length) return [];
  const wantsSpecial = target.some((p) => !isFlexPos(p));
  const pool = mine.filter((p) => wantsSpecial || isFlexPos(p)).sort((a, b) => b.power - a.power).slice(0, 14);
  const ideas: (FinderIdea & { score: number })[] = [];
  for (const size of giveCount ? [giveCount] : [1, 2, 3]) {
    for (const give of combos(pool, size)) {
      if (hasFiller(give, target)) continue;
      const t = evaluateTrade(give, target);
      // They need to see it as fair (or a small win for them); don't overpay a lot.
      if (t.balance > MAX_EDGE || t.balance < -MAX_OVERPAY) continue;
      const r = rosterCheck(give, target, mine, rosterPositions, partner, false);
      if (!r || r.lineupGain < -MAX_LINEUP_LOSS) continue;
      const risk = tradeRiskReward(give, target)?.riskChange ?? 0;
      // Overpaying a little is fine (it gets the deal done); squeezing them isn't.
      const lopsided = Math.abs(t.balance) * LOPSIDED_COST * (t.balance < 0 ? 0.5 : 1);
      const score = bothWin(r.lineupGain, r.theirGain) - lopsided - (r.theirConcern ? 1.5 : 0) - (size - 1) * 0.3 - risk * RISK_PENALTY;
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

export interface DealShape {
  give: number;
  get: number;
}

/**
 * "Show me good 2-for-1s": every fair deal of one shape between your roster and the
 * other rosters (or the whole chart), best fit for your lineup first. Consolidation
 * deals (2-for-1, 3-for-1) must bring back someone better than anyone you send;
 * splits (1-for-2, 1-for-3) must send someone better than anyone you get.
 */
export function packageDeals(mine: PlayerValue[], pools: FinderPool[], rosterPositions: string[], shape: DealShape, wantPos: string | null = null, limit = 9): FinderIdea[] {
  const mineIds = new Set(mine.map((p) => p.id));
  const myPool = mine.filter(isFlexPos).sort((a, b) => b.power - a.power).slice(0, 12);
  const giveCombos = combos(myPool, shape.give);
  const sum = (ps: PlayerValue[]) => ps.reduce((s, p) => s + p.power, 0);
  const best = (ps: PlayerValue[]) => Math.max(...ps.map((p) => p.power));
  const ideas: (FinderIdea & { score: number })[] = [];

  for (const pool of pools) {
    const market = pool.rosterId === null;
    const all = pool.roster.filter((p) => !mineIds.has(p.id) && isFlexPos(p) && (!wantPos || p.position === wantPos)).sort((a, b) => b.power - a.power);
    const perPartner: (FinderIdea & { score: number })[] = [];
    for (const give of giveCombos) {
      const giveSum = sum(give);
      const giveBest = best(give);
      // Only players in the right value range for this package: a consolidation brings back
      // someone better than anyone you send; a split brings back players worth about a share each.
      const each = giveSum / shape.get;
      const local = all
        .filter((p) => (shape.get === 1 ? p.power > giveBest && p.power <= giveSum * 1.35 : p.power < giveBest && p.power >= each * 0.35 && p.power <= each * 1.8))
        .slice(0, market ? (shape.get === 1 ? 30 : shape.get === 2 ? 24 : 16) : 16);
      for (const get of combos(local, shape.get)) {
        const getSum = sum(get);
        if (getSum < giveSum * 0.55 || getSum > giveSum * 1.6 || hasFiller(give, get)) continue; // nowhere near fair, or padded
        const t = evaluateTrade(give, get);
        if (t.balance < -MAX_SHOP_DISCOUNT || t.balance > MAX_EDGE) continue;
        const r = rosterCheck(give, get, mine, rosterPositions, pool, true);
        if (!r || r.lineupGain < 0) continue; // a package should make your lineup better
        const risk = tradeRiskReward(give, get)?.riskChange ?? 0;
        const score = bothWin(r.lineupGain, r.theirGain) - Math.abs(t.balance) * LOPSIDED_COST - risk * RISK_PENALTY;
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
    ideas.push(...perPartner.slice(0, market ? limit * 4 : 3));
  }

  // Best first; don't repeat a deal or lean on the same player more than twice on either side.
  ideas.sort((a, b) => b.score - a.score);
  const uses = new Map<string, number>();
  const seen = new Set<string>();
  const out: FinderIdea[] = [];
  for (const { score: _score, ...i } of ideas) {
    void _score;
    const key = `${i.give.join()}>${i.get.join()}`;
    const all = [...i.give, ...i.get];
    if (seen.has(key) || all.some((id) => (uses.get(id) ?? 0) >= 2)) continue;
    seen.add(key);
    for (const id of all) uses.set(id, (uses.get(id) ?? 0) + 1);
    out.push(i);
    if (out.length >= limit) break;
  }
  return out;
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
