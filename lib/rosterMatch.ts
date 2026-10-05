import "server-only";
import { getMatcher } from "./leagueImport";
import { normalizeName, normalizeTeam } from "./playerMatch";
import { getPlayers } from "./sleeper";
import type { Player, Position } from "./types";

export interface RosterEntry {
  name: string;
  position?: string | null;
  team?: string | null;
}

export interface MatchedPlayer {
  id: string;
  name: string;
  position: Position;
  team: string | null;
}

const POS: Record<string, Position> = { QB: "QB", RB: "RB", WR: "WR", TE: "TE", K: "K", PK: "K", DEF: "DST", DST: "DST", "D/ST": "DST" };
const toPos = (p?: string | null) => (p ? (POS[p.toUpperCase().split(/[,/ ]/)[0]] ?? POS[p.toUpperCase()] ?? null) : null);

/**
 * Match names read off a screenshot / pasted page to our player IDs.
 * Handles full names and Yahoo/ESPN-style abbreviations like "J. Gibbs".
 */
export async function matchEntries(entries: RosterEntry[]) {
  const [match, players] = await Promise.all([getMatcher(), getPlayers()]);
  const all = Object.values(players);
  const matched: MatchedPlayer[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();

  for (const e of entries) {
    const name = e.name.trim();
    if (!name) continue;
    const position = toPos(e.position);
    const team = normalizeTeam(e.team);
    let id = match({ name, position, team });
    if (!id) id = abbreviated(name, position, team, all);
    if (!id && position === "DST") id = defenseByName(name, all);
    if (id && players[id] && !seen.has(id)) {
      seen.add(id);
      const p = players[id];
      matched.push({ id, name: p.name, position: p.position, team: p.team });
    } else if (!id) unmatched.push(name);
  }
  return { matched, unmatched };
}

/** "J. Gibbs" / "J Gibbs" -> the player with that first initial + last name (team/position break ties). */
function abbreviated(name: string, position: Position | null, team: string | null, all: Player[]) {
  const m = normalizeName(name).match(/^([a-z])\s+(.+)$/);
  if (!m) return null;
  const [, initial, last] = m;
  const cands = all.filter((p) => p.position !== "DST" && normalizeName(p.lastName) === last && normalizeName(p.firstName).startsWith(initial));
  const narrowed = cands.filter((p) => (!position || p.position === position) && (!team || p.team === team));
  const pick = narrowed.length === 1 ? narrowed[0] : cands.length === 1 ? cands[0] : null;
  return pick?.id ?? null;
}

/** "Chicago Bears", "Bears D/ST", "Chicago" -> that team's defense. */
function defenseByName(name: string, all: Player[]) {
  const n = normalizeName(name.replace(/d\/st|dst|def(ense)?/gi, ""));
  const d = all.find((p) => p.position === "DST" && (normalizeName(p.name) === n || normalizeName(p.lastName) === n || normalizeName(p.firstName) === n));
  return d?.id ?? null;
}

/**
 * Find players named anywhere in pasted text (e.g. a copied Yahoo/ESPN roster page).
 * Free and offline: no AI involved.
 */
export async function matchRosterText(text: string) {
  const players = Object.values(await getPlayers());
  const lines = text.split(/\n/).map((l) => ` ${normalizeName(l)} `);
  const whole = ` ${lines.join(" ")} `;
  const found = new Map<string, MatchedPlayer>();

  for (const p of players) {
    if (p.position === "DST") continue;
    const full = normalizeName(p.name);
    if (full.split(" ").length >= 2 && whole.includes(` ${full} `)) {
      found.set(p.id, { id: p.id, name: p.name, position: p.position, team: p.team });
    }
  }
  // Abbreviated names ("J. Gibbs"): match initial + last name, using the team code
  // and position shown on the same line to pick between players who share a name.
  const POS_TOKENS: Record<string, Position> = { qb: "QB", rb: "RB", wr: "WR", te: "TE", k: "K" };
  for (const line of lines) {
    const words = line.trim().split(" ");
    const linePos = new Set(words.map((w) => POS_TOKENS[w]).filter(Boolean));
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].length !== 1) continue;
      const initial = words[i];
      for (const last of [`${words[i + 1]} ${words[i + 2] ?? ""}`.trim(), words[i + 1]]) {
        const cands = players.filter((p) => p.position !== "DST" && normalizeName(p.lastName) === last && normalizeName(p.firstName).startsWith(initial));
        if (!cands.length) continue;
        const fits = cands.filter((p) => (!p.team || line.includes(` ${p.team.toLowerCase()} `)) && (!linePos.size || linePos.has(p.position)));
        const pick = fits.length === 1 ? fits[0] : cands.length === 1 && !linePos.size ? cands[0] : null;
        if (pick && !found.has(pick.id)) found.set(pick.id, { id: pick.id, name: pick.name, position: pick.position, team: pick.team });
        break;
      }
    }
  }
  // Defenses: "<city> <nickname>" or "<nickname> D/ST|DEF".
  for (const p of players.filter((x) => x.position === "DST")) {
    const nick = normalizeName(p.lastName);
    if (whole.includes(` ${normalizeName(p.name)} `) || new RegExp(` ${nick} (d\/st|d st|dst|def|defense) `).test(whole)) {
      found.set(p.id, { id: p.id, name: p.name, position: p.position, team: p.team });
    }
  }
  return [...found.values()];
}
