import { NextResponse } from "next/server";
import { getLeagueDetail, getPlayers } from "@/lib/sleeper";

/** GET /api/sleeper/league/:id — league settings + every roster, with player names attached. */
export async function GET(_req: Request, ctx: RouteContext<"/api/sleeper/league/[id]">) {
  const { id } = await ctx.params;
  if (!/^\d{5,25}$/.test(id)) return NextResponse.json({ error: "Invalid league ID." }, { status: 400 });
  try {
    const [league, players] = await Promise.all([getLeagueDetail(id), getPlayers()]);
    if (!league) return NextResponse.json({ error: "League not found." }, { status: 404 });
    // Lightweight directory so the client can show names for players off the value chart.
    const directory: Record<string, { name: string; position: string; team: string | null }> = {};
    for (const t of league.teams)
      for (const pid of t.players) {
        const p = players[pid];
        if (p) directory[pid] = { name: p.name, position: p.position, team: p.team };
      }
    return NextResponse.json({ league, directory }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "Couldn't reach Sleeper. Try again in a moment." }, { status: 502 });
  }
}
