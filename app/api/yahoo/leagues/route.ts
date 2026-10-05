import { NextResponse, type NextRequest } from "next/server";
import { YahooApiError, YahooAuthError, readSession, yahooAuthHelp, writeSession, yahooConfigured, yahooGet, type YahooSession } from "@/lib/yahoo";
import { parseUserLeagues, type YahooLeagueSummary } from "@/lib/yahooParse";

/**
 * Ways to ask Yahoo for the signed-in user's NFL leagues, most specific first.
 * Yahoo has refused some forms for some apps, so we fall through until one works.
 */
const ATTEMPTS = [
  "/users;use_login=1/games;game_keys=nfl/leagues",
  "/users;use_login=1/games;game_codes=nfl/leagues",
  "/users;use_login=1/games/leagues",
];

/** GET /api/yahoo/leagues — the signed-in user's Yahoo NFL leagues (this season first). */
export async function GET(req: NextRequest) {
  if (!yahooConfigured()) return NextResponse.json({ error: "Yahoo sign-in isn't set up on this site yet." }, { status: 503 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Sign in with Yahoo first.", signedOut: true }, { status: 401 });
  const origin = req.nextUrl.origin;
  let current: YahooSession = session;
  const failures: string[] = [];
  let anySuccess = false;
  let leagues: YahooLeagueSummary[] = [];

  try {
    for (const path of ATTEMPTS) {
      try {
        const r = await yahooGet(path, current, origin);
        current = r.session;
        anySuccess = true;
        leagues = parseUserLeagues(r.json).sort((a, b) => b.season.localeCompare(a.season));
        if (leagues.length) break;
      } catch (e) {
        if (e instanceof YahooApiError) failures.push(e.message.replace(/^Yahoo API /, ""));
        else throw e;
      }
    }
    if (current !== session) await writeSession(current);
    if (!anySuccess) {
      return NextResponse.json(
        { error: `Yahoo refused every way of listing your leagues (${[...new Set(failures)].join("; ")}). If you just created the Yahoo app, wait 5–10 minutes and try again.` },
        { status: 502 },
      );
    }
    return NextResponse.json({ name: current.name, leagues }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof YahooAuthError) {
      await writeSession(null);
      return NextResponse.json({ error: yahooAuthHelp(e.message), signedOut: true }, { status: 401 });
    }
    return NextResponse.json({ error: "Couldn't load your Yahoo leagues. Try again in a moment." }, { status: 502 });
  }
}
