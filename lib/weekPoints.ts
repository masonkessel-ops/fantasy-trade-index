import "server-only";
import { PLAY_CHANCE } from "./advice";
import { REGULAR_SEASON_WEEKS, getNflState, getPlayers, getScores, getWeekProjections, getWeekStats } from "./sleeper";
import type { Scoring } from "./types";

export interface PlayerWeek {
  /** points scored so far (null before kickoff) */
  actual: number | null;
  /** Sleeper projection, adjusted for injury status */
  projected: number | null;
  state: "pre" | "live" | "final" | "bye";
  opponent: string | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Actual + projected points for a list of players in one week. */
async function pointsForWeek(ids: string[], scoring: Scoring, season: string, week: number, scores: Awaited<ReturnType<typeof getScores>>, withStats: boolean) {
  const [players, stats, proj] = await Promise.all([
    getPlayers(),
    withStats ? getWeekStats(season, week) : Promise.resolve({} as Awaited<ReturnType<typeof getWeekStats>>),
    getWeekProjections(season, week),
  ]);
  const games = new Map<string, (typeof scores)[number]>();
  for (const g of scores) {
    games.set(g.home, g);
    games.set(g.away, g);
  }
  const out: Record<string, PlayerWeek> = {};
  for (const id of ids) {
    const p = players[id];
    if (!p) continue;
    const g = p.team ? games.get(p.team) : undefined;
    const projected = proj[id]?.played ? r1(proj[id].pts[scoring] * (PLAY_CHANCE[p.injuryStatus ?? ""] ?? 1)) : null;
    if (!g) {
      out[id] = { actual: null, projected: 0, state: "bye", opponent: null };
      continue;
    }
    const line = stats[id];
    out[id] = {
      actual: g.state === "pre" ? null : line?.played ? r1(line.pts[scoring]) : 0,
      projected,
      state: g.state,
      opponent: g.home === p.team ? `vs ${g.away}` : `@ ${g.home}`,
    };
  }
  return out;
}

/**
 * This week's actual + projected points for a list of players. Once most of the
 * week's games are done, also returns next week's projections (`plan`) for lineup planning.
 */
export async function getWeekPoints(ids: string[], scoring: Scoring) {
  const { season, week } = await getNflState();
  const scores = await getScores(season, week);
  const stillToPlay = scores.filter((g) => g.state === "pre").length;
  const planWeek = week < REGULAR_SEASON_WEEKS && stillToPlay <= scores.length / 4 ? week + 1 : week;
  const points = await pointsForWeek(ids, scoring, season, week, scores, true);
  const plan = planWeek === week ? null : { week: planWeek, points: await pointsForWeek(ids, scoring, season, planWeek, await getScores(season, planWeek), false) };
  return { week, points, plan };
}
