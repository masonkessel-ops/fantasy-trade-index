import "server-only";
import { PLAY_CHANCE } from "./advice";
import { memo } from "./memo";
import { REGULAR_SEASON_WEEKS, getNflState, getPlayers, getScores, getTrending, getWeekProjections } from "./sleeper";
import { getValueBoard } from "./values";
import type { Position, Scoring } from "./types";

/** How many players per position the weekly rankings list. */
const RANK_LIMIT: Record<Position, number> = { QB: 36, RB: 72, WR: 96, TE: 36, K: 32, DST: 32 };

export interface WeeklyRow {
  id: string;
  name: string;
  position: Position;
  team: string | null;
  injuryStatus: string | null;
  /** projected fantasy points this week (adjusted for injury status) */
  proj: number;
  /** e.g. "vs BUF" / "@ KC" */
  opponent: string | null;
  /** 1-100 trade value, if the player is on the chart */
  value: number | null;
  posRank: number;
}

/** The week people are planning for: next week once most of this week's games are done. */
async function planWeek() {
  const { season, week } = await getNflState();
  const scores = await getScores(season, week);
  const stillToPlay = scores.filter((g) => g.state === "pre").length;
  const plan = week < REGULAR_SEASON_WEEKS && stillToPlay <= scores.length / 4 ? week + 1 : week;
  return { season, week: plan, scores: plan === week ? scores : await getScores(season, plan) };
}

/** Everyone ranked by projected points for the week, by position. */
export function getWeeklyRankings(scoring: Scoring) {
  return memo(`weekly:${scoring}`, 10 * 60_000, async () => {
    const { season, week, scores } = await planWeek();
    const [players, proj, board] = await Promise.all([getPlayers(), getWeekProjections(season, week), getValueBoard(scoring)]);
    const values = new Map(board.players.map((p) => [p.id, p.value]));
    const opp = new Map<string, string>();
    for (const g of scores) {
      opp.set(g.home, `vs ${g.away}`);
      opp.set(g.away, `@ ${g.home}`);
    }
    const rows: WeeklyRow[] = [];
    for (const [id, line] of Object.entries(proj)) {
      const p = players[id];
      if (!p || !line.played || !p.team || !opp.has(p.team)) continue; // on bye or not playing
      const pts = Math.round(line.pts[scoring] * (PLAY_CHANCE[p.injuryStatus ?? ""] ?? 1) * 10) / 10;
      if (pts < 1) continue;
      rows.push({ id, name: p.name, position: p.position, team: p.team, injuryStatus: p.injuryStatus, proj: pts, opponent: opp.get(p.team) ?? null, value: values.get(id) ?? null, posRank: 0 });
    }
    rows.sort((a, b) => b.proj - a.proj);
    const count: Partial<Record<Position, number>> = {};
    const kept = rows.filter((r) => {
      const n = (count[r.position] = (count[r.position] ?? 0) + 1);
      r.posRank = n;
      return n <= RANK_LIMIT[r.position];
    });
    return { season, week, rows: kept };
  });
}

export interface TrendingRow {
  id: string;
  name: string;
  position: Position;
  team: string | null;
  injuryStatus: string | null;
  count: number;
  value: number | null;
  proj: number | null;
  opponent: string | null;
}

/** Sleeper's most added and most dropped players in the last 24 hours, with values and this week's projection. */
export function getWaiverTrends(scoring: Scoring) {
  return memo(`trending:${scoring}`, 10 * 60_000, async () => {
    const [adds, drops, players, board, weekly] = await Promise.all([
      getTrending("add"),
      getTrending("drop"),
      getPlayers(),
      getValueBoard(scoring),
      getWeeklyRankings(scoring),
    ]);
    const values = new Map(board.players.map((p) => [p.id, p.value]));
    const projected = new Map(weekly.rows.map((r) => [r.id, r]));
    const rows = (list: typeof adds): TrendingRow[] =>
      list
        .map(({ id, count }) => {
          const p = players[id];
          if (!p) return null;
          const w = projected.get(id);
          return { id, name: p.name, position: p.position, team: p.team, injuryStatus: p.injuryStatus, count, value: values.get(id) ?? null, proj: w?.proj ?? null, opponent: w?.opponent ?? null };
        })
        .filter((r): r is TrendingRow => !!r);
    return { week: weekly.week, adds: rows(adds), drops: rows(drops) };
  });
}
