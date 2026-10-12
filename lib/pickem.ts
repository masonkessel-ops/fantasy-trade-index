import "server-only";
import { memo } from "./memo";
import { REGULAR_SEASON_WEEKS, getNflState, getPlayers, getScores, getWeekProjections, getWeekStats } from "./sleeper";
import { command, pipeline, storeConfigured } from "./store";
import type { Position } from "./types";

/**
 * Weekly Pick'em: five "who scores more?" head-to-heads each week, the same for
 * everyone. Free to play, no money involved. Picks lock at each game's kickoff
 * and are graded automatically from Sleeper's stats (PPR). Signed-in players
 * make the season leaderboard.
 */
export const PICKEM_SCORING = "ppr" as const;
const SLOTS: Position[][] = [["QB"], ["RB"], ["WR"], ["TE"], ["RB", "WR"]];
/** Candidates: the top this-many at each position by projection (household names, real starters). */
const DEPTH: Record<string, number> = { QB: 16, RB: 28, WR: 36, TE: 10 };
const OUT = new Set(["Out", "IR", "PUP", "Sus", "NA", "Doubtful"]);

export interface PickemMatchup {
  id: string;
  a: string;
  b: string;
}

export type Side = "a" | "b";
export type Picks = Record<string, Side>;

const weekKey = (season: string, week: number) => `pickem:${season}:${week}`;

/** Small seeded random number generator so every server builds the same slate. */
function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Build a week's five head-to-heads from players whose games haven't started. */
async function buildMatchups(season: string, week: number): Promise<PickemMatchup[]> {
  const [players, proj, scores] = await Promise.all([getPlayers(), getWeekProjections(season, week), getScores(season, week)]);
  const pre = new Set(scores.filter((g) => g.state === "pre").flatMap((g) => [g.home, g.away]));
  const byPos = new Map<Position, { id: string; pts: number; team: string }[]>();
  for (const [id, line] of Object.entries(proj)) {
    const p = players[id];
    if (!p?.team || !line.played || !pre.has(p.team) || OUT.has(p.injuryStatus ?? "") || !(p.position in DEPTH)) continue;
    const list = byPos.get(p.position) ?? [];
    list.push({ id, pts: line.pts[PICKEM_SCORING], team: p.team });
    byPos.set(p.position, list);
  }
  for (const [pos, list] of byPos) byPos.set(pos, list.sort((x, y) => y.pts - x.pts).slice(0, DEPTH[pos]));

  const rand = seeded(Number(season) * 100 + week);
  const used = new Set<string>();
  const out: PickemMatchup[] = [];
  for (const positions of SLOTS) {
    const pos = positions[Math.floor(rand() * positions.length)];
    const pool = (byPos.get(pos) ?? []).filter((c) => !used.has(c.id));
    // Try a few random anchors; pair each with the closest projection on another team.
    let best: { a: string; b: string; gap: number } | null = null;
    for (let t = 0; t < 12 && pool.length > 1; t++) {
      const a = pool[Math.floor(rand() * pool.length)];
      const b = pool.filter((c) => c.id !== a.id && c.team !== a.team).sort((x, y) => Math.abs(x.pts - a.pts) - Math.abs(y.pts - a.pts))[0];
      if (!b) continue;
      const gap = Math.abs(a.pts - b.pts) / Math.max(a.pts, b.pts, 1);
      if (!best || gap < best.gap) best = { a: a.id, b: b.id, gap };
      if (gap < 0.04) break;
    }
    if (!best) continue;
    used.add(best.a);
    used.add(best.b);
    out.push({ id: `m${out.length + 1}`, a: best.a, b: best.b });
  }
  return out;
}

/**
 * The week's slate. Built once (only while the week is open for picks) and saved,
 * so it never changes after people start picking. Past weeks without a saved
 * slate simply had no contest.
 */
export async function getMatchups(season: string, week: number, canBuild = true): Promise<PickemMatchup[]> {
  if (!storeConfigured()) return canBuild ? memo(`pickem-slate:${season}:${week}`, 60 * 60_000, () => buildMatchups(season, week)) : [];
  const key = `${weekKey(season, week)}:slate`;
  const saved = await command<string | null>(["GET", key]);
  if (saved) return JSON.parse(saved) as PickemMatchup[];
  if (!canBuild) return [];
  const built = await buildMatchups(season, week);
  if (built.length < 3) return built; // too few games left to build a slate; try again later
  await command(["SET", key, JSON.stringify(built), "NX"]);
  return JSON.parse((await command<string | null>(["GET", key])) ?? JSON.stringify(built)) as PickemMatchup[];
}

/** Which week is open for picks: this week, or next week once most of this week's games are done. */
export async function getOpenWeek() {
  const { season, week } = await getNflState();
  const scores = await getScores(season, week);
  const left = scores.filter((g) => g.state === "pre").length;
  const open = week < REGULAR_SEASON_WEEKS && left <= scores.length / 4 ? week + 1 : week;
  return { season, week: open, current: week };
}

export interface PlayerResult {
  id: string;
  name: string;
  team: string | null;
  position: Position;
  projected: number;
  opponent: string | null;
  kickoff: string | null;
  state: "pre" | "live" | "final";
  points: number | null;
}

export interface MatchupResult {
  id: string;
  a: PlayerResult;
  b: PlayerResult;
  /** picks close at the earlier kickoff */
  locked: boolean;
  /** set once both games are final (null = push or not done) */
  winner: Side | "push" | null;
}

/** Live status and grades for a week's slate. */
export async function getResults(season: string, week: number, slate: PickemMatchup[]): Promise<MatchupResult[]> {
  const { week: current } = await getNflState();
  const [players, proj, scores, stats] = await Promise.all([
    getPlayers(),
    getWeekProjections(season, week),
    getScores(season, week),
    week <= current ? getWeekStats(season, week) : Promise.resolve({} as Awaited<ReturnType<typeof getWeekStats>>),
  ]);
  const games = new Map<string, (typeof scores)[number]>();
  for (const g of scores) {
    games.set(g.home, g);
    games.set(g.away, g);
  }
  const now = Date.now();
  const side = (id: string): PlayerResult => {
    const p = players[id];
    const g = p?.team ? games.get(p.team) : undefined;
    const state = g?.state ?? "pre";
    return {
      id,
      name: p?.name ?? "Unknown",
      team: p?.team ?? null,
      position: p?.position ?? "WR",
      projected: Math.round((proj[id]?.pts[PICKEM_SCORING] ?? 0) * 10) / 10,
      opponent: g && p?.team ? (g.home === p.team ? `vs ${g.away}` : `@ ${g.home}`) : null,
      kickoff: g?.kickoff || null,
      state,
      points: state === "pre" ? null : Math.round((stats[id]?.pts[PICKEM_SCORING] ?? 0) * 10) / 10,
    };
  };
  return slate.map((m) => {
    const a = side(m.a);
    const b = side(m.b);
    const started = (x: PlayerResult) => x.state !== "pre" || (!!x.kickoff && Date.parse(x.kickoff) <= now);
    const done = a.state === "final" && b.state === "final";
    return {
      id: m.id,
      a,
      b,
      locked: started(a) || started(b),
      winner: done ? (a.points! > b.points! ? "a" : b.points! > a.points! ? "b" : "push") : null,
    };
  });
}

/** Save picks, keeping any pick whose matchup has already locked. */
export async function savePicks(season: string, week: number, user: string, picks: Picks, results: MatchupResult[], name: string | null) {
  const key = `${weekKey(season, week)}:picks`;
  const prev = await getPicks(season, week, user);
  const next: Picks = { ...prev };
  for (const r of results) {
    const p = picks[r.id];
    if (r.locked || (p !== "a" && p !== "b")) continue;
    next[r.id] = p;
  }
  const cmds: string[][] = [["HSET", key, user, JSON.stringify(next)], ["SADD", "pickem:weeks", `${season}:${week}`]];
  if (name && user.startsWith("u:")) cmds.push(["HSET", "pickem:names", user, name]);
  await pipeline(cmds);
  return next;
}

export async function getPicks(season: string, week: number, user: string): Promise<Picks> {
  if (!storeConfigured()) return {};
  const raw = await command<string | null>(["HGET", `${weekKey(season, week)}:picks`, user]);
  return raw ? (JSON.parse(raw) as Picks) : {};
}

export interface Standing {
  user: string;
  name: string;
  correct: number;
  graded: number;
  perfectWeeks: number;
}

/** Season standings for signed-in players, from every graded week so far. */
export function getStandings(season: string): Promise<Standing[]> {
  return memo(`pickem-standings:${season}`, 3 * 60_000, async () => {
    if (!storeConfigured()) return [];
    const weeks = ((await command<string[]>(["SMEMBERS", "pickem:weeks"])) ?? [])
      .map((w) => w.split(":"))
      .filter(([s]) => s === season)
      .map(([, w]) => Number(w))
      .sort((x, y) => x - y);
    const names = new Map<string, string>();
    const flatNames = await command<string[]>(["HGETALL", "pickem:names"]);
    for (let i = 0; i < (flatNames?.length ?? 0); i += 2) names.set(flatNames[i], flatNames[i + 1]);
    const table = new Map<string, Standing>();
    for (const week of weeks) {
      const results = await getResults(season, week, await getMatchups(season, week, false));
      const graded = results.filter((r) => r.winner === "a" || r.winner === "b");
      if (!graded.length) continue;
      const flat = (await command<string[]>(["HGETALL", `${weekKey(season, week)}:picks`])) ?? [];
      for (let i = 0; i < flat.length; i += 2) {
        const user = flat[i];
        if (!user.startsWith("u:")) continue;
        const picks = JSON.parse(flat[i + 1]) as Picks;
        const row = table.get(user) ?? { user, name: names.get(user) ?? "Player", correct: 0, graded: 0, perfectWeeks: 0 };
        const answered = graded.filter((r) => picks[r.id]);
        const right = answered.filter((r) => picks[r.id] === r.winner).length;
        row.correct += right;
        row.graded += answered.length;
        if (answered.length === results.length && right === results.length) row.perfectWeeks++;
        table.set(user, row);
      }
    }
    return [...table.values()].sort((x, y) => y.correct - x.correct || x.graded - y.graded || y.perfectWeeks - x.perfectWeeks);
  });
}
