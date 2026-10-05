/**
 * ESPN fantasy football import. ESPN has no official public API; this uses the
 * same endpoint ESPN's own site calls. Public leagues need only the league ID.
 * Private leagues need the user's espn_s2 + SWID cookies, which are forwarded
 * to ESPN for that single request and never stored on the server.
 */
import type { ExternalPlayer } from "./playerMatch";
import type { LeagueDetail, Position } from "./types";

const ESPN_POSITION: Record<number, Position> = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "DST" };

/** ESPN lineup slot id -> Sleeper slot name. */
const ESPN_SLOT: Record<number, string> = {
  0: "QB",
  2: "RB",
  3: "WRRB_FLEX",
  4: "WR",
  5: "REC_FLEX",
  6: "TE",
  7: "SUPER_FLEX",
  16: "DEF",
  17: "K",
  20: "BN",
  21: "IR",
  23: "FLEX",
};
const BENCH_SLOTS = new Set([20, 21]);

const ESPN_TEAM: Record<number, string> = {
  1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE", 6: "DAL", 7: "DEN", 8: "DET", 9: "GB", 10: "TEN",
  11: "IND", 12: "KC", 13: "LV", 14: "LAR", 15: "MIA", 16: "MIN", 17: "NE", 18: "NO", 19: "NYG", 20: "NYJ",
  21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC", 25: "SF", 26: "SEA", 27: "TB", 28: "WAS", 29: "CAR", 30: "JAX",
  33: "BAL", 34: "HOU",
};

export class EspnError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchEspnLeague(leagueId: string, season: string, cookies?: { espnS2?: string; swid?: string }) {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=mTeam&view=mRoster&view=mSettings`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (cookies?.espnS2 && cookies?.swid) headers.Cookie = `espn_s2=${cookies.espnS2}; SWID=${cookies.swid}`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 401)
    throw new EspnError(
      cookies?.espnS2 ? "ESPN rejected those cookies. Copy fresh espn_s2 and SWID values and try again." : "This league is private. Add your espn_s2 and SWID cookies to import it.",
      401,
    );
  if (res.status === 404) throw new EspnError(`No ESPN league ${leagueId} found for the ${season} season.`, 404);
  if (!res.ok) throw new EspnError(`ESPN responded ${res.status}. Try again in a moment.`, 502);
  return res.json() as Promise<EspnLeagueRaw>;
}

/* ----------------------------------------------------------- raw shapes */

interface EspnLeagueRaw {
  id: number;
  seasonId: number;
  members?: { id: string; displayName?: string; firstName?: string; lastName?: string }[];
  settings?: {
    name?: string;
    size?: number;
    rosterSettings?: { lineupSlotCounts?: Record<string, number> };
    scoringSettings?: { scoringItems?: { statId: number; points: number }[] };
  };
  teams?: {
    id: number;
    name?: string;
    location?: string;
    nickname?: string;
    abbrev?: string;
    logo?: string;
    primaryOwner?: string;
    owners?: string[];
    record?: { overall?: { wins?: number; losses?: number; ties?: number; pointsFor?: number } };
    roster?: {
      entries?: {
        lineupSlotId: number;
        playerPoolEntry?: { player?: { id: number; fullName?: string; defaultPositionId?: number; proTeamId?: number } };
      }[];
    };
  }[];
}

/* -------------------------------------------------------------- parsing */

export function parseEspnLeague(raw: EspnLeagueRaw, match: (p: ExternalPlayer) => string | null, swid?: string): LeagueDetail {
  const members = new Map((raw.members ?? []).map((m) => [m.id, m]));
  let unmatched = 0;

  const rosterPositions: string[] = [];
  const counts = raw.settings?.rosterSettings?.lineupSlotCounts ?? {};
  for (const [slotId, count] of Object.entries(counts).sort((a, b) => order(Number(a[0])) - order(Number(b[0])))) {
    const name = ESPN_SLOT[Number(slotId)];
    if (name) for (let i = 0; i < count; i++) rosterPositions.push(name);
  }

  const rec = raw.settings?.scoringSettings?.scoringItems?.find((i) => i.statId === 53)?.points ?? 0;
  const normSwid = swid?.replace(/[{}]/g, "").toUpperCase();

  const teams = (raw.teams ?? []).map((t) => {
    const owner = t.primaryOwner ? members.get(t.primaryOwner) : undefined;
    const players: string[] = [];
    const starters: string[] = [];
    for (const e of t.roster?.entries ?? []) {
      const p = e.playerPoolEntry?.player;
      if (!p) continue;
      const position = ESPN_POSITION[p.defaultPositionId ?? -1] ?? null;
      if (!position) continue; // IDP etc.
      const team = ESPN_TEAM[p.proTeamId ?? -1] ?? null;
      const id = match({ name: (p.fullName ?? "").replace(/\s*D\/ST$/, ""), position, team });
      if (!id) {
        unmatched++;
        continue;
      }
      players.push(id);
      if (!BENCH_SLOTS.has(e.lineupSlotId)) starters.push(id);
    }
    const o = t.record?.overall ?? {};
    return {
      rosterId: t.id,
      ownerId: t.primaryOwner ?? null,
      displayName: owner?.displayName ?? (owner ? `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() : `Team ${t.id}`),
      teamName: t.name || `${t.location ?? ""} ${t.nickname ?? ""}`.trim() || t.abbrev || `Team ${t.id}`,
      avatar: t.logo ?? null,
      wins: o.wins ?? 0,
      losses: o.losses ?? 0,
      ties: o.ties ?? 0,
      pointsFor: Math.round((o.pointsFor ?? 0) * 100) / 100,
      players,
      starters,
    };
  });

  const mine = normSwid ? raw.teams?.find((t) => (t.owners ?? []).some((o) => o.replace(/[{}]/g, "").toUpperCase() === normSwid)) : undefined;

  return {
    leagueId: String(raw.id),
    name: raw.settings?.name ?? `ESPN League ${raw.id}`,
    season: String(raw.seasonId),
    totalRosters: raw.settings?.size ?? teams.length,
    avatar: null,
    rosterPositions,
    scoringSettings: { rec },
    teams,
    provider: "espn",
    myRosterId: mine?.id ?? null,
    unmatched,
  };
}

/** Display order for lineup slots: QB, RB, WR, TE, flexes, K, DEF, bench, IR. */
function order(slotId: number) {
  const o = [0, 2, 4, 6, 3, 5, 23, 7, 17, 16, 20, 21];
  const i = o.indexOf(slotId);
  return i < 0 ? 99 : i;
}
