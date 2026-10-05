/**
 * ============================================================================
 *  TRADE VALUE FORMULA  (1 – 100)
 * ============================================================================
 *  Everything that decides a player's trade value lives in this file.
 *  Tweak the constants in the "KNOBS" section and the whole site updates.
 *
 *  How it works
 *  ------------
 *  1. PRODUCTION factors (scored 0–1, comparable across positions):
 *       seasonPpg     – fantasy points per game this season, regressed toward
 *                       the projection when a player has only a few games
 *       recentForm    – points per game over the last 3 weeks played
 *       restOfSeason  – projected points over replacement for the rest of the season
 *       scarcity      – how hard the player is to replace at his position
 *
 *     Points are measured *over replacement level* (the Nth-best player at the
 *     position, see REPLACEMENT_RANK). That's what makes an RB1 worth more than
 *     a QB1 who scores more raw points: there are plenty of decent QBs.
 *
 *  2. MODIFIER factors (scored 0–1) that can only shave value off:
 *       age           – distance past the position's age peak
 *       byeWeek       – an upcoming bye costs you a week of production
 *
 *     A player who scores 0 on a modifier loses exactly that modifier's weight,
 *     e.g. an old RB (age score 0) loses 10% of his value with age = 0.10.
 *
 *  3. INJURY multiplier on top (Out = 0.65×, IR = 0.4×, …), and a discount
 *     for streamable positions (K, DST).
 *
 *  4. The best player is scaled to 100; everyone else is relative to him.
 * ============================================================================
 */
import type { Position } from "./types";

/* ============================== KNOBS ==================================== */

/** Factor weights. They should add up to 1.0. */
export const WEIGHTS = {
  // production
  seasonPpg: 0.3,
  recentForm: 0.15,
  restOfSeason: 0.25,
  scarcity: 0.15,
  // modifiers
  age: 0.1,
  byeWeek: 0.05,
} as const;

/**
 * Replacement level = the player at this rank at each position. Points above
 * this rank are what actually win you weeks. Defaults assume a 12-team league
 * (1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX, 1 K, 1 DST + a bench cushion).
 */
export const REPLACEMENT_RANK: Record<Position, number> = {
  QB: 14,
  RB: 32,
  WR: 38,
  TE: 14,
  K: 13,
  DST: 13,
};

/** How scarce each position is league-wide (1 = scarcest). Feeds the scarcity factor. */
export const POSITION_SCARCITY: Record<Position, number> = {
  RB: 1,
  WR: 0.85,
  TE: 0.8,
  QB: 0.55,
  DST: 0.15,
  K: 0.1,
};

/**
 * Positions you can stream off waivers each week are worth less in trades.
 * Multiplies the final score (1 = no discount).
 */
export const STREAMABLE_DISCOUNT: Record<Position, number> = {
  QB: 1,
  RB: 1,
  WR: 1,
  TE: 1,
  K: 0.35,
  DST: 0.4,
};

/**
 * Points-per-game credit given to a player sitting exactly at replacement
 * level. Players below replacement taper toward 0 instead of all being
 * worth "1", so bench depth still separates.
 */
export const DEPTH_CREDIT = 1.5;

/**
 * Age curve per position. Full credit up to `peak`, declining linearly to 0 at
 * `cliff`. (Kickers and defenses don't age in a way that matters here.)
 */
export const AGE_CURVE: Record<Position, { peak: number; cliff: number } | null> = {
  QB: { peak: 32, cliff: 40 },
  RB: { peak: 26, cliff: 31 },
  WR: { peak: 28, cliff: 34 },
  TE: { peak: 29, cliff: 35 },
  K: null,
  DST: null,
};

/** Sleeper injury_status -> value multiplier. Anything not listed = healthy (1.0). */
export const INJURY_MULTIPLIER: Record<string, number> = {
  Questionable: 0.93,
  Doubtful: 0.78,
  Out: 0.65,
  Sus: 0.65,
  PUP: 0.45,
  IR: 0.4,
  NA: 0.6,
};

/**
 * Small-sample regression: season PPG is blended with the rest-of-season
 * projection as if the projection were this many extra games. Early in the
 * season this stops one huge game from dominating.
 */
export const PROJECTION_PRIOR_GAMES = 2;

/** Bye week score by how many weeks away it is (bye already passed = 1). */
export function byeScore(byeWeek: number | null, currentWeek: number): number {
  if (byeWeek === null || byeWeek <= currentWeek) return 1;
  const weeksAway = byeWeek - currentWeek;
  if (weeksAway <= 1) return 0;
  if (weeksAway <= 3) return 0.4;
  return 0.7;
}

/** Exponent applied to the final 0–1 score before scaling to 1–100. <1 spreads out the middle. */
export const VALUE_CURVE = 0.75;

/** Changes whenever a knob above changes, so cached values refresh immediately. */
export const FORMULA_KEY = JSON.stringify([
  WEIGHTS, REPLACEMENT_RANK, POSITION_SCARCITY, AGE_CURVE, INJURY_MULTIPLIER, PROJECTION_PRIOR_GAMES, VALUE_CURVE,
  STREAMABLE_DISCOUNT, DEPTH_CREDIT,
  byeScore.toString(),
]);

/* ============================ ENGINE ===================================== */

export interface ValueInput {
  id: string;
  position: Position;
  age: number | null;
  injuryStatus: string | null;
  gamesPlayed: number;
  /** raw season fantasy points per game (0 if no games) */
  seasonPpg: number;
  /** points per game over the last 3 weeks the player played in, null if none */
  recentPpg: number | null;
  /** projected points per remaining game */
  rosPpg: number;
  /** projected remaining games */
  rosGames: number;
  byeWeek: number | null;
}

export interface ValueResult {
  id: string;
  value: number;
  posRank: number;
  /** each factor's 0–1 score, plus injury multiplier, for the breakdown UI */
  breakdown: Record<keyof typeof WEIGHTS | "injury", number>;
}

const PRODUCTION_KEYS = ["seasonPpg", "recentForm", "restOfSeason", "scarcity"] as const;

/** Points over replacement, with a small tapering credit below replacement. */
function overReplacement(x: number, repl: number) {
  if (x >= repl) return x - repl + DEPTH_CREDIT;
  if (repl <= 0 || x <= 0) return 0;
  return DEPTH_CREDIT * Math.pow(x / repl, 3);
}

function replacementLevel(values: number[], rank: number) {
  const sorted = [...values].sort((a, b) => b - a);
  return sorted[Math.min(rank, sorted.length) - 1] ?? 0;
}

function ageScore(position: Position, age: number | null) {
  const curve = AGE_CURVE[position];
  if (!curve) return 1;
  if (age === null) return 0.8;
  if (age <= curve.peak) return 1;
  return Math.max(0, 1 - (age - curve.peak) / (curve.cliff - curve.peak));
}

export function computeTradeValues(inputs: ValueInput[], currentWeek: number): ValueResult[] {
  // 1. Per-player metrics before replacement adjustment.
  const metrics = inputs.map((p) => {
    const blendedPpg =
      (p.seasonPpg * p.gamesPlayed + p.rosPpg * PROJECTION_PRIOR_GAMES) /
      (p.gamesPlayed + PROJECTION_PRIOR_GAMES);
    return {
      p,
      season: blendedPpg,
      recent: p.recentPpg ?? blendedPpg,
      rosPpg: p.rosPpg,
    };
  });

  // 2. Replacement level per position for each metric.
  const byPos = new Map<Position, typeof metrics>();
  for (const m of metrics) {
    if (!byPos.has(m.p.position)) byPos.set(m.p.position, []);
    byPos.get(m.p.position)!.push(m);
  }
  const repl = new Map<Position, { season: number; recent: number; ros: number }>();
  for (const [pos, list] of byPos) {
    const r = REPLACEMENT_RANK[pos];
    repl.set(pos, {
      season: replacementLevel(list.map((m) => m.season), r),
      recent: replacementLevel(list.map((m) => m.recent), r),
      ros: replacementLevel(list.map((m) => m.rosPpg), r),
    });
  }

  // 3. Value over replacement, then normalise across ALL positions (max = 1).
  const vor = metrics.map((m) => {
    const r = repl.get(m.p.position)!;
    return {
      ...m,
      vSeason: overReplacement(m.season, r.season),
      vRecent: overReplacement(m.recent, r.recent),
      vRos: overReplacement(m.rosPpg, r.ros) * m.p.rosGames,
    };
  });
  const maxOf = (k: "vSeason" | "vRecent" | "vRos") => Math.max(1e-9, ...vor.map((v) => v[k]));
  const max = { season: maxOf("vSeason"), recent: maxOf("vRecent"), ros: maxOf("vRos") };

  // 4. Positional rank on combined production (used for scarcity).
  const prodScore = (v: (typeof vor)[number]) =>
    WEIGHTS.seasonPpg * (v.vSeason / max.season) +
    WEIGHTS.recentForm * (v.vRecent / max.recent) +
    WEIGHTS.restOfSeason * (v.vRos / max.ros) +
    // tie-breaker so players below replacement level still rank sensibly
    1e-4 * (v.season + v.rosPpg);
  const posRank = new Map<string, number>();
  for (const pos of byPos.keys()) {
    vor
      .filter((v) => v.p.position === pos)
      .sort((a, b) => prodScore(b) - prodScore(a))
      .forEach((v, i) => posRank.set(v.p.id, i + 1));
  }

  // 5. Combine.
  const productionWeight = PRODUCTION_KEYS.reduce((s, k) => s + WEIGHTS[k], 0);
  const raw = vor.map((v) => {
    const rank = posRank.get(v.p.id)!;
    const tier = Math.max(0, 1 - (rank - 1) / (REPLACEMENT_RANK[v.p.position] * 1.5));
    const scores = {
      seasonPpg: v.vSeason / max.season,
      recentForm: v.vRecent / max.recent,
      restOfSeason: v.vRos / max.ros,
      scarcity: POSITION_SCARCITY[v.p.position] * tier,
      age: ageScore(v.p.position, v.p.age),
      byeWeek: byeScore(v.p.byeWeek, currentWeek),
    };
    const production = PRODUCTION_KEYS.reduce((s, k) => s + WEIGHTS[k] * scores[k], 0) / productionWeight;
    const modifiers = productionWeight + WEIGHTS.age * scores.age + WEIGHTS.byeWeek * scores.byeWeek;
    const injury = (v.p.injuryStatus && INJURY_MULTIPLIER[v.p.injuryStatus]) || 1;
    const streamable = STREAMABLE_DISCOUNT[v.p.position];
    return { id: v.p.id, rank, score: production * modifiers * injury * streamable, scores: { ...scores, injury } };
  });

  // 6. Scale best player to 100.
  const top = Math.max(1e-9, ...raw.map((r) => r.score));
  return raw.map((r) => ({
    id: r.id,
    posRank: r.rank,
    value: Math.max(1, Math.round(100 * Math.pow(r.score / top, VALUE_CURVE))),
    breakdown: r.scores,
  }));
}

/** Friendly tier label for a value. */
export function valueTier(value: number): { label: string; tone: "elite" | "star" | "starter" | "flex" | "depth" } {
  if (value >= 85) return { label: "Elite", tone: "elite" };
  if (value >= 65) return { label: "Star", tone: "star" };
  if (value >= 45) return { label: "Starter", tone: "starter" };
  if (value >= 25) return { label: "Flex", tone: "flex" };
  return { label: "Depth", tone: "depth" };
}
