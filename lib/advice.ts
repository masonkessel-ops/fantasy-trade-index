import "server-only";
import { REGULAR_SEASON_WEEKS, getNflState, getScores, getWeekProjections, getWeekStats } from "./sleeper";
import { bestLineup } from "./teamAnalysis";
import { evaluateTrade } from "./tradeAnalysis";
import { getValueBoard } from "./values";
import type { PlayerValue, Position, Scoring } from "./types";

/* ============================== KNOBS ==================================== */

/** A trade must improve your starting lineup's total value by at least this much. */
export const MIN_LINEUP_GAIN = 3;
/** …and can't hurt the other team's starters by more than this (keeps offers realistic). */
export const MAX_PARTNER_LOSS = 5;
/** How many of each roster's most valuable players the trade finder considers. */
const TRADE_POOL = 15;
/** Waiver adds must beat the player you'd drop by this many value points. */
export const MIN_PICKUP_GAIN = 5;
/** Streaming suggestions must beat your starter's projection by this many points. */
export const MIN_STREAM_GAIN = 2;
/** Share of a player's projection to count by injury status (Sleeper projections ignore it). */
export const PLAY_CHANCE: Record<string, number> = { Out: 0, IR: 0, PUP: 0, Sus: 0, NA: 0, Doubtful: 0.25, Questionable: 0.9 };

/* ============================== TYPES ==================================== */

export interface AdviceTeam {
  playerIds: string[];
  starters?: string[];
  rosterPositions: string[];
  myRosterId?: number;
  totalRosters?: number;
  leagueTeams?: { rosterId: number; teamName: string; players: string[] }[];
}

export interface WeekLineupSpot {
  slot: string;
  id: string | null;
  points: number | null;
  locked: boolean;
  bye: boolean;
}

export interface Swap {
  start: string;
  bench: string;
  startPoints: number;
  benchPoints: number;
  gain: number;
}

export interface Pickup {
  add: string;
  drop: string | null;
  kind: "value" | "stream";
  gain: number;
  reason: string;
}

export interface TradeIdea {
  partner: { rosterId: number | null; teamName: string };
  give: string[];
  get: string[];
  myGain: number;
  theirGain: number | null;
  diff: number;
}

export interface Advice {
  /** the week this plan is for (next week once the current one is nearly over) */
  week: number;
  /** player id -> this week's points (actual if locked, else projection) */
  weekPoints: Record<string, { points: number; locked: boolean; bye: boolean }>;
  lineup: WeekLineupSpot[];
  swaps: Swap[];
  pickups: Pickup[];
  trades: TradeIdea[];
  hasLeague: boolean;
}

/* ============================== ENGINE =================================== */

const r1 = (n: number) => Math.round(n * 10) / 10;
const skill = (p: PlayerValue) => p.position !== "K" && p.position !== "DST";

function starterValue(roster: PlayerValue[], rosterPositions: string[]) {
  return bestLineup(roster, rosterPositions).starters.reduce((s, x) => s + (x.player?.value ?? 0), 0);
}

function combos<T>(items: T[], size: 1 | 2): T[][] {
  if (size === 1) return items.map((x) => [x]);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) out.push([items[i], items[j]]);
  return out;
}

/** Find fair trades that upgrade your starting lineup (and don't gut theirs). */
function findTrades(
  mine: PlayerValue[],
  partners: { rosterId: number | null; teamName: string; roster: PlayerValue[] }[],
  rosterPositions: string[],
  marketMode: boolean,
): TradeIdea[] {
  const baseMe = starterValue(mine, rosterPositions);
  const gives = [...mine].filter(skill).sort((a, b) => b.value - a.value).slice(0, TRADE_POOL);
  const ideas: (TradeIdea & { score: number })[] = [];

  for (const partner of partners) {
    const baseThem = marketMode ? 0 : starterValue(partner.roster, rosterPositions);
    const gets = [...partner.roster].filter(skill).sort((a, b) => b.value - a.value).slice(0, marketMode ? 80 : TRADE_POOL);
    const best: (TradeIdea & { score: number })[] = [];

    for (const [gSize, rSize] of [[1, 1], [2, 1], [1, 2]] as const) {
      for (const give of combos(gives, gSize)) {
        for (const get of combos(gets, rSize)) {
          const t = evaluateTrade(give, get);
          if (t.verdict === "lose") continue;
          if (t.diff > Math.max(6, Math.max(t.adjGive, t.adjGet) * 0.12)) continue; // too lopsided for them to accept
          const giveIds = new Set(give.map((p) => p.id));
          const getIds = new Set(get.map((p) => p.id));
          const myGain = starterValue([...mine.filter((p) => !giveIds.has(p.id)), ...get], rosterPositions) - baseMe;
          if (myGain < MIN_LINEUP_GAIN) continue;
          let theirGain: number | null = null;
          if (!marketMode) {
            theirGain = starterValue([...partner.roster.filter((p) => !getIds.has(p.id)), ...give], rosterPositions) - baseThem;
            if (theirGain < -MAX_PARTNER_LOSS) continue;
          }
          const score = myGain + 0.6 * (theirGain ?? 0) - 0.25 * Math.abs(t.diff) - (give.length + get.length - 2) * 1.5;
          best.push({
            partner: { rosterId: partner.rosterId, teamName: partner.teamName },
            give: give.map((p) => p.id),
            get: get.map((p) => p.id),
            myGain: Math.round(myGain),
            theirGain: theirGain === null ? null : Math.round(theirGain),
            diff: t.diff,
            score,
          });
        }
      }
    }
    best.sort((a, b) => b.score - a.score);
    ideas.push(...best.slice(0, marketMode ? 8 : 2));
  }

  // Global top picks, without repeating the same target twice.
  ideas.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: TradeIdea[] = [];
  for (const idea of ideas) {
    const key = idea.get.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ partner: idea.partner, give: idea.give, get: idea.get, myGain: idea.myGain, theirGain: idea.theirGain, diff: idea.diff });
    if (out.length >= 6) break;
  }
  return out;
}

export async function getAdvice(scoring: Scoring, team: AdviceTeam): Promise<Advice> {
  const state = await getNflState();
  // Once most of this week's games are done, plan for next week instead.
  const nowScores = await getScores(state.season, state.week);
  const stillToPlay = nowScores.filter((g) => g.state === "pre").length;
  const week = state.week < REGULAR_SEASON_WEEKS && stillToPlay <= nowScores.length / 4 ? state.week + 1 : state.week;
  const [board, proj, stats, scores] = await Promise.all([
    getValueBoard(scoring),
    getWeekProjections(state.season, week),
    week === state.week ? getWeekStats(state.season, week) : Promise.resolve({} as Awaited<ReturnType<typeof getWeekStats>>),
    week === state.week ? Promise.resolve(nowScores) : getScores(state.season, week),
  ]);
  const byId = new Map(board.players.map((p) => [p.id, p]));
  const resolve = (ids: string[]) => ids.map((id) => byId.get(id)).filter((p): p is PlayerValue => !!p);
  const mine = resolve(team.playerIds);
  const rosterPositions = team.rosterPositions?.length ? team.rosterPositions : ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"];

  // Points for the plan week: actual once a player's game has started, otherwise the projection.
  const gameState = new Map<string, string>();
  for (const g of scores) {
    gameState.set(g.home, g.state);
    gameState.set(g.away, g.state);
  }
  const weekPoints: Advice["weekPoints"] = {};
  const wk = (p: PlayerValue) => {
    if (weekPoints[p.id]) return weekPoints[p.id].points;
    const bye = !!p.team && scores.length > 0 && !gameState.has(p.team);
    const locked = !bye && !!p.team && gameState.get(p.team) !== undefined && gameState.get(p.team) !== "pre";
    const projected = (proj[p.id]?.played ? proj[p.id].pts[scoring] : 0) * (PLAY_CHANCE[p.injuryStatus ?? ""] ?? 1);
    const points = bye ? 0 : locked ? (stats[p.id]?.played ? stats[p.id].pts[scoring] : 0) : projected;
    weekPoints[p.id] = { points: r1(points), locked, bye };
    return weekPoints[p.id].points;
  };
  mine.forEach(wk);

  // 1. Best lineup this week + swaps vs. the lineup set in Sleeper.
  const opt = bestLineup(mine, rosterPositions, wk);
  const lineup: WeekLineupSpot[] = opt.starters.map((s) => ({
    slot: s.slot,
    id: s.player?.id ?? null,
    points: s.player ? weekPoints[s.player.id].points : null,
    locked: s.player ? weekPoints[s.player.id].locked : false,
    bye: s.player ? weekPoints[s.player.id].bye : false,
  }));
  const swaps: Swap[] = [];
  if (team.starters?.length) {
    const current = new Set(team.starters);
    const optimal = new Set(lineup.map((l) => l.id).filter(Boolean) as string[]);
    const toStart = mine.filter((p) => optimal.has(p.id) && !current.has(p.id) && !weekPoints[p.id].locked);
    const toBench = mine.filter((p) => current.has(p.id) && !optimal.has(p.id) && !weekPoints[p.id].locked);
    const flexOk = (a: Position, b: Position) => a === b || (["RB", "WR", "TE"].includes(a) && ["RB", "WR", "TE"].includes(b));
    for (const s of toStart.sort((a, b) => wk(b) - wk(a))) {
      const i = toBench.findIndex((b) => flexOk(s.position, b.position));
      if (i < 0) continue;
      const [b] = toBench.splice(i, 1);
      const gain = r1(wk(s) - wk(b));
      if (gain > 0) swaps.push({ start: s.id, bench: b.id, startPoints: wk(s), benchPoints: wk(b), gain });
    }
  }

  // 2. Waiver pickups (needs a league so we know who's a free agent).
  const pickups: Pickup[] = [];
  const hasLeague = !!team.leagueTeams?.length;
  if (hasLeague) {
    const rostered = new Set(team.leagueTeams!.flatMap((t) => t.players));
    const free = board.players.filter((p) => !rostered.has(p.id) && p.team);
    const base = starterValue(mine, rosterPositions);
    const starterIds = new Set(bestLineup(mine, rosterPositions).starters.map((x) => x.player?.id));
    // Never suggest dropping a starter or an injured player you're stashing.
    const droppable = mine.filter((p) => skill(p) && !starterIds.has(p.id) && !p.injuryStatus);
    const usedDrops = new Set<string>();
    const options = free
      .filter(skill)
      .slice(0, 80)
      .map((fa) => {
        let best: { drop: PlayerValue | null; lineupGain: number; valueGain: number } | null = null;
        for (const drop of droppable.length ? droppable : [null]) {
          const after = [...mine.filter((p) => p.id !== drop?.id), fa];
          const lineupGain = starterValue(after, rosterPositions) - base;
          const valueGain = fa.value - (drop?.value ?? 0);
          const score = lineupGain + 0.3 * valueGain;
          if (!best || score > best.lineupGain + 0.3 * best.valueGain) best = { drop, lineupGain, valueGain };
        }
        return { fa, ...best! };
      })
      // Worth it if he'd start for you, or he's clearly better depth at the same position.
      .filter((o) => o.lineupGain >= MIN_LINEUP_GAIN || (o.valueGain >= MIN_PICKUP_GAIN && o.drop?.position === o.fa.position))
      .sort((a, b) => b.lineupGain + 0.3 * b.valueGain - (a.lineupGain + 0.3 * a.valueGain));
    for (const o of options) {
      if (o.drop && usedDrops.has(o.drop.id)) continue;
      if (o.drop) usedDrops.add(o.drop.id);
      pickups.push({
        add: o.fa.id,
        drop: o.drop?.id ?? null,
        kind: "value",
        gain: Math.round(o.lineupGain >= MIN_LINEUP_GAIN ? o.lineupGain : o.valueGain),
        reason:
          o.lineupGain >= MIN_LINEUP_GAIN
            ? `Would start for you (+${Math.round(o.lineupGain)} lineup value): ${o.fa.recentPpg ?? o.fa.ppg} ppg lately, ${o.fa.rosPpg} projected per game.`
            : `Better depth than ${o.drop!.name} (${o.fa.value} vs. ${o.drop!.value} value).`,
      });
      if (pickups.length >= 4) break;
    }
    // Streamers for the plan week at one-starter positions.
    const slotFor: Record<string, string> = { QB: "QB", TE: "TE", K: "K", DST: "DEF" };
    for (const pos of ["QB", "TE", "K", "DST"] as Position[]) {
      if (!rosterPositions.includes(slotFor[pos])) continue; // league doesn't start this position
      const myStarter = lineup.find((l) => l.id && byId.get(l.id)?.position === pos);
      if (myStarter?.locked) continue;
      const cand = free.filter((p) => p.position === pos).sort((a, b) => wk(b) - wk(a))[0];
      if (!cand || weekPoints[cand.id]?.locked) continue;
      const gain = r1(wk(cand) - (myStarter?.points ?? 0));
      if (gain < MIN_STREAM_GAIN) continue;
      const starter = myStarter?.id ? byId.get(myStarter.id) : null;
      pickups.push({
        add: cand.id,
        drop: pos === "K" || pos === "DST" ? (starter?.id ?? null) : null,
        kind: "stream",
        gain,
        reason: `Projected ${wk(cand)} in week ${week} vs. ${starter ? `${starter.name}'s ${myStarter!.points}` : "nobody at the position"}.`,
      });
    }
  }

  // 3. Trade ideas: real league partners, or the whole market for manual rosters.
  const partners = hasLeague
    ? team.leagueTeams!.filter((t) => t.rosterId !== team.myRosterId).map((t) => ({ rosterId: t.rosterId, teamName: t.teamName, roster: resolve(t.players) }))
    : [{ rosterId: null, teamName: "Any team", roster: board.players.filter((p) => !team.playerIds.includes(p.id)) }];
  const trades = findTrades(mine, partners, rosterPositions, !hasLeague);

  return { week, weekPoints, lineup, swaps, pickups, trades, hasLeague };
}

