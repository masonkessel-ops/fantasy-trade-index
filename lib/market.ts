import "server-only";
import { memo } from "./memo";
import type { Scoring } from "./types";

/**
 * Market trade values from FantasyCalc (https://fantasycalc.com), which are
 * calculated from real fantasy trades. Free public API, keyed by Sleeper ID.
 * Redraft, 12 teams, 1 QB. If the API is down we fall back to model-only values.
 */
export interface MarketValue {
  value: number;
  /** value as a share of the #1 player's (0–1); this is linear "trade currency" */
  share: number;
  rank: number;
  trend30Day: number;
}

const PPR: Record<Scoring, string> = { ppr: "1", half: "0.5", std: "0" };

export function getMarketValues(scoring: Scoring): Promise<Map<string, MarketValue>> {
  return memo(`market:${scoring}`, 3 * 60 * 60_000, async () => {
    try {
      const res = await fetch(`https://api.fantasycalc.com/values/current?isDynasty=false&numQbs=1&numTeams=12&ppr=${PPR[scoring]}`, {
        next: { revalidate: 3 * 60 * 60 },
      });
      if (!res.ok) return new Map();
      const rows = (await res.json()) as { player: { sleeperId?: string }; value: number; overallRank: number; trend30Day?: number }[];
      const top = Math.max(1, ...rows.map((r) => r.value));
      const out = new Map<string, MarketValue>();
      for (const r of rows) {
        if (!r.player?.sleeperId) continue;
        out.set(r.player.sleeperId, { value: r.value, share: r.value / top, rank: r.overallRank, trend30Day: r.trend30Day ?? 0 });
      }
      return out;
    } catch {
      return new Map();
    }
  });
}
