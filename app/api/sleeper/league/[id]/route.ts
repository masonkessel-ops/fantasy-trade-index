import { NextResponse } from "next/server";
import { directoryFor } from "@/lib/leagueImport";
import { getLeagueDetail } from "@/lib/sleeper";

/** GET /api/sleeper/league/:id — league settings + every roster, with player names attached. */
export async function GET(_req: Request, ctx: RouteContext<"/api/sleeper/league/[id]">) {
  const { id } = await ctx.params;
  if (!/^\d{5,25}$/.test(id)) return NextResponse.json({ error: "Invalid league ID." }, { status: 400 });
  try {
    const league = await getLeagueDetail(id);
    if (!league) return NextResponse.json({ error: "League not found." }, { status: 404 });
    const directory = await directoryFor({ ...league, provider: "sleeper" });
    return NextResponse.json({ league: { ...league, provider: "sleeper" }, directory }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "Couldn't reach Sleeper. Try again in a moment." }, { status: 502 });
  }
}
