/**
 * What managers think of a player, from Keep · Trade · Cut votes. This never
 * changes a player's value; it tells trade suggestions who other managers
 * like, so offers built from crowd favorites are easier to get accepted.
 * Pure module (used in the browser and on the server).
 */
import type { PlayerValue } from "./types";

export interface Crowd {
  keep: number;
  trade: number;
  cut: number;
}

/** Votes it takes before the crowd's opinion counts fully (fewer votes are shrunk toward neutral). */
const PRIOR_VOTES = 10;
/** Votes needed before we quote the crowd on a card. */
const QUOTE_VOTES = 8;

export const crowdVotes = (c: Crowd | null | undefined) => (c ? c.keep + c.trade + c.cut : 0);

/** -1 … 1: how much managers like him (keeps minus cuts), shrunk toward 0 when there are few votes. */
export function crowdAppeal(c: Crowd | null | undefined) {
  if (!c) return 0;
  return (c.keep - c.cut) / (crowdVotes(c) + PRIOR_VOTES);
}

const pct = (n: number, d: number) => Math.round((n / d) * 100);

/** A one-line crowd note for a trade card: who's an easy sell, and who managers are down on. */
export function crowdNote(give: PlayerValue[], get: PlayerValue[]): { tone: "good" | "warn"; text: string } | null {
  const quoted = (p: PlayerValue) => crowdVotes(p.crowd) >= QUOTE_VOTES;
  const fav = give.filter(quoted).sort((a, b) => crowdAppeal(b.crowd) - crowdAppeal(a.crowd))[0];
  if (fav && fav.crowd && pct(fav.crowd.keep, crowdVotes(fav.crowd)) >= 50) {
    return { tone: "good", text: `Easy sell: managers keep ${fav.name} ${pct(fav.crowd.keep, crowdVotes(fav.crowd))}% of the time.` };
  }
  const doubt = get.filter(quoted).sort((a, b) => crowdAppeal(a.crowd) - crowdAppeal(b.crowd))[0];
  if (doubt && doubt.crowd && pct(doubt.crowd.cut, crowdVotes(doubt.crowd)) >= 40) {
    return { tone: "warn", text: `Heads up: managers cut ${doubt.name} ${pct(doubt.crowd.cut, crowdVotes(doubt.crowd))}% of the time.` };
  }
  return null;
}
