/**
 * Maps players from other platforms (ESPN, Yahoo) to Sleeper player IDs,
 * which everything else on the site uses. Matching is by normalised name +
 * position, using the NFL team to break ties; defenses match by team.
 * Pure module (no server imports) so it can be unit-tested directly.
 */
import type { Player, Position } from "./types";

export function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.'’`]/g, "")
    .replace(/-/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Other platforms' team abbreviations -> ours. */
const TEAM_ALIASES: Record<string, string> = { WSH: "WAS", JAC: "JAX", LA: "LAR", ARZ: "ARI", GNB: "GB", KAN: "KC", NWE: "NE", NOR: "NO", SFO: "SF", TAM: "TB", LVR: "LV", OAK: "LV", SD: "LAC", STL: "LAR" };

export function normalizeTeam(abbr: string | null | undefined) {
  if (!abbr) return null;
  const up = abbr.toUpperCase();
  return TEAM_ALIASES[up] ?? up;
}

export interface ExternalPlayer {
  name: string;
  position: Position | null;
  team: string | null;
}

export function buildMatcher(players: Record<string, Player>) {
  const byNamePos = new Map<string, Player[]>();
  const byName = new Map<string, Player[]>();
  const dstByTeam = new Map<string, Player>();
  for (const p of Object.values(players)) {
    if (p.position === "DST") {
      if (p.team) dstByTeam.set(p.team, p);
      continue;
    }
    const n = normalizeName(p.name);
    for (const [map, key] of [
      [byNamePos, `${n}|${p.position}`],
      [byName, n],
    ] as const) {
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
  }

  const pick = (list: Player[] | undefined, team: string | null) => {
    if (!list?.length) return null;
    if (list.length === 1) return list[0];
    return list.find((p) => p.team === team) ?? null; // ambiguous without a team match
  };

  return (x: ExternalPlayer): string | null => {
    const team = normalizeTeam(x.team);
    if (x.position === "DST") return team ? (dstByTeam.get(team)?.id ?? null) : null;
    const n = normalizeName(x.name);
    return (pick(byNamePos.get(`${n}|${x.position}`), team) ?? pick(byName.get(n), team))?.id ?? null;
  };
}
