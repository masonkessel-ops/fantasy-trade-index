import "server-only";
import { getNflState } from "./sleeper";
import { getWeekPoints } from "./weekPoints";
import type { Scoring } from "./types";

/**
 * Your head-to-head this week in a Sleeper league: the starters each manager
 * actually set, the official live score (league scoring), what's still to come
 * from projections, and a win probability that tightens as games finish.
 */
export interface MatchupSide {
  rosterId: number;
  /** official points so far (your league's scoring) */
  points: number;
  /** points so far + projections for whoever hasn't finished */
  projected: number;
  starters: { id: string; points: number | null; projected: number | null; state: "pre" | "live" | "final" | "bye" }[];
  /** starters yet to finish their game */
  left: number;
}

export interface Matchup {
  week: number;
  me: MatchupSide;
  them: MatchupSide;
  /** 0–1 */
  winChance: number;
  final: boolean;
}

interface RawMatchup {
  roster_id: number;
  matchup_id: number | null;
  starters: string[];
  points: number;
  players_points?: Record<string, number>;
}

/** Standard normal CDF (Abramowitz–Stegun), for win probability. */
function phi(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/** How uncertain a starter's remaining points are (share of his projection, as a standard deviation). */
const SPREAD = { pre: 0.5, live: 0.35 };

export async function getMatchup(leagueId: string, rosterId: number, scoring: Scoring): Promise<Matchup | null> {
  const { week } = await getNflState();
  const res = await fetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/matchups/${week}`, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Sleeper matchups ${res.status}`);
  const rows = ((await res.json()) ?? []) as RawMatchup[];
  const mine = rows.find((r) => r.roster_id === rosterId);
  const theirs = mine?.matchup_id ? rows.find((r) => r.matchup_id === mine.matchup_id && r.roster_id !== rosterId) : undefined;
  if (!mine || !theirs) return null;

  const ids = [...mine.starters, ...theirs.starters].filter((id) => id && id !== "0");
  const { points } = await getWeekPoints(ids, scoring);
  const side = (r: RawMatchup) => {
    let projected = 0;
    let variance = 0;
    let left = 0;
    const starters = r.starters
      .filter((id) => id && id !== "0")
      .map((id) => {
        const w = points[id];
        const actual = r.players_points?.[id] ?? w?.actual ?? 0;
        const proj = w?.projected ?? 0;
        const state = w?.state ?? "pre";
        if (state === "final" || state === "bye") projected += actual;
        else if (state === "live") {
          // About half the game is left on average; credit half of what's still projected.
          const rest = Math.max(0, proj - actual) * 0.5;
          projected += actual + rest;
          variance += (SPREAD.live * Math.max(proj, 1)) ** 2 * 0.5;
          left++;
        } else {
          projected += proj;
          variance += (SPREAD.pre * proj) ** 2;
          left++;
        }
        return { id, points: state === "pre" ? null : Math.round(actual * 10) / 10, projected: w?.projected ?? null, state };
      });
    // Empty starting slots score nothing; Sleeper's official total wins over our sum when games are done.
    const official = Math.round(r.points * 10) / 10;
    return { rosterId: r.roster_id, points: official, projected: Math.round(Math.max(projected, official) * 10) / 10, starters, left, variance };
  };
  const me = side(mine);
  const them = side(theirs);
  const final = me.left === 0 && them.left === 0;
  const sd = Math.sqrt(me.variance + them.variance);
  const winChance = final ? (me.points > them.points ? 1 : me.points < them.points ? 0 : 0.5) : sd > 0 ? phi((me.projected - them.projected) / sd) : 0.5;
  const strip = ({ variance: _v, ...s }: typeof me): MatchupSide => (void _v, s);
  return { week, me: strip(me), them: strip(them), winChance: Math.round(winChance * 1000) / 1000, final };
}
