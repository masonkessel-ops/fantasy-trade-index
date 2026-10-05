import { NextResponse } from "next/server";
import { EspnError, fetchEspnLeague, parseEspnLeague } from "@/lib/espn";
import { directoryFor, getMatcher } from "@/lib/leagueImport";
import { getNflState } from "@/lib/sleeper";

/**
 * POST /api/espn/league  { leagueId, espnS2?, swid? }
 * Cookies come in the body (never the URL), are forwarded to ESPN once, and aren't stored or logged.
 */
export async function POST(req: Request) {
  let body: { leagueId?: string; espnS2?: string; swid?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const leagueId = String(body.leagueId ?? "").trim();
  if (!/^\d{1,12}$/.test(leagueId)) return NextResponse.json({ error: "ESPN league IDs are numbers (find it in your league's URL: leagueId=…)." }, { status: 400 });
  const espnS2 = body.espnS2?.trim() || undefined;
  const swid = body.swid?.trim() || undefined;
  if ((espnS2 && !/^[A-Za-z0-9%+/=._-]{20,2000}$/.test(espnS2)) || (swid && !/^\{?[A-Fa-f0-9-]{30,40}\}?$/.test(swid))) {
    return NextResponse.json({ error: "Those cookie values don't look right. espn_s2 is a long string; SWID looks like {XXXXXXXX-XXXX-…}." }, { status: 400 });
  }
  try {
    const [{ season }, match] = await Promise.all([getNflState(), getMatcher()]);
    const raw = await fetchEspnLeague(leagueId, season, espnS2 && swid ? { espnS2, swid } : undefined);
    const league = parseEspnLeague(raw, match, swid);
    return NextResponse.json({ league, directory: await directoryFor(league) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof EspnError) return NextResponse.json({ error: e.message, needsCookies: e.status === 401 }, { status: e.status === 401 ? 401 : e.status });
    return NextResponse.json({ error: "Couldn't reach ESPN. Try again in a moment." }, { status: 502 });
  }
}
