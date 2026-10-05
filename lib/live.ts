import "server-only";
import { getNflState, getPlayers, getScores, getWeekProjections, getWeekStats, type GameScore } from "./sleeper";
import { statLine } from "./statLine";
import type { Position, Scoring } from "./types";

/** A boom is beating projection by this many points AND by this ratio. Busts mirror it (game must be final). */
export const BOOM_MIN_POINTS = 7;
export const BOOM_MIN_RATIO = 1.4;
export const BUST_MAX_RATIO = 0.5;
/** Only judge booms/busts for players projected for at least this many points. */
export const BOOM_BUST_MIN_PROJECTION = 7;

export interface LivePlayer {
  id: string;
  name: string;
  position: Position;
  team: string;
  pts: number;
  proj: number | null;
  diff: number | null;
  line: string;
  gameState: GameScore["state"] | null;
}

export interface LiveGame extends GameScore {
  top: LivePlayer[];
}

export interface LiveWeek {
  season: string;
  week: number;
  currentWeek: number;
  scoring: Scoring;
  anyLive: boolean;
  updatedAt: number;
  games: LiveGame[];
  players: LivePlayer[];
  booms: LivePlayer[];
  busts: LivePlayer[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export async function getLiveWeek(scoring: Scoring, requestedWeek?: number): Promise<LiveWeek> {
  const state = await getNflState();
  const week = requestedWeek && requestedWeek >= 1 && requestedWeek <= state.week ? requestedWeek : state.week;
  const [players, stats, proj, scores] = await Promise.all([
    getPlayers(),
    getWeekStats(state.season, week),
    getWeekProjections(state.season, week),
    getScores(state.season, week),
  ]);

  const gameByTeam = new Map<string, GameScore>();
  for (const g of scores) {
    gameByTeam.set(g.home, g);
    gameByTeam.set(g.away, g);
  }

  const list: LivePlayer[] = [];
  for (const [id, line] of Object.entries(stats)) {
    const p = players[id];
    if (!p || !p.team || !line.played) continue;
    const pr = proj[id]?.played ? proj[id].pts[scoring] : null;
    const pts = r1(line.pts[scoring]);
    list.push({
      id,
      name: p.name,
      position: p.position,
      team: p.team,
      pts,
      proj: pr === null ? null : r1(pr),
      diff: pr === null ? null : r1(pts - pr),
      line: statLine(line.stats, p.position),
      gameState: gameByTeam.get(p.team)?.state ?? null,
    });
  }
  list.sort((a, b) => b.pts - a.pts);

  const games: LiveGame[] = scores
    .map((g) => ({
      ...g,
      top: list.filter((p) => (p.team === g.home || p.team === g.away) && p.position !== "DST" && p.position !== "K").slice(0, 2),
    }))
    .sort((a, b) => {
      const order = { live: 0, pre: 1, final: 2 } as const;
      return order[a.state] - order[b.state] || a.kickoff.localeCompare(b.kickoff);
    });

  const judged = list.filter((p) => p.proj !== null && p.proj >= BOOM_BUST_MIN_PROJECTION);
  const booms = judged
    .filter((p) => p.diff! >= BOOM_MIN_POINTS && p.pts >= p.proj! * BOOM_MIN_RATIO)
    .sort((a, b) => b.diff! - a.diff!)
    .slice(0, 8);
  const busts = judged
    .filter((p) => p.gameState === "final" && p.pts <= p.proj! * BUST_MAX_RATIO)
    .sort((a, b) => a.diff! - b.diff!)
    .slice(0, 8);

  return {
    season: state.season,
    week,
    currentWeek: state.week,
    scoring,
    anyLive: scores.some((g) => g.state === "live"),
    updatedAt: Date.now(),
    games,
    players: list,
    booms,
    busts,
  };
}
