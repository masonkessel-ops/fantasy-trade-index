import "server-only";
import Stripe from "stripe";
import { memo } from "./memo";
import { command, storeConfigured } from "./store";

/**
 * Premium memberships, paid through Stripe and tied to a Google sign-in.
 * Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and at least one of
 * STRIPE_PRICE_MONTHLY (a recurring price) / STRIPE_PRICE_SEASON (a one-time price)
 * in Vercel. Until then, Premium is switched off and everything stays free.
 */
const env = (k: string) => (process.env[k] ?? "").trim();
export const PRICE_IDS = { monthly: () => env("STRIPE_PRICE_MONTHLY"), season: () => env("STRIPE_PRICE_SEASON") };
export type Plan = keyof typeof PRICE_IDS;

export const premiumAvailable = () => !!env("STRIPE_SECRET_KEY") && storeConfigured() && !!(PRICE_IDS.monthly() || PRICE_IDS.season());

let client: Stripe | null = null;
export const stripe = () => (client ??= new Stripe(env("STRIPE_SECRET_KEY")));

export interface PremiumRecord {
  plan: Plan;
  /** premium lasts until this time (ms) */
  until: number;
  customerId: string | null;
  subscriptionId: string | null;
  /** a monthly plan set to stop at the end of the paid period */
  cancelsAtPeriodEnd?: boolean;
}

const key = (sub: string) => `premium:${sub}`;

export async function getPremium(sub: string): Promise<PremiumRecord | null> {
  if (!storeConfigured()) return null;
  const raw = await command<string | null>(["GET", key(sub)]);
  return raw ? (JSON.parse(raw) as PremiumRecord) : null;
}

export async function setPremium(sub: string, rec: PremiumRecord) {
  await command(["SET", key(sub), JSON.stringify(rec)]);
  if (rec.subscriptionId) await command(["SET", `premium-sub:${rec.subscriptionId}`, sub]);
}

export const isActive = (r: PremiumRecord | null) => !!r && r.until > Date.now();

/** Who owns a Stripe subscription (for renewal / cancel events). */
export const ownerOfSubscription = (subscriptionId: string) => command<string | null>(["GET", `premium-sub:${subscriptionId}`]);

/** The season pass covers the fantasy season through the playoffs: until Feb 15. */
export function seasonPassEnd(now = new Date()) {
  const year = now.getUTCMonth() >= 2 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  return Date.UTC(year, 1, 15, 23, 59);
}

/** "$3.99 / month" style labels, read from the Stripe prices (cached for an hour). */
export function priceLabels() {
  return memo("premium-prices", 60 * 60_000, async () => {
    const label = async (id: string, suffix: string) => {
      if (!id) return null;
      const p = await stripe().prices.retrieve(id);
      if (p.unit_amount == null) return null;
      const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency.toUpperCase() }).format(p.unit_amount / 100);
      return `${amount} ${suffix}`;
    };
    const [monthly, season] = await Promise.all([label(PRICE_IDS.monthly(), "/ month"), label(PRICE_IDS.season(), "/ season")]);
    return { monthly, season };
  });
}

/** When a subscription's paid period ends (ms). Newer Stripe API versions keep this on the item. */
export function periodEnd(s: Stripe.Subscription) {
  const end = s.items.data.reduce((max, i) => Math.max(max, i.current_period_end ?? 0), 0);
  return end * 1000;
}
