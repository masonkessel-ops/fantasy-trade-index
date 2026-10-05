import { NextResponse, type NextRequest } from "next/server";
import { getNflState } from "@/lib/sleeper";
import { YahooAuthError, readSession, writeSession, yahooConfigured, yahooGet } from "@/lib/yahoo";
import { parseUserLeagues } from "@/lib/yahooParse";

/** GET /api/yahoo/leagues — the signed-in user's Yahoo NFL leagues this season. */
export async function GET(req: NextRequest) {
  if (!yahooConfigured()) return NextResponse.json({ error: "Yahoo sign-in isn't set up on this site yet." }, { status: 503 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Sign in with Yahoo first.", signedOut: true }, { status: 401 });
  try {
    const { season } = await getNflState();
    const r = await yahooGet(`/users;use_login=1/games;game_codes=nfl;seasons=${season}/leagues`, session, req.nextUrl.origin);
    if (r.refreshed) await writeSession(r.session);
    return NextResponse.json({ name: r.session.name, leagues: parseUserLeagues(r.json) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof YahooAuthError) {
      await writeSession(null);
      return NextResponse.json({ error: "Your Yahoo sign-in expired. Sign in again.", signedOut: true }, { status: 401 });
    }
    return NextResponse.json({ error: "Couldn't reach Yahoo. Try again in a moment." }, { status: 502 });
  }
}
