import "server-only";
import { getLiveWeek, type LivePlayer } from "./live";
import type { Position, Scoring } from "./types";

/** Lineup slots for Team of the Week, in display order. */
export const TOTW_SLOTS: { slot: string; eligible: Position[] }[] = [
  { slot: "QB", eligible: ["QB"] },
  { slot: "RB1", eligible: ["RB"] },
  { slot: "RB2", eligible: ["RB"] },
  { slot: "WR1", eligible: ["WR"] },
  { slot: "WR2", eligible: ["WR"] },
  { slot: "TE", eligible: ["TE"] },
  { slot: "FLEX", eligible: ["RB", "WR", "TE"] },
  { slot: "K", eligible: ["K"] },
  { slot: "DST", eligible: ["DST"] },
];

export interface TotwSpot {
  slot: string;
  player: LivePlayer | null;
}

export interface TeamOfTheWeek {
  season: string;
  week: number;
  currentWeek: number;
  inProgress: boolean;
  total: number;
  lineup: TotwSpot[];
  mvp: string | null;
  honorable: LivePlayer[];
}

export async function getTeamOfTheWeek(scoring: Scoring, week?: number): Promise<TeamOfTheWeek> {
  const live = await getLiveWeek(scoring, week);
  const pool = [...live.players].sort((a, b) => b.pts - a.pts);
  const used = new Set<string>();
  // Fixed slots first, FLEX last: greedy is optimal because each fixed slot takes the best remaining at its position.
  const order = [...TOTW_SLOTS].sort((a, b) => a.eligible.length - b.eligible.length);
  const picks = new Map<string, LivePlayer | null>();
  for (const s of order) {
    const p = pool.find((x) => !used.has(x.id) && s.eligible.includes(x.position)) ?? null;
    if (p) used.add(p.id);
    picks.set(s.slot, p);
  }
  const lineup = TOTW_SLOTS.map((s) => ({ slot: s.slot, player: picks.get(s.slot) ?? null }));
  const total = Math.round(lineup.reduce((sum, s) => sum + (s.player?.pts ?? 0), 0) * 10) / 10;
  const mvp = lineup.reduce<LivePlayer | null>((best, s) => (s.player && (!best || s.player.pts > best.pts) ? s.player : best), null);
  const honorable = pool.filter((p) => !used.has(p.id) && p.position !== "K" && p.position !== "DST").slice(0, 6);

  return {
    season: live.season,
    week: live.week,
    currentWeek: live.currentWeek,
    inProgress: live.games.some((g) => g.state !== "final"),
    total,
    lineup,
    mvp: mvp?.id ?? null,
    honorable,
  };
}
