import "server-only";

/**
 * DFS / pick'em partner offers (affiliate links). Each partner shows up only after its
 * approved referral link is set in Vercel, e.g.
 *   OFFER_UNDERDOG_URL=https://...        OFFER_UNDERDOG_TEXT="Play $5, get $50 in bonus picks"
 * Partners: UNDERDOG, PRIZEPICKS, SLEEPER, DRAFTKINGS. Premium members never see offers.
 */
export interface Offer {
  id: string;
  name: string;
  url: string;
  /** the partner's current new-player promo, e.g. "Play $5, get $50" */
  text: string;
  color: string;
}

const PARTNERS = [
  { id: "underdog", name: "Underdog", color: "#facc15" },
  { id: "prizepicks", name: "PrizePicks", color: "#a78bfa" },
  { id: "sleeper", name: "Sleeper Picks", color: "#22d3ee" },
  { id: "draftkings", name: "DraftKings Pick6", color: "#4ade80" },
];

const env = (k: string) => (process.env[k] ?? "").trim();

export function getOffers(): Offer[] {
  return PARTNERS.map((p) => ({ ...p, url: env(`OFFER_${p.id.toUpperCase()}_URL`), text: env(`OFFER_${p.id.toUpperCase()}_TEXT`) || "Claim the new-player bonus" })).filter((o) =>
    /^https:\/\//.test(o.url),
  );
}

/** One offer for a page, rotated by a seed (e.g. the week or a player id) so partners share the spots. */
export function pickOffer(seed: string | number): Offer | null {
  const offers = getOffers();
  if (!offers.length) return null;
  const n = [...String(seed)].reduce((s, c) => s + c.charCodeAt(0), 0);
  return offers[n % offers.length];
}
