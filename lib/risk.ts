/**
 * Player risk (0–1) and trade risk-vs-reward. Pure module, used in the browser.
 * Tweak the knobs below to change how much each factor counts.
 */
import { evaluateTrade } from "./tradeAnalysis";
import type { PlayerValue, Position } from "./types";

/** Injury status -> risk added. */
export const INJURY_RISK: Record<string, number> = { IR: 0.5, PUP: 0.45, Out: 0.4, Sus: 0.35, NA: 0.35, Doubtful: 0.3, Questionable: 0.12 };
/** Ages where decline risk starts, and where it maxes out (+AGE_RISK_MAX). */
export const AGE_RISK: Partial<Record<Position, [number, number]>> = { RB: [27, 31], WR: [30, 34], TE: [31, 35], QB: [36, 40] };
export const AGE_RISK_MAX = 0.25;
/** Boom/bust: coefficient of variation of weekly points above this starts adding risk (max +VOLATILITY_MAX). */
export const VOLATILITY_START = 0.35;
export const VOLATILITY_MAX = 0.25;
/** Players with this many games or fewer get a small-sample penalty. */
export const SMALL_SAMPLE_GAMES = 2;

export type RiskLevel = "Low" | "Medium" | "High";

export interface PlayerRisk {
  score: number;
  level: RiskLevel;
  reasons: string[];
}

export function riskLevel(score: number): RiskLevel {
  return score < 0.2 ? "Low" : score < 0.45 ? "Medium" : "High";
}

export function playerRisk(p: PlayerValue): PlayerRisk {
  let score = 0;
  const reasons: string[] = [];

  const inj = p.injuryStatus ? (INJURY_RISK[p.injuryStatus] ?? 0) : 0;
  if (inj) {
    score += inj;
    reasons.push(p.injuryStatus === "Questionable" ? "questionable" : `injury (${p.injuryStatus})`);
  }

  const band = AGE_RISK[p.position];
  if (band && p.age && p.age >= band[0]) {
    const t = Math.min(1, (p.age - band[0] + 1) / (band[1] - band[0] + 1));
    score += AGE_RISK_MAX * t;
    reasons.push(`age ${p.age}`);
  }

  const pts = p.weekPoints.filter((x): x is number => x !== null);
  if (pts.length >= 3) {
    const mean = pts.reduce((a, b) => a + b, 0) / pts.length;
    const sd = Math.sqrt(pts.reduce((a, b) => a + (b - mean) ** 2, 0) / pts.length);
    const cv = mean > 0 ? sd / mean : 1;
    if (cv > VOLATILITY_START) {
      score += Math.min(VOLATILITY_MAX, (cv - VOLATILITY_START) * 0.6);
      reasons.push("boom/bust");
    }
  }

  if (p.gamesPlayed <= SMALL_SAMPLE_GAMES && p.position !== "DST") {
    score += 0.1;
    reasons.push("small sample");
  }

  if (p.change !== null && p.change <= -4) {
    score += 0.08;
    reasons.push("value falling");
  }

  score = Math.min(1, score);
  return { score: Math.round(score * 100) / 100, level: riskLevel(score), reasons };
}

export interface TradeRiskReward {
  /** risk of what you receive / give, weighted by each player's trade power */
  riskGet: number;
  riskGive: number;
  /** positive = you take on more risk */
  riskChange: number;
  getLevel: RiskLevel;
  /** your value edge (-1 … 1) */
  reward: number;
  /** one-line plain-English summary */
  summary: string;
  /** Good / Fair / Risky / Poor overall rating */
  rating: "Great" | "Good" | "Fair" | "Risky" | "Poor";
}

const weighted = (players: PlayerValue[]) => {
  const total = players.reduce((s, p) => s + Math.max(p.power, 0.5), 0);
  return total ? players.reduce((s, p) => s + playerRisk(p).score * Math.max(p.power, 0.5), 0) / total : 0;
};

export function tradeRiskReward(give: PlayerValue[], get: PlayerValue[]): TradeRiskReward | null {
  if (!give.length || !get.length) return null;
  const { balance } = evaluateTrade(give, get);
  const riskGet = weighted(get);
  const riskGive = weighted(give);
  const riskChange = Math.round((riskGet - riskGive) * 100) / 100;
  const getLevel = riskLevel(riskGet);

  // Reward in % edge, penalised by extra risk taken on (and rewarded for shedding risk).
  const net = balance - riskChange * 0.5;
  const rating = net >= 0.12 ? "Great" : net >= 0.03 ? "Good" : net >= -0.08 ? (riskChange > 0.12 ? "Risky" : "Fair") : riskChange > 0.12 ? "Risky" : "Poor";

  const pct = Math.round(Math.abs(balance) * 100);
  const rewardText = pct < 3 ? "even value" : balance > 0 ? `+${pct}% value` : `−${pct}% value`;
  const riskText =
    Math.abs(riskChange) < 0.06 ? "about the same risk" : riskChange > 0 ? `more risk (you get ${getLevel.toLowerCase()} risk)` : "less risk";
  return { riskGet, riskGive, riskChange, getLevel, reward: balance, rating, summary: `${rewardText}, ${riskText}` };
}
