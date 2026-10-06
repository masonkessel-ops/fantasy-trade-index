import "server-only";
import { unstable_cache } from "next/cache";
import { memo } from "./memo";
import type { LeagueDetail, NflState, Player, Position, ScheduleGame, WeekLine } from "./types";
export type { LeagueDetail, LeagueTeam } from "./types";

/**
 * Every call to Sleeper goes through this file.
 * Stats + projections endpoints are undocumented but stable; if Sleeper ever
 * changes their shape, this is the only file that needs fixing.
 */
const BASE = "https://api.sleeper.app";
export const REGULAR_SEASON_WEEKS = 18;

const MIN = 60_000;
const HOUR = 60 * MIN;

async function sleeperJson<T>(path: string, revalidateSeconds: number | false): Promise<T> {
  const res = await fetch(
    BASE + path,
    revalidateSeconds === false ? { cache: "no-store" } : { next: { revalidate: revalidateSeconds } },
  );
  if (!res.ok) throw new Error(`Sleeper ${path} responded ${res.status}`);
  return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------ state */

export function getNflState(): Promise<NflState> {
  return memo("state", 5 * MIN, async () => {
    const s = await sleeperJson<{ season: string; week: number; season_type: string }>("/v1/state/nfl", 300);
    const week =
      s.season_type === "post" ? REGULAR_SEASON_WEEKS : Math.min(REGULAR_SEASON_WEEKS, Math.max(1, s.week || 1));
    return { season: s.season, week, seasonType: s.season_type };
  });
}

/* ---------------------------------------------------------------- players */

const FANTASY_POSITIONS: Record<string, Position> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DST",
};

type RawPlayer = {
  player_id: string;
  position?: string;
  team?: string | null;
  active?: boolean;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  age?: number | null;
  injury_status?: string | null;
  injury_body_part?: string | null;
  years_exp?: number | null;
  number?: number | null;
  search_rank?: number | null;
};

// The full player dump is ~15 MB, too big for Next's data cache, so we
// download it uncached and cache only the trimmed (~150 KB) result for 24h.
const fetchTrimmedPlayers = unstable_cache(
  async (): Promise<Record<string, Player>> => {
    const raw = await sleeperJson<Record<string, RawPlayer>>("/v1/players/nfl", false);
    const out: Record<string, Player> = {};
    for (const p of Object.values(raw)) {
      const position = p.position ? FANTASY_POSITIONS[p.position] : undefined;
      if (!position || !p.team || p.active === false) continue;
      const isDst = position === "DST";
      out[p.player_id] = {
        id: p.player_id,
        name: isDst ? `${p.first_name} ${p.last_name}` : (p.full_name ?? `${p.first_name} ${p.last_name}`),
        firstName: p.first_name ?? "",
        lastName: p.last_name ?? "",
        position,
        team: p.team,
        age: p.age ?? null,
        injuryStatus: p.injury_status ?? null,
        injuryBodyPart: p.injury_body_part ?? null,
        yearsExp: p.years_exp ?? null,
        number: p.number ?? null,
        searchRank: p.search_rank ?? null,
      };
    }
    return out;
  },
  ["sleeper-players-v1"],
  { revalidate: 24 * 60 * 60 },
);

export function getPlayers(): Promise<Record<string, Player>> {
  return memo("players", 6 * HOUR, fetchTrimmedPlayers);
}

/* ------------------------------------------------------- stats/projections */

/** Box-score stats we keep for display; everything else is dropped. */
const KEEP_STATS = [
  "pass_yd", "pass_td", "pass_int", "pass_att", "pass_cmp",
  "rush_att", "rush_yd", "rush_td",
  "rec", "rec_tgt", "rec_yd", "rec_td",
  "fum_lost", "fgm", "fga", "xpm",
  "def_td", "int", "sack", "fum_rec", "pts_allow",
] as const;

type RawLine = Record<string, number | undefined>;

function trimLines(raw: Record<string, RawLine>, requirePlayed: boolean): Record<string, WeekLine> {
  const out: Record<string, WeekLine> = {};
  for (const [id, s] of Object.entries(raw)) {
    if (s.pts_ppr === undefined && s.pts_std === undefined) continue;
    const played = (s.gp ?? 0) > 0;
    if (requirePlayed && !played) continue;
    const stats: Record<string, number> = {};
    for (const k of KEEP_STATS) if (s[k] !== undefined) stats[k] = s[k]!;
    out[id] = {
      pts: { ppr: s.pts_ppr ?? 0, half: s.pts_half_ppr ?? s.pts_ppr ?? 0, std: s.pts_std ?? 0 },
      played,
      stats,
    };
  }
  return out;
}

/** Actual stats for a week. The current week refreshes every 60s for live games. */
export async function getWeekStats(season: string, week: number): Promise<Record<string, WeekLine>> {
  const { week: current, season: currentSeason } = await getNflState();
  const live = season === currentSeason && week >= current;
  const ttl = live ? MIN : 6 * HOUR;
  return memo(`stats:${season}:${week}`, ttl, async () => {
    const raw = await sleeperJson<Record<string, RawLine>>(`/v1/stats/nfl/regular/${season}/${week}`, ttl / 1000);
    return trimLines(raw, true);
  });
}

/** Sleeper's projected stats for a week (any week of the season, past or future). */
export async function getWeekProjections(season: string, week: number): Promise<Record<string, WeekLine>> {
  const ttl = 3 * HOUR;
  return memo(`proj:${season}:${week}`, ttl, async () => {
    const raw = await sleeperJson<Record<string, RawLine>>(
      `/v1/projections/nfl/regular/${season}/${week}`,
      ttl / 1000,
    );
    const lines = trimLines(raw, false);
    // Projections have no "gp" field; treat any projected points as a projected game.
    for (const l of Object.values(lines)) l.played = l.pts.ppr > 0 || l.pts.std > 0;
    return lines;
  });
}

export function getAllWeekStats(season: string, throughWeek: number) {
  return Promise.all(Array.from({ length: throughWeek }, (_, i) => getWeekStats(season, i + 1)));
}

export function getAllWeekProjections(season: string) {
  return Promise.all(
    Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => getWeekProjections(season, i + 1)),
  );
}

/* --------------------------------------------------------------- schedule */

export function getSchedule(season: string): Promise<ScheduleGame[]> {
  return memo(`schedule:${season}`, 5 * MIN, async () => {
    const raw = await sleeperJson<
      { game_id: string; week: number; date: string; home: string; away: string; status: string }[]
    >(`/schedule/nfl/regular/${season}`, 300);
    return raw.map((g) => ({
      gameId: g.game_id,
      week: g.week,
      date: g.date,
      home: g.home,
      away: g.away,
      status: g.status,
    }));
  });
}

/** team -> bye week, derived from the schedule (the week a team doesn't play). */
export async function getByeWeeks(season: string): Promise<Record<string, number>> {
  const games = await getSchedule(season);
  const playing = new Map<number, Set<string>>();
  const teams = new Set<string>();
  for (const g of games) {
    if (!playing.has(g.week)) playing.set(g.week, new Set());
    playing.get(g.week)!.add(g.home).add(g.away);
    teams.add(g.home).add(g.away);
  }
  const byes: Record<string, number> = {};
  for (let w = 1; w <= REGULAR_SEASON_WEEKS; w++) {
    const set = playing.get(w);
    if (!set) continue;
    for (const t of teams) if (!set.has(t) && byes[t] === undefined) byes[t] = w;
  }
  return byes;
}

/* ------------------------------------------------------- users & leagues */

export interface SleeperUser {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
}

export interface SleeperLeagueSummary {
  leagueId: string;
  name: string;
  season: string;
  totalRosters: number;
  avatar: string | null;
  scoringRec: number;
}

const avatarUrl = (id: string | null | undefined) =>
  id ? (id.startsWith("http") ? id : `https://sleepercdn.com/avatars/thumbs/${id}`) : null;

export async function getSleeperUser(username: string): Promise<SleeperUser | null> {
  const u = await sleeperJson<{ user_id: string; username?: string; display_name: string; avatar: string | null } | null>(
    `/v1/user/${encodeURIComponent(username)}`,
    600,
  );
  if (!u) return null;
  return { userId: u.user_id, username: u.username ?? username, displayName: u.display_name, avatar: avatarUrl(u.avatar) };
}

export async function getUserLeagues(userId: string, season: string): Promise<SleeperLeagueSummary[]> {
  const leagues = await sleeperJson<
    { league_id: string; name: string; season: string; total_rosters: number; avatar: string | null; scoring_settings: Record<string, number> }[]
  >(`/v1/user/${userId}/leagues/nfl/${season}`, 300);
  return (leagues ?? []).map((l) => ({
    leagueId: l.league_id,
    name: l.name,
    season: l.season,
    totalRosters: l.total_rosters,
    avatar: avatarUrl(l.avatar),
    scoringRec: l.scoring_settings?.rec ?? 0,
  }));
}

export async function getLeagueDetail(leagueId: string): Promise<LeagueDetail | null> {
  const id = encodeURIComponent(leagueId);
  const [league, rosters, users] = await Promise.all([
    sleeperJson<{
      league_id: string;
      name: string;
      season: string;
      total_rosters: number;
      avatar: string | null;
      roster_positions: string[];
      scoring_settings: Record<string, number>;
    } | null>(`/v1/league/${id}`, 300),
    sleeperJson<
      {
        roster_id: number;
        owner_id: string | null;
        players: string[] | null;
        starters: string[] | null;
        reserve: string[] | null;
        settings: { wins?: number; losses?: number; ties?: number; fpts?: number; fpts_decimal?: number };
      }[]
    >(`/v1/league/${id}/rosters`, 120),
    sleeperJson<{ user_id: string; display_name: string; avatar: string | null; metadata?: { team_name?: string; avatar?: string } }[]>(
      `/v1/league/${id}/users`,
      300,
    ),
  ]);
  if (!league) return null;
  const byUser = new Map((users ?? []).map((u) => [u.user_id, u]));
  return {
    leagueId: league.league_id,
    name: league.name,
    season: league.season,
    totalRosters: league.total_rosters,
    avatar: avatarUrl(league.avatar),
    rosterPositions: league.roster_positions ?? [],
    scoringSettings: league.scoring_settings ?? {},
    teams: (rosters ?? []).map((r) => {
      const u = r.owner_id ? byUser.get(r.owner_id) : undefined;
      return {
        rosterId: r.roster_id,
        ownerId: r.owner_id,
        displayName: u?.display_name ?? `Team ${r.roster_id}`,
        teamName: u?.metadata?.team_name || u?.display_name || `Team ${r.roster_id}`,
        avatar: avatarUrl(u?.metadata?.avatar ?? u?.avatar),
        wins: r.settings?.wins ?? 0,
        losses: r.settings?.losses ?? 0,
        ties: r.settings?.ties ?? 0,
        pointsFor: (r.settings?.fpts ?? 0) + (r.settings?.fpts_decimal ?? 0) / 100,
        players: r.players ?? [],
        starters: (r.starters ?? []).filter((s) => s && s !== "0"),
      };
    }),
  };
}

/* --------------------------------------------------------------- trending */

export interface Trending {
  id: string;
  /** how many Sleeper leagues added (or dropped) the player in the window */
  count: number;
}

/** Most added / dropped players across all Sleeper leagues in the last `hours`. */
export async function getTrending(kind: "add" | "drop", hours = 24, limit = 60): Promise<Trending[]> {
  const raw = await sleeperJson<{ player_id: string; count: number }[]>(`/v1/players/nfl/trending/${kind}?lookback_hours=${hours}&limit=${limit}`, 15 * 60);
  return (raw ?? []).map((r) => ({ id: r.player_id, count: r.count }));
}

/* ----------------------------------------------------------------- scores */

export interface GameScore {
  gameId: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  /** pre | live | final */
  state: "pre" | "live" | "final";
  quarter: string;
  clock: string;
  kickoff: string;
  possession: string | null;
  downDistance: string | null;
}

type RawScore = {
  game_id?: string;
  status: string;
  date?: string;
  metadata: {
    game_key?: string;
    home_team: string;
    away_team: string;
    home_score?: number | null;
    away_score?: number | null;
    quarter?: string;
    time_remaining?: string;
    is_in_progress?: boolean;
    is_over?: boolean;
    date_time?: string;
    possession?: string | null;
    down_and_distance?: string | null;
  };
};

/** Live scoreboard for a week (undocumented endpoint, refreshed every 30s for the current week). */
export async function getScores(season: string, week: number): Promise<GameScore[]> {
  const { week: current, season: currentSeason } = await getNflState();
  const live = season === currentSeason && week >= current;
  const ttl = live ? 30_000 : 6 * HOUR;
  return memo(`scores:${season}:${week}`, ttl, async () => {
    const raw = await sleeperJson<RawScore[]>(`/scores/nfl/regular/${season}/${week}`, ttl / 1000);
    return (raw ?? []).map((g) => {
      const m = g.metadata;
      const state: GameScore["state"] =
        g.status === "complete" || m.is_over ? "final" : g.status === "in_game" || m.is_in_progress ? "live" : "pre";
      return {
        gameId: m.game_key ?? g.game_id ?? `${m.away_team}@${m.home_team}`,
        home: m.home_team,
        away: m.away_team,
        homeScore: m.home_score ?? null,
        awayScore: m.away_score ?? null,
        state,
        quarter: m.quarter ?? "",
        clock: m.time_remaining ?? "",
        kickoff: m.date_time ?? g.date ?? "",
        possession: m.possession || null,
        downDistance: m.down_and_distance || null,
      };
    });
  });
}
