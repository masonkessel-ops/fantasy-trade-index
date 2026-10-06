import "server-only";
import { command, storeConfigured } from "./store";

/**
 * Newsletter signups. With beehiiv set up (BEEHIIV_API_KEY + BEEHIIV_PUBLICATION_ID),
 * people are added straight to the beehiiv publication; until then, emails are kept
 * in the site's database so none are lost (export them with `SMEMBERS newsletter:emails`).
 */
const key = () => (process.env.BEEHIIV_API_KEY ?? "").trim();
const pub = () => (process.env.BEEHIIV_PUBLICATION_ID ?? "").trim();

export const newsletterConfigured = () => !!(key() && pub()) || storeConfigured();

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function subscribe(email: string, source: string) {
  if (key() && pub()) {
    const res = await fetch(`https://api.beehiiv.com/v2/publications/${pub()}/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: true,
        utm_source: "fantasy-trade-index",
        utm_medium: "website",
        utm_campaign: source,
        referring_site: "fantasy-trade-index.vercel.app",
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`beehiiv_${res.status}`);
    return;
  }
  if (!storeConfigured()) throw new Error("not_configured");
  await command(["SADD", "newsletter:emails", email]);
  await command(["HSET", "newsletter:sources", email, `${source}|${new Date().toISOString()}`]);
}

/** At most `limit` signups per IP per hour (only when the database is set up). */
export async function allowSignup(ip: string, limit = 5) {
  if (!storeConfigured()) return true;
  const k = `rl:newsletter:${ip}`;
  const n = await command<number>(["INCR", k]);
  if (n === 1) await command(["EXPIRE", k, "3600"]);
  return n <= limit;
}
