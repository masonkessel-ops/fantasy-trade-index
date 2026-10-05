/**
 * Parsers for Yahoo Fantasy API JSON. Yahoo's JSON is a literal translation of
 * its XML: objects are often arrays of single-key objects, and collections are
 * objects keyed "0", "1", … plus "count". `flat` and `list` undo that.
 * Pure module (no server imports) so it can be unit-tested directly.
 */
import type { ExternalPlayer } from "./playerMatch";
import type { LeagueDetail, LeagueTeam, Position } from "./types";

type Json = unknown;
type Obj = Record<string, unknown>;

/** Merge Yahoo's [{a:1},{b:2},[{c:3}],[]] into {a:1,b:2,c:3}. */
export function flat(x: Json): Obj {
  if (Array.isArray(x)) return x.reduce<Obj>((acc, el) => ({ ...acc, ...flat(el) }), {});
  return x && typeof x === "object" ? (x as Obj) : {};
}

/** {"0": {...}, "1": {...}, "count": 2} -> [{...}, {...}] */
export function list(x: Json): Obj[] {
  if (!x || typeof x !== "object") return [];
  if (Array.isArray(x)) return x as Obj[];
  return Object.entries(x as Obj)
    .filter(([k]) => /^\d+$/.test(k))
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, v]) => v as Obj);
}

/** Find the element of a Yahoo resource array that carries `key` (e.g. "settings", "teams"). */
function part(arr: Json, key: string): Json {
  if (!Array.isArray(arr)) return undefined;
  for (const el of arr) if (el && typeof el === "object" && !Array.isArray(el) && key in (el as Obj)) return (el as Obj)[key];
  return undefined;
}

const content = (json: Json) => ((json as Obj)?.fantasy_content ?? {}) as Obj;

export interface YahooLeagueSummary {
  leagueKey: string;
  name: string;
  numTeams: number;
  season: string;
  logo: string | null;
}

/** /users;use_login=1/games;game_codes=nfl/leagues */
export function parseUserLeagues(json: Json): YahooLeagueSummary[] {
  const out: YahooLeagueSummary[] = [];
  for (const u of list(content(json).users)) {
    const user = flat(u.user);
    for (const g of list(user.games)) {
      const gameArr = g.game;
      const game = flat(Array.isArray(gameArr) ? gameArr[0] : gameArr);
      if (game.code !== "nfl") continue;
      for (const l of list(part(gameArr, "leagues"))) {
        const meta = flat(Array.isArray(l.league) ? (l.league as Json[])[0] : l.league);
        out.push({
          leagueKey: String(meta.league_key),
          name: String(meta.name ?? "Yahoo league"),
          numTeams: Number(meta.num_teams ?? 0),
          season: String(meta.season ?? game.season ?? ""),
          logo: typeof meta.logo_url === "string" ? meta.logo_url : null,
        });
      }
    }
  }
  return out;
}

const YAHOO_SLOT: Record<string, string> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DEF",
  "W/R/T": "FLEX",
  "W/R": "WRRB_FLEX",
  "W/T": "REC_FLEX",
  "Q/W/R/T": "SUPER_FLEX",
  BN: "BN",
  IR: "IR",
};
const BENCH = new Set(["BN", "IR", "IR+", "NA"]);

function yahooPosition(display: unknown): Position | null {
  const first = String(display ?? "").split(",")[0].trim();
  if (first === "DEF") return "DST";
  return (["QB", "RB", "WR", "TE", "K"] as const).find((p) => p === first) ?? null;
}

/**
 * Combine /league/{key}/settings, /league/{key}/standings and
 * /league/{key}/teams/roster into one normalised league.
 */
export function parseLeague(
  settingsJson: Json,
  standingsJson: Json,
  rostersJson: Json,
  match: (p: ExternalPlayer) => string | null,
): LeagueDetail {
  const sArr = content(settingsJson).league;
  const meta = flat(Array.isArray(sArr) ? sArr[0] : sArr);
  const settings = flat(part(sArr, "settings"));

  const rosterPositions: string[] = [];
  for (const rp of (settings.roster_positions as Obj[] | undefined) ?? []) {
    const r = (rp.roster_position ?? rp) as Obj;
    const slot = YAHOO_SLOT[String(r.position)];
    if (slot) for (let i = 0; i < Number(r.count ?? 1); i++) rosterPositions.push(slot);
  }
  const mods = ((settings.stat_modifiers as Obj | undefined)?.stats as Obj[] | undefined) ?? [];
  const rec = Number((mods.map((m) => m.stat as Obj).find((s) => String(s?.stat_id) === "11")?.value as string) ?? 0) || 0;

  // Standings: record + points per team.
  const standings = new Map<string, Obj>();
  const stArr = content(standingsJson).league;
  for (const t of list(flat(part(stArr, "standings")).teams)) {
    const team = flat(t.team);
    standings.set(String(team.team_key), team);
  }

  let unmatched = 0;
  let myRosterId: number | null = null;
  const rArr = content(rostersJson).league;
  const teams: LeagueTeam[] = list(part(rArr, "teams")).map((t) => {
    const team = flat(t.team);
    const key = String(team.team_key);
    const st = standings.get(key) ?? {};
    const ts = (st.team_standings ?? {}) as Obj;
    const totals = (ts.outcome_totals ?? {}) as Obj;
    const manager = (((team.managers as Obj[] | undefined)?.[0]?.manager ?? {}) as Obj) || {};
    const logo = ((team.team_logos as Obj[] | undefined)?.[0]?.team_logo as Obj | undefined)?.url;
    const rosterId = Number(team.team_id);
    if (Number(team.is_owned_by_current_login) === 1) myRosterId = rosterId;

    const players: string[] = [];
    const starters: string[] = [];
    const roster = (team.roster ?? {}) as Obj;
    const playersColl = flat(roster["0"] ?? roster).players;
    for (const pl of list(playersColl)) {
      const p = flat(pl.player);
      const position = yahooPosition(p.display_position);
      if (!position) continue;
      const name = String(((p.name as Obj | undefined)?.full as string) ?? "");
      const id = match({ name, position, team: (p.editorial_team_abbr as string) ?? null });
      if (!id) {
        unmatched++;
        continue;
      }
      players.push(id);
      const sel = flat(p.selected_position).position;
      if (!BENCH.has(String(sel))) starters.push(id);
    }

    return {
      rosterId,
      ownerId: key,
      displayName: String(manager.nickname ?? "Manager"),
      teamName: String(team.name ?? `Team ${rosterId}`),
      avatar: typeof logo === "string" ? logo : null,
      wins: Number(totals.wins ?? 0),
      losses: Number(totals.losses ?? 0),
      ties: Number(totals.ties ?? 0),
      pointsFor: Number(ts.points_for ?? ((st.team_points as Obj | undefined)?.total as string) ?? 0) || 0,
      players,
      starters,
    };
  });

  return {
    leagueId: String(meta.league_key),
    name: String(meta.name ?? "Yahoo league"),
    season: String(meta.season ?? ""),
    totalRosters: Number(meta.num_teams ?? teams.length),
    avatar: typeof meta.logo_url === "string" ? meta.logo_url : null,
    rosterPositions,
    scoringSettings: { rec },
    teams,
    provider: "yahoo",
    myRosterId,
    unmatched,
  };
}
