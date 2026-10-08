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
import { FORMULA_KEY, FULL_SNAP_SHARE, computeTradeValues, depthScore, fromShare, marketInjury, marketWeight, type ValueInput } from "./tradeValue";
import { getMarketValues, type MarketValue } from "./market";
import { getEspnPlayers, type EspnPlayer } from "./espnPlayers";
import { buildMatcher } from "./playerMatch";
import type { Player, PlayerRole, PlayerValue, Position, Scoring, ValueBoard, WeekLine } from "./types";

/**
 * Share of a player's projected weekly points to count for lineup math, by
 * injury status (projections already skip known missed games; this covers the
 * chance he misses more).
 */
const LINEUP_INJURY: Record<string, number> = { Questionable: 0.97, Doubtful: 0.9, Out: 0.9, Sus: 0.9, IR: 0.8, PUP: 0.8, NA: 0.8 };

/** How many players per position appear on the trade value chart. */
const MAX_LISTED: Record<Position, number> = { QB: 40, RB: 80, WR: 100, TE: 40, K: 32, DST: 32 };

const ptsFor = (line: WeekLine | undefined, scoring: Scoring) => (line ? line.pts[scoring] : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Games of usage that count toward a player's opportunity (his current role). */
const USAGE_GAMES = 4;

interface SeasonData {
  season: string;
  week: number;
  players: Record<string, Player>;
  stats: Record<string, WeekLine>[];
  projections: Record<string, WeekLine>[];
  byes: Record<string, number>;
  /** ESPN's view of each player, keyed by Sleeper id (empty if ESPN is down) */
  espn: Map<string, EspnPlayer>;
}

export async function getSeasonData(): Promise<SeasonData> {
  const state = await getNflState();
  const [rawPlayers, stats, projections, byes, espnById] = await Promise.all([
    getPlayers(),
    getAllWeekStats(state.season, state.week),
    getAllWeekProjections(state.season),
    getByeWeeks(state.season),
    getEspnPlayers(state.season),
  ]);
  // Match ESPN players to Sleeper ids (Sleeper lists ESPN ids for older players only).
  const match = buildMatcher(rawPlayers);
  const bySleeper = new Map<string, EspnPlayer>();
  for (const e of espnById.values()) {
    const id = match(e);
    if (id && !bySleeper.has(id)) bySleeper.set(id, e);
  }
  // ESPN refreshes injury designations through the day; Sleeper's player list is daily.
  const espn = new Map<string, EspnPlayer>();
  const players: Record<string, Player> = {};
  for (const [id, p] of Object.entries(rawPlayers)) {
    const e = (p.espnId ? espnById.get(p.espnId) : undefined) ?? bySleeper.get(id);
    if (e) espn.set(id, e);
    players[id] = e && e.injuryStatus !== p.injuryStatus && p.injuryStatus !== "PUP" && p.injuryStatus !== "NA" ? { ...p, injuryStatus: e.injuryStatus } : p;
  }
  return { season: state.season, week: state.week, players, stats, projections, byes, espn };
}

/** What a target, carry and pass attempt are worth at each position this season (through `asOf`). */
function usageRates(data: SeasonData, scoring: Scoring, asOf: number) {
  const perRec = scoring === "ppr" ? 1 : scoring === "half" ? 0.5 : 0;
  const sums = new Map<Position, { recPts: number; tgt: number; rushPts: number; rush: number; passPts: number; pass: number }>();
  for (let w = 0; w < asOf; w++) {
    for (const [id, line] of Object.entries(data.stats[w] ?? {})) {
      const pos = data.players[id]?.position;
      if (!pos || pos === "K" || pos === "DST" || !line.played) continue;
      const n = (k: string) => line.stats[k] ?? 0;
      const t = sums.get(pos) ?? { recPts: 0, tgt: 0, rushPts: 0, rush: 0, passPts: 0, pass: 0 };
      t.recPts += n("rec") * perRec + n("rec_yd") * 0.1 + n("rec_td") * 6;
      t.tgt += n("rec_tgt");
      t.rushPts += n("rush_yd") * 0.1 + n("rush_td") * 6;
      t.rush += n("rush_att");
      t.passPts += n("pass_yd") * 0.04 + n("pass_td") * 4 - n("pass_int");
      t.pass += n("pass_att");
      sums.set(pos, t);
    }
  }
  const rate = (pts: number, count: number, fallback: number) => (count >= 50 ? pts / count : fallback);
  const out = new Map<Position, { tgt: number; rush: number; pass: number }>();
  for (const pos of ["QB", "RB", "WR", "TE"] as Position[]) {
    const t = sums.get(pos) ?? { recPts: 0, tgt: 0, rushPts: 0, rush: 0, passPts: 0, pass: 0 };
    out.set(pos, { tgt: rate(t.recPts, t.tgt, 1 + perRec * 0.65), rush: rate(t.rushPts, t.rush, 0.6), pass: rate(t.passPts, t.pass, 0.45) });
  }
  return out;
}

type Rates = ReturnType<typeof usageRates>;

/** A player's usage over his last USAGE_GAMES games through `asOf`: per-game volume, expected points and snap share. */
function usageOf(data: SeasonData, id: string, asOf: number, rates: Rates) {
  const pos = data.players[id]?.position;
  const r = pos ? rates.get(pos) : undefined;
  let games = 0, tgt = 0, rush = 0, pass = 0, snaps = 0, teamSnaps = 0;
  for (let w = asOf; w >= 1 && games < USAGE_GAMES; w--) {
    const line = data.stats[w - 1]?.[id];
    if (!line?.played) continue;
    games++;
    tgt += line.stats.rec_tgt ?? 0;
    rush += line.stats.rush_att ?? 0;
    pass += line.stats.pass_att ?? 0;
    snaps += line.stats.off_snp ?? 0;
    teamSnaps += line.stats.tm_off_snp ?? 0;
  }
  if (!games || !r) return { games, tgtPg: 0, rushPg: 0, xfp: null, snapShare: null };
  return {
    games,
    tgtPg: tgt / games,
    rushPg: rush / games,
    xfp: (tgt * r.tgt + rush * r.rush + pass * r.pass) / games,
    snapShare: teamSnaps ? snaps / teamSnaps : null,
  };
}

/** ESPN's projected points for weeks `from`…end of season (null if ESPN doesn't project him). */
function espnRos(e: EspnPlayer | undefined, from: number, scoring: Scoring) {
  if (!e) return null;
  const perRec = scoring === "ppr" ? 0 : scoring === "half" ? 0.5 : 1;
  let points = 0;
  let games = 0;
  for (let w = from; w <= REGULAR_SEASON_WEEKS; w++) {
    const pr = e.proj[w];
    if (!pr || pr.ppr <= 0) continue;
    games++;
    points += pr.ppr - perRec * pr.rec;
  }
  return games ? { points, games } : null;
}

/**
 * 0–1 role on his team: depth chart spot, snap share (vs. a full-time share for the
 * position) and, for the live week, how many ESPN managers start him (rostered share
 * when he's on bye or hurt, since nobody starts those).
 */
function roleScore(p: Player, snapShare: number | null, e: EspnPlayer | undefined, onBye: boolean) {
  if (p.position === "K" || p.position === "DST") return 1;
  const parts = [depthScore(p.position, p.depthOrder)];
  if (snapShare !== null) parts.push(Math.min(1, snapShare / FULL_SNAP_SHARE[p.position]));
  if (e) parts.push(onBye || p.injuryStatus ? (e.percentOwned / 100) * 0.85 : e.percentStarted / 100);
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/** What the player page and compare view show about a player's role. */
function roleOf(data: SeasonData, p: Player, use: ReturnType<typeof usageOf>): PlayerRole {
  const e = data.espn.get(p.id);
  return {
    depth: p.depthPos && p.depthOrder ? `${p.depthPos}${p.depthOrder}` : null,
    snapShare: use.snapShare === null ? null : Math.round(use.snapShare * 100) / 100,
    targetsPerGame: round1(use.tgtPg),
    carriesPerGame: round1(use.rushPg),
    expectedPpg: use.xfp === null ? null : round1(use.xfp),
    espnStarted: e ? Math.round(e.percentStarted) : null,
  };
}

/** Build trade-value inputs for every player as they looked after `asOf` week. */
function buildInputs(
  data: SeasonData,
  ids: string[],
  scoring: Scoring,
  asOf: number,
  isLatest: boolean,
): ValueInput[] {
  const rates = usageRates(data, scoring, asOf);
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
    // Live week: average Sleeper's projection with ESPN's (two projection systems beat one).
    const espn = isLatest ? data.espn.get(id) : undefined;
    const second = espnRos(espn, firstRosWeek, scoring);
    if (second && rosGames) [rosPoints, rosGames] = [(rosPoints + second.points) / 2, (rosGames + second.games) / 2];
    else if (second) [rosPoints, rosGames] = [second.points, second.games];
    const use = usageOf(data, id, asOf, rates);

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
      rosWeeks: Math.max(0, REGULAR_SEASON_WEEKS - firstRosWeek + 1),
      byeWeek: p.team ? (data.byes[p.team] ?? null) : null,
      xfpPpg: use.xfp,
      xfpGames: use.games,
      role: roleScore(p, use.snapShare, espn, !!p.team && data.byes[p.team] === asOf),
    };
  });
}

export function getValueBoard(scoring: Scoring): Promise<ValueBoard> {
  return getNflState().then((state) =>
    memo(`board:${state.season}:${state.week}:${scoring}:${FORMULA_KEY}:m`, 2 * 60_000, () => computeBoard(scoring)),
  );
}

/**
 * Blend model shares with market shares (see marketWeight: less market, more
 * production as the season goes on) and rescale so the
 * best player is 100. Players the market doesn't list are worth ~0 there.
 * Today's injuries also trim the market price (see MARKET_INJURY_SHARE).
 */
function blendWithMarket(
  results: ReturnType<typeof computeTradeValues>,
  market: Map<string, MarketValue>,
  data: SeasonData,
  week: number,
  isLatest: boolean,
): ReturnType<typeof computeTradeValues> {
  const mw = marketWeight(week);
  if (!market.size || mw <= 0) return results;
  const blended = results.map((r) => {
    const p = data.players[r.id];
    const marketShare = (market.get(r.id)?.share ?? 0) * (isLatest ? marketInjury(p.injuryStatus) : 1);
    const share = p.position === "K" || p.position === "DST" ? r.share * (1 - mw * 0.5) : (1 - mw) * r.share + mw * marketShare;
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
    const results = blendWithMarket(computeTradeValues(buildInputs(data, ids, scoring, w, isLatest), w), market, data, w, isLatest);
    for (const r of results) {
      if (!history.has(r.id)) history.set(r.id, Array(week).fill(null));
      history.get(r.id)![w - 1] = r.value;
    }
    if (isLatest) latest = results;
  }

  const inputs = new Map(buildInputs(data, ids, scoring, week, true).map((i) => [i.id, i]));
  const rates = usageRates(data, scoring, week);

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
      role: roleOf(data, p, usageOf(data, r.id, week, rates)),
      weekly: input.rosWeeks ? round1(((input.rosPpg * input.rosGames) / input.rosWeeks) * ((p.injuryStatus && LINEUP_INJURY[p.injuryStatus]) || 1)) : 0,
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
