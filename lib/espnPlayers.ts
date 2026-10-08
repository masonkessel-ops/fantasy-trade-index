import "server-only";
import { ESPN_POSITION, ESPN_TEAM } from "./espn";
import { memo } from "./memo";
import type { ExternalPlayer } from "./playerMatch";

/**
 * A second opinion from ESPN's public player data: how many of ESPN's millions of
 * managers start and roster each player, ESPN's injury designations (refreshed
 * through the day, faster than Sleeper's daily player dump) and ESPN's weekly
 * projections. Keyed by ESPN player id; name, position and team are kept for
 * matching players Sleeper has no ESPN id for. If ESPN is down, everything
 * falls back to Sleeper alone.
 */
export interface EspnPlayer extends ExternalPlayer {
  /** share of ESPN leagues that start / roster him this week, 0–100 */
  percentStarted: number;
  percentOwned: number;
  /** injury designation in Sleeper's words (null = healthy) */
  injuryStatus: string | null;
  /** projected points by week: PPR and receptions (to derive half and standard) */
  proj: Record<number, { ppr: number; rec: number }>;
}

const INJURY: Record<string, string> = {
  QUESTIONABLE: "Questionable",
  DOUBTFUL: "Doubtful",
  OUT: "Out",
  INJURY_RESERVE: "IR",
  SUSPENSION: "Sus",
};

/** ESPN stat id for receptions (PPR leagues score 1 per). */
const RECEPTIONS = "53";

interface RawEspn {
  players?: {
    player: {
      id: number;
      fullName?: string;
      defaultPositionId?: number;
      proTeamId?: number;
      injuryStatus?: string;
      ownership?: { percentStarted?: number; percentOwned?: number };
      stats?: { seasonId: number; scoringPeriodId: number; statSourceId: number; statSplitTypeId: number; appliedTotal?: number; stats?: Record<string, number> }[];
    };
  }[];
}

export function getEspnPlayers(season: string): Promise<Map<string, EspnPlayer>> {
  // A failed download isn't cached (memo retries, or keeps serving the last good copy).
  return memo(`espn-players-v2:${season}`, 2 * 60 * 60_000, async () => {
    const filter = { players: { limit: 500, sortPercOwned: { sortPriority: 1, sortAsc: false }, filterStatsForSourceIds: { value: [1] }, filterStatsForSplitTypeIds: { value: [1] } } };
    // ~10 MB: too big for Next's data cache, so it's fetched uncached and only the trimmed result is kept.
    const res = await fetch(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leaguedefaults/3?view=kona_player_info`, {
      headers: { "x-fantasy-filter": JSON.stringify(filter) },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`ESPN ${res.status}`);
    const raw = (await res.json()) as RawEspn;
    const out = new Map<string, EspnPlayer>();
    for (const { player: p } of raw.players ?? []) {
      const proj: EspnPlayer["proj"] = {};
      for (const s of p.stats ?? []) {
        if (s.statSourceId !== 1 || s.statSplitTypeId !== 1 || String(s.seasonId) !== season) continue;
        proj[s.scoringPeriodId] = { ppr: s.appliedTotal ?? 0, rec: s.stats?.[RECEPTIONS] ?? 0 };
      }
      out.set(String(p.id), {
        name: p.fullName ?? "",
        position: ESPN_POSITION[p.defaultPositionId ?? -1] ?? null,
        team: ESPN_TEAM[p.proTeamId ?? -1] ?? null,
        percentStarted: p.ownership?.percentStarted ?? 0,
        percentOwned: p.ownership?.percentOwned ?? 0,
        injuryStatus: (p.injuryStatus && INJURY[p.injuryStatus]) || null,
        proj,
      });
    }
    if (!out.size) throw new Error("ESPN returned no players");
    return out;
  }).catch(() => new Map<string, EspnPlayer>()); // ESPN unavailable: Sleeper only
}
