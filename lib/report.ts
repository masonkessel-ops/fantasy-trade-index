import "server-only";
import { getValueBoard } from "./values";
import { getWaiverTrends, getWeeklyRankings, type TrendingRow, type WeeklyRow } from "./weekly";
import type { PlayerValue, Position, Scoring } from "./types";

export interface ReportPlayer {
  id: string;
  name: string;
  position: Position;
  team: string | null;
  value: number | null;
  /** short reason line, e.g. "+6 this week" or "21.3 last 3 vs 15.0 ROS" */
  note: string;
}

export interface WeeklyReport {
  week: number;
  season: string;
  risers: ReportPlayer[];
  fallers: ReportPlayer[];
  buyLow: ReportPlayer[];
  sellHigh: ReportPlayer[];
  adds: ReportPlayer[];
  projected: Record<"QB" | "RB" | "WR" | "TE", ReportPlayer[]>;
}

const fromValue = (p: PlayerValue, note: string): ReportPlayer => ({ id: p.id, name: p.name, position: p.position, team: p.team, value: p.value, note });
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

/** Everything in this week's newsletter, built from the live data. */
export async function getWeeklyReport(scoring: Scoring): Promise<WeeklyReport> {
  const [board, trends, weekly] = await Promise.all([getValueBoard(scoring), getWaiverTrends(scoring), getWeeklyRankings(scoring)]);
  const ps = board.players;
  const movers = ps.filter((p) => p.change !== null && p.value >= 55);
  const risers = [...movers].sort((a, b) => b.change! - a.change!).slice(0, 5).map((p) => fromValue(p, `+${p.change} this week · ${p.recentPpg ?? p.ppg} PPG lately`));
  const fallers = [...movers].sort((a, b) => a.change! - b.change!).slice(0, 5).map((p) => fromValue(p, `${p.change} this week${p.injuryStatus ? ` · ${p.injuryStatus}` : ""}`));
  const buyLow = ps
    .filter((p) => p.change !== null && p.change <= -2 && p.value >= 65 && p.rosPpg >= p.ppg * 0.95 && !p.injuryStatus)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
    .map((p) => fromValue(p, `Value down ${Math.abs(p.change!)}, but projected for ${p.rosPpg} PPG the rest of the way`));
  const sellHigh = ps
    .filter((p) => p.change !== null && p.change >= 1 && p.recentPpg !== null && p.recentPpg > p.rosPpg * 1.15 && p.value >= 55)
    .sort((a, b) => b.change! - a.change!)
    .slice(0, 4)
    .map((p) => fromValue(p, `${p.recentPpg} PPG lately vs ${p.rosPpg} projected the rest of the way`));
  const adds = trends.adds.slice(0, 6).map((r: TrendingRow) => ({
    id: r.id,
    name: r.name,
    position: r.position,
    team: r.team,
    value: r.value,
    note: `Added in ${fmt(r.count)} leagues${r.proj ? ` · ${r.proj} proj ${r.opponent ?? ""}` : ""}`.trim(),
  }));
  const top = (pos: Position) =>
    weekly.rows
      .filter((r: WeeklyRow) => r.position === pos)
      .slice(0, 3)
      .map((r) => ({ id: r.id, name: r.name, position: r.position, team: r.team, value: r.value, note: `${r.proj} proj ${r.opponent ?? ""}`.trim() }));
  return {
    week: weekly.week,
    season: board.season,
    risers,
    fallers,
    buyLow,
    sellHigh,
    adds,
    projected: { QB: top("QB"), RB: top("RB"), WR: top("WR"), TE: top("TE") },
  };
}
