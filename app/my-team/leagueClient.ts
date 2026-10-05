"use client";

import { scoringFromRec, type SavedTeam } from "@/lib/myTeam";
import type { LeagueDetail, LeagueProvider } from "@/lib/types";

export interface LeagueResponse {
  league: LeagueDetail;
  directory: SavedTeam["directory"];
}

export class LeagueError extends Error {
  needsCookies: boolean;
  signedOut: boolean;
  constructor(message: string, opts: { needsCookies?: boolean; signedOut?: boolean } = {}) {
    super(message);
    this.needsCookies = !!opts.needsCookies;
    this.signedOut = !!opts.signedOut;
  }
}

async function readLeague(res: Response): Promise<LeagueResponse> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new LeagueError(data.error ?? "Couldn't load that league.", data);
  return data;
}

export const fetchSleeperLeague = (leagueId: string) => fetch(`/api/sleeper/league/${leagueId}`).then(readLeague);

export const fetchYahooLeague = (leagueKey: string) => fetch(`/api/yahoo/league/${encodeURIComponent(leagueKey)}`).then(readLeague);

/** ESPN cookies go in the POST body (never the URL) and aren't saved anywhere. */
export const fetchEspnLeague = (leagueId: string, cookies?: { espnS2: string; swid: string }) =>
  fetch("/api/espn/league", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leagueId, ...cookies }),
  }).then(readLeague);

/** Re-download a saved league for the Sync button. */
export function refetchLeague(team: SavedTeam): Promise<LeagueResponse> {
  const l = team.league!;
  const provider: LeagueProvider = l.provider ?? "sleeper";
  if (provider === "yahoo") return fetchYahooLeague(l.leagueId);
  if (provider === "espn") return fetchEspnLeague(l.leagueId);
  return fetchSleeperLeague(l.leagueId);
}

export function teamFromLeague(data: LeagueResponse, rosterId: number, username = ""): SavedTeam {
  const { league, directory } = data;
  const mine = league.teams.find((t) => t.rosterId === rosterId)!;
  const provider = league.provider ?? "sleeper";
  return {
    source: provider,
    name: mine.teamName,
    avatar: mine.avatar,
    scoring: scoringFromRec(league.scoringSettings.rec),
    playerIds: mine.players,
    rosterPositions: league.rosterPositions,
    league: {
      leagueId: league.leagueId,
      name: league.name,
      season: league.season,
      totalRosters: league.totalRosters,
      avatar: league.avatar,
      scoringSettings: league.scoringSettings,
      teams: league.teams,
      myRosterId: rosterId,
      username,
      provider,
    },
    directory,
    updatedAt: Date.now(),
  };
}
