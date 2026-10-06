import "server-only";
import type { PlayerValue, Scoring, ValueBoard } from "./types";

/** Context the browser sends about the user's team (all optional). */
export interface AssistantTeamContext {
  name?: string;
  playerIds?: string[];
  rosterPositions?: string[];
  scoringSettings?: Record<string, number>;
  leagueName?: string;
  totalRosters?: number;
  leagueTeams?: { teamName: string; players: string[]; mine?: boolean }[];
}

export interface SuggestedTrade {
  title: string;
  give: string[];
  get: string[];
  partner: string | null;
  why: string;
}

const SCORING_LABEL: Record<Scoring, string> = { ppr: "PPR", half: "Half-PPR", std: "Standard" };

/** Stable instructions — first in the prompt so they cache. */
export const SYSTEM_INSTRUCTIONS = `You are the trade assistant for Fantasy Trade Index, a fantasy football site.

You help users evaluate and find fair trades using Fantasy Trade Index values. Every player has a value from 1 to 100 that blends the real trade market (60%, FantasyCalc values from thousands of actual fantasy trades) with a live stats model (40%: season points per game, last-3-week form, rest-of-season projections, positional scarcity, age, injuries and bye weeks). Good starters are 80+, the top ~10 are 94+, and ties are common. The 1-100 scale is compressed, so each player also has a "power" (0-100, their share of the top player's market price): trade fairness is judged on power, so stars cost what they really cost. A 100 takes about two 90s or three 85s; 80 + 80 + 60 falls about 45% short, and 70 + 30 is nowhere close. Near the top, a few points of value are a big gap (a 92 is worth about 60% of a 100). Multi-player packages are also discounted (the 2nd-best player on a side counts 85%, 3rd 70%, 4th 60%, then 50%). A trade is "fair" when the adjusted power of the two sides is within about 12%. Also weigh risk: injuries, age, boom/bust weeks and small samples make a player riskier.

How to answer:
- Ground every claim in the numbers provided (values, PPG, last-3, rest-of-season PPG, injury status). Quote values like "Nabers (74)".
- Respect the user's league scoring and roster settings when given. Account for their positional needs: don't suggest trading away their only starter at a thin position without filling it.
- When the user has an imported league, propose trades with actual teams in that league, using players actually on those rosters, and prefer partners whose roster needs match.
- Be concise and direct: a short answer, then the trade ideas. Use short paragraphs or bullets. No tables.
- Never invent players or values. Only use players that appear in the data below. If you don't have data for a player, say so.

Trade suggestions:
When the question is about trades (finding, evaluating, or valuing them), end your reply with 2-3 concrete trade ideas in this exact machine-readable block, after all prose:
<trades>[{"title": "short label", "give": ["<player id>"], "get": ["<player id>"], "partner": "<league team name or null>", "why": "one sentence"}]</trades>
- "give" = players the user sends away, "get" = players the user receives, using the ids from the data.
- Aim for trades that are fair or slightly favor the user (adjusted power within ~10%), and realistic for the other side.
- Don't mention the block or the ids in your prose; the app turns the block into clickable cards.
- Omit the block entirely for questions that aren't about trades.`;

const fmt = (n: number | null) => (n === null ? "-" : String(n));

function playerLine(p: PlayerValue) {
  return [p.id, p.name, p.position, p.team ?? "FA", p.value, p.power, fmt(p.ppg), fmt(p.recentPpg), fmt(p.rosPpg), fmt(p.age), p.injuryStatus ?? "", p.byeWeek ?? ""].join("|");
}

/** The value board as compact pipe-separated rows (cached block). */
export function boardContext(board: ValueBoard, limit = 260) {
  const rows = board.players.slice(0, limit).map(playerLine).join("\n");
  return `TRADE VALUE BOARD — ${board.season} season, after week ${board.week}, ${SCORING_LABEL[board.scoring]} scoring. Top ${Math.min(limit, board.players.length)} players by value.
Columns: id|name|pos|team|value|power|season_ppg|last3_ppg|ros_proj_ppg|age|injury|bye_week
${rows}`;
}

const RELEVANT_SCORING_KEYS = ["rec", "bonus_rec_te", "bonus_rec_rb", "bonus_rec_wr", "pass_td", "pass_yd", "pass_int", "rush_yd", "rec_yd", "rush_td", "rec_td", "fum_lost"];

/** The user's roster + league, per request. */
export function teamContext(team: AssistantTeamContext | undefined, board: ValueBoard) {
  if (!team?.playerIds?.length) {
    return "The user has not imported a roster. If their question depends on their roster, ask them to add it on the My Team page, or answer generally.";
  }
  const byId = new Map(board.players.map((p) => [p.id, p]));
  const describe = (id: string) => {
    const p = byId.get(id);
    return p ? `${p.name} (${p.id}, ${p.position}, value ${p.value}, power ${p.power})` : null;
  };
  const roster = team.playerIds
    .map((id) => byId.get(id))
    .filter((p): p is PlayerValue => !!p)
    .sort((a, b) => b.value - a.value);

  const lines = [
    `USER'S TEAM: ${team.name ?? "My Team"}${team.leagueName ? ` in league "${team.leagueName}" (${team.totalRosters ?? "?"} teams)` : ""}`,
    `Scoring format for values: ${SCORING_LABEL[board.scoring]}`,
  ];
  if (team.scoringSettings) {
    const s = RELEVANT_SCORING_KEYS.filter((k) => team.scoringSettings![k] !== undefined)
      .map((k) => `${k}=${team.scoringSettings![k]}`)
      .join(", ");
    if (s) lines.push(`League scoring settings: ${s}`);
  }
  if (team.rosterPositions?.length) lines.push(`Starting lineup slots: ${team.rosterPositions.filter((s) => s !== "BN" && s !== "IR").join(", ")}`);
  lines.push(`User's roster (id|name|pos|team|value|power|season_ppg|last3_ppg|ros_proj_ppg|age|injury|bye_week):`);
  lines.push(...roster.map(playerLine));
  const off = team.playerIds.length - roster.length;
  if (off > 0) lines.push(`(+${off} rostered players not on the value board, i.e. near-zero trade value)`);

  const others = (team.leagueTeams ?? []).filter((t) => !t.mine);
  if (others.length) {
    lines.push("", "OTHER TEAMS IN THE LEAGUE (only players on the value board, highest first):");
    for (const t of others.slice(0, 20)) {
      const ps = t.players
        .map((id) => byId.get(id))
        .filter((p): p is PlayerValue => !!p)
        .sort((a, b) => b.value - a.value)
        .slice(0, 16)
        .map((p) => describe(p.id))
        .join("; ");
      lines.push(`- ${t.teamName}: ${ps || "(no valued players)"}`);
    }
  }
  return lines.join("\n");
}

const TRADES_RE = /<trades>([\s\S]*?)<\/trades>/;

/** Pull the <trades> block out of the reply and keep only valid, known-id trades. */
export function extractTrades(text: string, board: ValueBoard): SuggestedTrade[] {
  const m = text.match(TRADES_RE);
  if (!m) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(m[1]);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const known = new Set(board.players.map((p) => p.id));
  const ids = (v: unknown) => (Array.isArray(v) ? v.map(String).filter((id) => known.has(id)) : []);
  return raw
    .map((t) => {
      const o = (t ?? {}) as Record<string, unknown>;
      return {
        title: String(o.title ?? "Trade idea").slice(0, 80),
        give: ids(o.give),
        get: ids(o.get),
        partner: typeof o.partner === "string" && o.partner && o.partner !== "null" ? o.partner.slice(0, 80) : null,
        why: String(o.why ?? "").slice(0, 300),
      };
    })
    .filter((t) => t.give.length && t.get.length)
    .slice(0, 3);
}
