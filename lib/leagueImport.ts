import "server-only";
import { memo } from "./memo";
import { buildMatcher } from "./playerMatch";
import { getPlayers } from "./sleeper";
import type { LeagueDetail } from "./types";

/** Name/position matcher onto Sleeper IDs, rebuilt when the player list refreshes. */
export function getMatcher() {
  return memo("player-matcher", 6 * 60 * 60_000, async () => buildMatcher(await getPlayers()));
}

/** id -> name/pos/team for every rostered player, so the UI can label players off the value chart. */
export async function directoryFor(league: LeagueDetail) {
  const players = await getPlayers();
  const directory: Record<string, { name: string; position: string; team: string | null }> = {};
  for (const t of league.teams)
    for (const pid of t.players) {
      const p = players[pid];
      if (p) directory[pid] = { name: p.name, position: p.position, team: p.team };
    }
  return directory;
}
