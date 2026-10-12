import "server-only";
import { memo } from "./memo";
import { pipeline, storeConfigured } from "./store";

/**
 * Keep · Trade · Cut: players see three players of about the same value and must
 * keep one, trade one and cut one. Every vote is counted per player, so the crowd
 * view gets sharper the more people play. Anonymous; no account needed.
 */
export type KtcChoice = "keep" | "trade" | "cut";
export const KTC_CHOICES: KtcChoice[] = ["keep", "trade", "cut"];

export interface KtcTally {
  keep: number;
  trade: number;
  cut: number;
}

const playerKey = (id: string) => `ktc:p:${id}`;
const KEPT = "ktc:kept";
const CUT = "ktc:cut";
const ROUNDS = "ktc:rounds";

/** Record one round (exactly one of each choice) and return the updated crowd split for those players. */
export async function recordRound(votes: { id: string; choice: KtcChoice }[]) {
  const cmds: string[][] = votes.map((v) => ["HINCRBY", playerKey(v.id), v.choice, "1"]);
  for (const v of votes) {
    if (v.choice === "keep") cmds.push(["ZINCRBY", KEPT, "1", v.id]);
    if (v.choice === "cut") cmds.push(["ZINCRBY", CUT, "1", v.id]);
  }
  cmds.push(["INCR", ROUNDS]);
  await pipeline(cmds);
  return getTallies(votes.map((v) => v.id));
}

export async function getTallies(ids: string[]): Promise<Record<string, KtcTally>> {
  if (!storeConfigured() || !ids.length) return {};
  const rows = await pipeline<string[] | null>(ids.map((id) => ["HGETALL", playerKey(id)]));
  const out: Record<string, KtcTally> = {};
  ids.forEach((id, i) => {
    const flat = rows[i] ?? [];
    const t: KtcTally = { keep: 0, trade: 0, cut: 0 };
    for (let j = 0; j < flat.length; j += 2) if (flat[j] in t) t[flat[j] as KtcChoice] = Number(flat[j + 1]) || 0;
    out[id] = t;
  });
  return out;
}

/** The players the crowd keeps and cuts most, plus how many rounds have been played. */
export async function getCrowdBoard(limit = 8) {
  if (!storeConfigured()) return { kept: [], cut: [], rounds: 0 };
  const [kept, cut, rounds] = await pipeline<string[] | string | null>([
    ["ZREVRANGE", KEPT, "0", String(limit - 1), "WITHSCORES"],
    ["ZREVRANGE", CUT, "0", String(limit - 1), "WITHSCORES"],
    ["GET", ROUNDS],
  ]);
  const pairs = (flat: string[] | string | null) => {
    const a = Array.isArray(flat) ? flat : [];
    const out: { id: string; votes: number }[] = [];
    for (let i = 0; i < a.length; i += 2) out.push({ id: a[i], votes: Number(a[i + 1]) || 0 });
    return out;
  };
  return { kept: pairs(kept), cut: pairs(cut), rounds: Number(rounds) || 0 };
}

/** Every voted player's split, refreshed every couple of minutes (for trade suggestions). */
export function getCrowd(ids: string[]): Promise<Record<string, KtcTally>> {
  return memo(`ktc-crowd:${ids.join(",")}`, 2 * 60_000, () => getTallies(ids)).catch(() => ({}));
}
