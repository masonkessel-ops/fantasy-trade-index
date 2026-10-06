import "server-only";
import { getMatcher } from "./leagueImport";
import { editDistance, normalizeName, normalizeTeam } from "./playerMatch";
import { getPlayers } from "./sleeper";
import type { Player, Position } from "./types";

export interface RosterEntry {
  name: string;
  position?: string | null;
  team?: string | null;
  /** true = starting slot, false = bench/IR, undefined = unknown */
  starter?: boolean | null;
}

export interface MatchedPlayer {
  id: string;
  name: string;
  position: Position;
  team: string | null;
  /** true = starting slot, false = bench/IR, undefined = unknown */
  starter?: boolean;
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
      matched.push({ id, name: p.name, position: p.position, team: p.team, starter: e.starter ?? undefined });
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
  // Roster pages label each row with its slot; rows starting BN/IR are bench.
  const SLOT_START = /^ (qb|rb|wr|te|flex|w r t|w\/r\/t|wrt|w r|w t|q w r t|sflex|op|k|def|d st|d\/st|dst|bn|bench|ir|res) /;
  const hasSlots = lines.filter((l) => SLOT_START.test(l)).length >= 3;
  const isBench = (line: string) => /^ (bn|bench|ir|res) /.test(line);
  const lineOf = new Map<string, number>();
  const whole = ` ${lines.join(" ")} `;
  const found = new Map<string, MatchedPlayer>();

  for (const p of players) {
    if (p.position === "DST") continue;
    const full = normalizeName(p.name);
    if (full.split(" ").length >= 2 && whole.includes(` ${full} `)) {
      found.set(p.id, { id: p.id, name: p.name, position: p.position, team: p.team });
      lineOf.set(p.id, lines.findIndex((l) => l.includes(` ${full} `)));
    }
  }
  // Abbreviated names ("J. Gibbs"): match initial + last name, using the team code
  // and position shown on the same line to pick between players who share a name.
  const POS_TOKENS: Record<string, Position> = { qb: "QB", rb: "RB", wr: "WR", te: "TE", k: "K" };
  for (const [lineIdx, line] of lines.entries()) {
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
        if (pick && !found.has(pick.id)) {
          found.set(pick.id, { id: pick.id, name: pick.name, position: pick.position, team: pick.team });
          lineOf.set(pick.id, lineIdx);
        }
        break;
      }
    }
  }
  // Small misspellings, mostly from reading screenshots ("Kenneth Waiker"): the closest
  // fantasy-relevant player, only when one name is clearly closest.
  const relevant = players
    .filter((p) => p.position !== "DST" && p.team && p.searchRank !== null && p.searchRank <= 800 && !found.has(p.id))
    .map((p) => ({ p, full: normalizeName(p.name) }))
    .filter((x) => x.full.includes(" ") && x.full.length >= 7);
  for (const [lineIdx, line] of lines.entries()) {
    const words = line.trim().split(" ");
    for (let i = 0; i < words.length - 1; i++) {
      for (const n of [2, 3]) {
        if (i + n > words.length) continue;
        const phrase = words.slice(i, i + n).join(" ");
        if (phrase.length < 7) continue;
        const max = phrase.length >= 12 ? 2 : 1;
        const lastInitial = phrase.split(" ").at(-1)![0];
        let best: { d: number; p: Player } | null = null;
        let tie = false;
        for (const k of relevant) {
          if (found.has(k.p.id) || Math.abs(k.full.length - phrase.length) > max) continue;
          if (k.full[0] !== phrase[0] && k.full.split(" ").at(-1)![0] !== lastInitial) continue;
          const d = editDistance(phrase, k.full, max);
          if (d > max) continue;
          if (!best || d < best.d) [best, tie] = [{ d, p: k.p }, false];
          else if (d === best.d && best.p.id !== k.p.id) tie = true;
        }
        if (best && !tie && best.d > 0) {
          found.set(best.p.id, { id: best.p.id, name: best.p.name, position: best.p.position, team: best.p.team });
          lineOf.set(best.p.id, lineIdx);
        }
      }
    }
  }
  // Defenses: "<city> <nickname>" or "<nickname> D/ST|DEF".
  for (const p of players.filter((x) => x.position === "DST")) {
    const nick = normalizeName(p.lastName);
    if (whole.includes(` ${normalizeName(p.name)} `) || new RegExp(` ${nick} (d\/st|d st|dst|def|defense) `).test(whole)) {
      found.set(p.id, { id: p.id, name: p.name, position: p.position, team: p.team });
      lineOf.set(p.id, lines.findIndex((l) => l.includes(` ${nick} `)));
    }
  }
  if (hasSlots) {
    for (const m of found.values()) {
      const i = lineOf.get(m.id);
      if (i !== undefined && i >= 0) m.starter = !isBench(lines[i]);
    }
  }
  return [...found.values()];
}
