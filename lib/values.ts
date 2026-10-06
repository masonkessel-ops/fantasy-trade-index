import "server-only";
import { memo } from "./memo";
import {
  REGULAR_SEASON_WEEKS,
  getAllWeekProjections,
  getAllWeekStats,
  getByeWeeks,
  getNflState,
  getPlayers,
  getSchedule,
} from "./sleeper";
import { FORMULA_KEY, MARKET_WEIGHT, computeTradeValues, fromShare, type ValueInput } from "./tradeValue";
import { getMarketValues, type MarketValue } from "./market";
import type { Player, PlayerValue, Position, Scoring, ValueBoard, WeekLine } from "./types";

/** How many players per position appear on the trade value chart. */
const MAX_LISTED: Record<Position, number> = { QB: 40, RB: 80, WR: 100, TE: 40, K: 32, DST: 32 };

const ptsFor = (line: WeekLine | undefined, scoring: Scoring) => (line ? line.pts[scoring] : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

interface SeasonData {
  season: string;
  week: number;
  players: Record<string, Player>;
  stats: Record<string, WeekLine>[];
  projections: Record<string, WeekLine>[];
  byes: Record<string, number>;
}

export async function getSeasonData(): Promise<SeasonData> {
  const state = await getNflState();
  const [players, stats, projections, byes] = await Promise.all([
    getPlayers(),
    getAllWeekStats(state.season, state.week),
    getAllWeekProjections(state.season),
    getByeWeeks(state.season),
  ]);
  return { season: state.season, week: state.week, players, stats, projections, byes };
}

/** Build trade-value inputs for every player as they looked after `asOf` week. */
function buildInputs(
  data: SeasonData,
  ids: string[],
  scoring: Scoring,
  asOf: number,
  isLatest: boolean,
): ValueInput[] {
  return ids.map((id) => {
    const p = data.players[id];
    let games = 0;
    let total = 0;
    const recent: number[] = [];
    for (let w = 1; w <= asOf; w++) {
      const line = data.stats[w - 1]?.[id];
      if (!line?.played) continue;
      games++;
      total += ptsFor(line, scoring);
      if (w > asOf - 3) recent.push(ptsFor(line, scoring));
    }

    // Rest of season: projected games after `asOf`. For the live week, a player
    // who hasn't played yet still has this week's projection ahead of him.
    let rosPoints = 0;
    let rosGames = 0;
    const firstRosWeek = isLatest && !data.stats[asOf - 1]?.[id]?.played ? asOf : asOf + 1;
    for (let w = firstRosWeek; w <= REGULAR_SEASON_WEEKS; w++) {
      const proj = data.projections[w - 1]?.[id];
      if (!proj?.played) continue;
      rosGames++;
      rosPoints += ptsFor(proj, scoring);
    }

    return {
      id,
      position: p.position,
      age: p.age,
      // We only know today's injury status, so only apply it to the latest week.
      injuryStatus: isLatest ? p.injuryStatus : null,
      gamesPlayed: games,
      seasonPpg: games ? total / games : 0,
      recentPpg: recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null,
      rosPpg: rosGames ? rosPoints / rosGames : 0,
      rosGames,
      byeWeek: p.team ? (data.byes[p.team] ?? null) : null,
    };
  });
}

export function getValueBoard(scoring: Scoring): Promise<ValueBoard> {
  return getNflState().then((state) =>
    memo(`board:${state.season}:${state.week}:${scoring}:${FORMULA_KEY}:m`, 2 * 60_000, () => computeBoard(scoring)),
  );
}

/**
 * Blend model shares with market shares (see MARKET_WEIGHT) and rescale so the
 * best player is 100. Players the market doesn't list are worth ~0 there.
 */
function blendWithMarket(
  results: ReturnType<typeof computeTradeValues>,
  market: Map<string, MarketValue>,
  data: SeasonData,
): ReturnType<typeof computeTradeValues> {
  if (!market.size || MARKET_WEIGHT <= 0) return results;
  const blended = results.map((r) => {
    const pos = data.players[r.id].position;
    const share = pos === "K" || pos === "DST" ? r.share * (1 - MARKET_WEIGHT * 0.5) : (1 - MARKET_WEIGHT) * r.share + MARKET_WEIGHT * (market.get(r.id)?.share ?? 0);
    return { r, share };
  });
  const top = Math.max(1e-9, ...blended.map((b) => b.share));
  return blended.map(({ r, share }) => ({ ...r, ...fromShare(share / top), share: share / top }));
}

async function computeBoard(scoring: Scoring): Promise<ValueBoard> {
  const [data, market] = await Promise.all([getSeasonData(), getMarketValues(scoring)]);
  const { week } = data;

  // Pool = anyone who has played or is projected to play this season.
  const ids = Object.keys(data.players).filter(
    (id) => data.stats.some((w) => w[id]?.played) || data.projections.some((w) => w[id]?.played),
  );

  // Value after every week so far -> trend line.
  const history = new Map<string, (number | null)[]>();
  let latest: ReturnType<typeof computeTradeValues> = [];
  for (let w = 1; w <= week; w++) {
    const isLatest = w === week;
    const results = blendWithMarket(computeTradeValues(buildInputs(data, ids, scoring, w, isLatest), w), market, data);
    for (const r of results) {
      if (!history.has(r.id)) history.set(r.id, Array(week).fill(null));
      history.get(r.id)![w - 1] = r.value;
    }
    if (isLatest) latest = results;
  }

  const inputs = new Map(buildInputs(data, ids, scoring, week, true).map((i) => [i.id, i]));

  // Keep the top N per position.
  const byPos = new Map<Position, typeof latest>();
  for (const r of latest) {
    const pos = data.players[r.id].position;
    if (!byPos.has(pos)) byPos.set(pos, []);
    byPos.get(pos)!.push(r);
  }
  const kept = [...byPos.entries()].flatMap(([pos, list]) =>
    list.sort((a, b) => b.share - a.share).slice(0, MAX_LISTED[pos]),
  );

  kept.sort((a, b) => b.share - a.share || a.posRank - b.posRank);
  // Displayed positional rank follows final value (incl. injury discount).
  const posCounter = new Map<Position, number>();
  const displayPosRank = new Map<string, number>();
  for (const r of kept) {
    const pos = data.players[r.id].position;
    posCounter.set(pos, (posCounter.get(pos) ?? 0) + 1);
    displayPosRank.set(r.id, posCounter.get(pos)!);
  }

  const players: PlayerValue[] = kept.map((r, i) => {
    const p = data.players[r.id];
    const input = inputs.get(r.id)!;
    const trend = history.get(r.id) ?? [];
    const prev = trend.length >= 2 ? trend[trend.length - 2] : null;
    return {
      id: r.id,
      name: p.name,
      position: p.position,
      team: p.team,
      age: p.age,
      injuryStatus: p.injuryStatus,
      value: r.value,
      power: r.power,
      marketRank: market.get(r.id)?.rank ?? null,
      change: prev === null ? null : r.value - prev,
      overallRank: i + 1,
      posRank: displayPosRank.get(r.id)!,
      ppg: round1(input.seasonPpg),
      gamesPlayed: input.gamesPlayed,
      recentPpg: input.recentPpg === null ? null : round1(input.recentPpg),
      rosPpg: round1(input.rosPpg),
      rosPoints: Math.round(input.rosPpg * input.rosGames),
      byeWeek: input.byeWeek,
      trend,
      weekPoints: data.stats.map((w) => (w[r.id]?.played ? round1(w[r.id].pts[scoring]) : null)),
      breakdown: r.breakdown,
    };
  });

  return { season: data.season, week, scoring, generatedAt: Date.now(), players };
}

export interface PlayerDetail {
  player: Player;
  value: PlayerValue | null;
  season: string;
  currentWeek: number;
  weeks: {
    week: number;
    opponent: string | null;
    actual: number | null;
    projected: number | null;
    stats: Record<string, number> | null;
  }[];
}

export async function getPlayerDetail(id: string, scoring: Scoring): Promise<PlayerDetail | null> {
  const [data, board] = await Promise.all([getSeasonData(), getValueBoard(scoring)]);
  const player = data.players[id];
  if (!player) return null;
  const schedule = await getSchedule(data.season);
  const weeks = Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => {
    const w = i + 1;
    const game = player.team
      ? schedule.find((g) => g.week === w && (g.home === player.team || g.away === player.team))
      : undefined;
    const opponent = game ? (game.home === player.team ? `vs ${game.away}` : `@ ${game.home}`) : player.team ? "BYE" : null;
    const line = data.stats[i]?.[id];
    const proj = data.projections[i]?.[id];
    return {
      week: w,
      opponent,
      actual: line?.played ? round1(line.pts[scoring]) : null,
      projected: proj?.played ? round1(proj.pts[scoring]) : null,
      stats: line?.played ? line.stats : null,
    };
  });
  return {
    player,
    value: board.players.find((p) => p.id === id) ?? null,
    season: data.season,
    currentWeek: data.week,
    weeks,
  };
}
