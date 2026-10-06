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

/** Slot labels as fantasy apps print them (normalized) -> Sleeper-style roster slots. */
const SLOT_LABELS: [RegExp, string][] = [
  [/^(q w r t|q\/w\/r\/t|qwrt|sflex|superflex|super flex|op)$/, "SUPER_FLEX"],
  [/^(w r t|w\/r\/t|wrt|flex|rb\/wr\/te|w r te)$/, "FLEX"],
  [/^(w r|w\/r|wr\/rb|rb\/wr)$/, "WRRB_FLEX"],
  [/^(w t|w\/t|wr\/te)$/, "REC_FLEX"],
  [/^qb$/, "QB"],
  [/^rb$/, "RB"],
  [/^wr$/, "WR"],
  [/^te$/, "TE"],
  [/^(k|pk)$/, "K"],
  [/^(def|dst|d st|d\/st|dist)$/, "DEF"],
  [/^(bn|bench|be)$/, "BN"],
  [/^(ir|ir\+|res|reserve)$/, "IR"],
];
const BENCH = new Set(["BN", "IR"]);
const DEF_WORD = "(def|dst|d st|d\\/st|dist|defense)";

/** The roster slot a line starts with ("WR J. Chase …" -> "WR"), if any. */
function slotAt(line: string) {
  const words = line.trim().split(" ");
  for (const n of [3, 2, 1]) {
    const head = words.slice(0, n).join(" ");
    const hit = SLOT_LABELS.find(([re]) => re.test(head));
    if (hit) return hit[1];
  }
  return null;
}

export interface RosterTextResult {
  matched: MatchedPlayer[];
  /** the league's roster slots in screen order (e.g. QB, WR, WR, WR, RB, RB, TE, FLEX, K, DEF, BN…), when the page shows them */
  slots: string[] | null;
}

/**
 * Find players named anywhere in pasted or screenshot-read text (e.g. a Yahoo/ESPN
 * roster page), plus who's starting and the league's lineup slots. Free and offline: no AI.
 */
export async function matchRosterText(text: string): Promise<RosterTextResult> {
  const players = Object.values(await getPlayers());
  const cleaned = text
    .replace(/[^\p{L}\p{N}\s.'’\-/+&]/gu, " ") // stray symbols from screenshots: "C.J). Stroud»" -> "C.J . Stroud"
    .replace(/\b([A-Z])\.(?=[A-Z][a-z])/g, "$1. "); // "J.Allen" -> "J. Allen"
  const lines = cleaned.split(/\n/).map((l) => ` ${normalizeName(l)} `);
  const whole = ` ${lines.join(" ")} `;
  const found = new Map<string, MatchedPlayer>();
  const lineOf = new Map<string, number>();
  const add = (p: Player, line: number) => {
    if (found.has(p.id)) return;
    found.set(p.id, { id: p.id, name: p.name, position: p.position, team: p.team });
    lineOf.set(p.id, line);
  };

  // 1. Full names.
  for (const p of players) {
    if (p.position === "DST") continue;
    const full = normalizeName(p.name);
    if (full.split(" ").length >= 2 && whole.includes(` ${full} `)) add(p, lines.findIndex((l) => l.includes(` ${full} `)));
  }

  // 2. Abbreviated names ("J. Gibbs"): initial + last name. The team code and position
  //    on the same line or the one below ("Det - RB") pick between players who share a name.
  const POS_TOKENS: Record<string, Position> = { qb: "QB", rb: "RB", wr: "WR", te: "TE", k: "K" };
  const initialAtStart = new Set<number>(); // lines like "K. Walker": that "k" is a name, not the kicker slot
  for (const [lineIdx, line] of lines.entries()) {
    const words = line.trim().split(" ");
    const ctx = `${line} ${lines[lineIdx + 1] ?? ""} ${lines[lineIdx + 2] ?? ""} `;
    const ctxWords = ctx.trim().split(" ");
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].length !== 1) continue;
      // Screenshots sometimes read the initial "J." as "1."
      const initials = words[i] === "1" ? ["j", "i", "l"] : /[a-z]/.test(words[i]) ? [words[i]] : [];
      if (!initials.length) continue;
      for (const last of [`${words[i + 1]} ${words[i + 2] ?? ""}`.trim(), words[i + 1]]) {
        const cands = players.filter((p) => p.position !== "DST" && normalizeName(p.lastName) === last && initials.some((c) => normalizeName(p.firstName).startsWith(c)));
        if (!cands.length) continue;
        const ctxPos = new Set(ctxWords.slice(i + 1).map((w) => POS_TOKENS[w]).filter(Boolean));
        const fits = cands.filter((p) => (!p.team || ctx.includes(` ${p.team.toLowerCase()} `)) && (!ctxPos.size || ctxPos.has(p.position)));
        // Still more than one (Bijan and Brian Robinson both play for ATL)? Take the far more
        // fantasy-relevant one; the review screen lets people fix it.
        const pool = (fits.length ? fits : cands).sort((a, b) => (a.searchRank ?? 1e9) - (b.searchRank ?? 1e9));
        const clear = pool.length === 1 || (pool[0].searchRank ?? 1e9) * 3 < (pool[1].searchRank ?? 1e9);
        const pick = clear ? pool[0] : null;
        if (pick) {
          add(pick, lineIdx);
          if (i === 0) initialAtStart.add(lineIdx);
        }
        break;
      }
    }
  }

  // 3. Small misspellings, mostly from reading screenshots ("Kenneth Waiker"): the closest
  //    fantasy-relevant player, only when one name is clearly closest. Players already found
  //    stay in the comparison, so "Bijan Robinson" can't be read as a typo of "Brian Robinson".
  const relevant = players
    .filter((p) => p.position !== "DST" && ((p.team && p.searchRank !== null && p.searchRank <= 800) || found.has(p.id)))
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
          if (Math.abs(k.full.length - phrase.length) > max) continue;
          if (k.full[0] !== phrase[0] && k.full.split(" ").at(-1)![0] !== lastInitial) continue;
          const d = editDistance(phrase, k.full, max);
          if (d > max) continue;
          if (!best || d < best.d) [best, tie] = [{ d, p: k.p }, false];
          else if (d === best.d && best.p.id !== k.p.id) tie = true;
        }
        if (best && !tie && best.d > 0 && !found.has(best.p.id)) add(best.p, lineIdx);
      }
    }
  }

  // 4. Defenses, however the app writes them: "Seattle Seahawks", "Seahawks D/ST",
  //    Yahoo's "Seattle" + "Sea - DEF", or "DEF - SEA".
  const aliasesOf = (team: string) => [team, ...Object.entries({ WSH: "WAS", JAC: "JAX", LA: "LAR", ARZ: "ARI", GNB: "GB", KAN: "KC", NWE: "NE", NOR: "NO", SFO: "SF", TAM: "TB", LVR: "LV" }).filter(([, to]) => to === team).map(([from]) => from)].map((t) => t.toLowerCase());
  for (const p of players.filter((x) => x.position === "DST")) {
    const full = normalizeName(p.name);
    const nick = normalizeName(p.lastName);
    const city = normalizeName(p.firstName);
    const abbrs = p.team ? aliasesOf(normalizeTeam(p.team)!) : [];
    const patterns = [
      new RegExp(` ${nick} ${DEF_WORD} `),
      new RegExp(` ${city} ${DEF_WORD} `),
      ...abbrs.map((a) => new RegExp(` (${a} ${DEF_WORD}|${DEF_WORD} ${a}) `)),
    ];
    for (const [i, line] of lines.entries()) {
      const ctx = `${line}${(lines[i + 1] ?? "").trimStart()}`;
      if (line.includes(` ${full} `) || line.trim() === nick || patterns.some((re) => re.test(line) || re.test(ctx))) {
        add(p, i); // for Yahoo's "Seattle" + "Sea - DEF" this is the name's line

        break;
      }
    }
  }

  // 5. Who's starting. Roster pages label each row with its slot (QB, WR, W/R/T, BN…); depending
  //    on the app, the label lands on the name's line or just above/below it once read from a photo.
  const markers = new Map<number, string>();
  for (const [i, line] of lines.entries()) {
    const slot = slotAt(line);
    if (slot && !(slot === "K" && initialAtStart.has(i))) markers.set(i, slot);
  }
  const rows = [...found.values()].map((m) => ({ m, line: lineOf.get(m.id) ?? -1 })).filter((x) => x.line >= 0);
  let slots: string[] | null = null;
  if (markers.size >= 3) {
    // Which offset (same line, line above, line below) do this page's labels sit at?
    const offsets = [0, -1, 1];
    const score = offsets.map((o) => rows.filter((r) => markers.has(r.line + o)).length);
    const order = [offsets[score.indexOf(Math.max(...score))], ...offsets];
    const used = new Set<number>();
    const header = lines.findIndex((l) => /^ (bench|bench players|reserves?)( \d+)? $/.test(l));
    for (const r of rows.sort((a, b) => a.line - b.line)) {
      const o = order.find((x) => markers.has(r.line + x) && !used.has(r.line + x));
      if (o === undefined) {
        if (header >= 0) r.m.starter = r.line < header; // a row without its own label, under a "Bench" heading
        continue;
      }
      used.add(r.line + o);
      r.m.starter = !BENCH.has(markers.get(r.line + o)!);
    }
    const list = [...markers.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s);
    if (list.includes("QB") && list.filter((s) => !BENCH.has(s)).length >= 6) slots = list;
  } else {
    // No per-row labels: ESPN/Sleeper-style "Bench" section header.
    const header = lines.findIndex((l) => /^ (bench|bench players|reserves?)( \d+)? $/.test(l));
    if (header >= 0) for (const r of rows) r.m.starter = r.line < header;
  }
  return { matched: [...found.values()], slots };
}
