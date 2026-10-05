import { NextResponse, type NextRequest } from "next/server";
import { directoryFor, getMatcher } from "@/lib/leagueImport";
import { YahooApiError, YahooAuthError, readSession, yahooAuthHelp, writeSession, yahooConfigured, yahooGet } from "@/lib/yahoo";
import { parseLeague } from "@/lib/yahooParse";

/** GET /api/yahoo/league/:key — one Yahoo league (settings, standings, every roster), mapped to our player IDs. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/yahoo/league/[key]">) {
  const { key } = await ctx.params;
  if (!/^\d{2,4}\.l\.\d{1,10}$/.test(key)) return NextResponse.json({ error: "Invalid Yahoo league key." }, { status: 400 });
  if (!yahooConfigured()) return NextResponse.json({ error: "Yahoo sign-in isn't set up on this site yet." }, { status: 503 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Sign in with Yahoo first.", signedOut: true }, { status: 401 });
  const origin = req.nextUrl.origin;
  try {
    const first = await yahooGet(`/league/${key}/settings`, session, origin); // may refresh the token
    const [standings, rosters, match] = await Promise.all([
      yahooGet(`/league/${key}/standings`, first.session, origin),
      yahooGet(`/league/${key}/teams/roster`, first.session, origin),
      getMatcher(),
    ]);
    if (first.refreshed) await writeSession(first.session);
    const league = parseLeague(first.json, standings.json, rosters.json, match);
    return NextResponse.json({ league, directory: await directoryFor(league) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof YahooAuthError) {
      await writeSession(null);
      return NextResponse.json(
        {
          error: yahooAuthHelp(e.message),
          signedOut: true,
        },
        { status: 401 },
      );
    }
    const detail = e instanceof YahooApiError ? ` (${e.message})` : e instanceof Error ? ` (${e.message.slice(0, 120)})` : "";
    return NextResponse.json({ error: `Couldn't load that Yahoo league${detail}.` }, { status: 502 });
  }
}
