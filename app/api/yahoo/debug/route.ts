import { NextResponse } from "next/server";
import { readSession, yahooConfigured } from "@/lib/yahoo";

/**
 * GET /api/yahoo/debug — TEMPORARY diagnostics for Yahoo sign-in problems.
 * Runs a few read-only Fantasy API calls with the signed-in user's token and
 * reports Yahoo's status + message for each. Never returns the token itself.
 */
const PATHS = [
  "/game/nfl",
  "/users;use_login=1",
  "/users;use_login=1/games",
  "/users;use_login=1/games;game_keys=nfl/teams",
  "/users;use_login=1/games;game_keys=nfl/leagues",
];

export async function GET() {
  if (!yahooConfigured()) return NextResponse.json({ error: "not configured" });
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "not signed in" });
  const results: Record<string, string> = {};
  for (const path of PATHS) {
    for (const fmt of ["?format=json", ""]) {
      const res = await fetch(`https://fantasysports.yahooapis.com/fantasy/v2${path}${fmt}`, {
        headers: { Authorization: `Bearer ${s.accessToken}` },
        cache: "no-store",
      });
      const text = (await res.text()).replace(/\s+/g, " ");
      const desc = text.match(/description"?\s*[:>]\s*"?([^"<]{0,160})/)?.[1] ?? text.slice(0, 160);
      results[`${path}${fmt ? " (json)" : " (xml)"}`] = `${res.status} ${res.ok ? "OK" : desc}`;
      if (!fmt && res.ok) break;
    }
  }
  return NextResponse.json(
    { tokenExpiresInSec: Math.round((s.expiresAt - Date.now()) / 1000), wwwAuthenticateSample: null, results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
