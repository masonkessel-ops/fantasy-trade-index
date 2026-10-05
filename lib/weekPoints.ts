import "server-only";
import { PLAY_CHANCE } from "./advice";
import { getNflState, getPlayers, getScores, getWeekProjections, getWeekStats } from "./sleeper";
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

/** This week's actual + projected points for a list of players. */
export async function getWeekPoints(ids: string[], scoring: Scoring) {
  const { season, week } = await getNflState();
  const [players, stats, proj, scores] = await Promise.all([
    getPlayers(),
    getWeekStats(season, week),
    getWeekProjections(season, week),
    getScores(season, week),
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
  return { week, points: out };
}
