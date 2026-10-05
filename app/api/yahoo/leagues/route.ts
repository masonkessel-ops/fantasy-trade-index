import { NextResponse, type NextRequest } from "next/server";
import { YahooApiError, YahooAuthError, readSession, yahooAuthHelp, writeSession, yahooConfigured, yahooGet, type YahooSession } from "@/lib/yahoo";
import { parseUserLeagues } from "@/lib/yahooParse";

/** GET /api/yahoo/leagues — the signed-in user's Yahoo NFL leagues (this season first). */
export async function GET(req: NextRequest) {
  if (!yahooConfigured()) return NextResponse.json({ error: "Yahoo sign-in isn't set up on this site yet." }, { status: 503 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Sign in with Yahoo first.", signedOut: true }, { status: 401 });
  const origin = req.nextUrl.origin;
  let current: YahooSession = session;
  const get = async (path: string) => {
    const r = await yahooGet(path, current, origin);
    current = r.session;
    return r.json;
  };
  try {
    // "nfl" as a game key means Yahoo's current NFL season.
    let leagues = parseUserLeagues(await get("/users;use_login=1/games;game_keys=nfl/leagues"));
    if (!leagues.length) {
      // Fall back to every NFL season, newest first.
      leagues = parseUserLeagues(await get("/users;use_login=1/games;game_codes=nfl/leagues")).sort((a, b) => b.season.localeCompare(a.season));
    }
    if (current !== session) await writeSession(current);
    return NextResponse.json({ name: current.name, leagues }, { headers: { "Cache-Control": "no-store" } });
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
    const detail = e instanceof YahooApiError ? ` (${e.message})` : "";
    return NextResponse.json({ error: `Couldn't load your Yahoo leagues${detail}.` }, { status: 502 });
  }
}
