import { NextResponse } from "next/server";
import { getAdvice, type AdviceTeam } from "@/lib/advice";
import type { Scoring } from "@/lib/types";

const ID = /^[A-Za-z0-9]{1,12}$/;
const ids = (v: unknown, max = 60) => (Array.isArray(v) ? v.map(String).filter((x) => ID.test(x)).slice(0, max) : []);

/** POST /api/advice — start/sit swaps, waiver pickups and trade ideas for a roster. */
export async function POST(req: Request) {
  let body: { scoring?: Scoring; team?: Partial<AdviceTeam> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const t = body.team ?? {};
  const playerIds = ids(t.playerIds);
  if (!playerIds.length) return NextResponse.json({ error: "Add some players to your team first." }, { status: 400 });
  const scoring: Scoring = body.scoring === "half" || body.scoring === "std" ? body.scoring : "ppr";
  const team: AdviceTeam = {
    playerIds,
    starters: ids(t.starters, 20),
    rosterPositions: Array.isArray(t.rosterPositions) ? t.rosterPositions.map(String).slice(0, 30) : [],
    myRosterId: typeof t.myRosterId === "number" ? t.myRosterId : undefined,
    leagueTeams: Array.isArray(t.leagueTeams)
      ? t.leagueTeams.slice(0, 32).map((lt) => ({
          rosterId: Number(lt.rosterId),
          teamName: String(lt.teamName ?? "Team").slice(0, 80),
          players: ids(lt.players),
        }))
      : undefined,
  };
  try {
    return NextResponse.json(await getAdvice(scoring, team));
  } catch {
    return NextResponse.json({ error: "Couldn't build recommendations right now." }, { status: 502 });
  }
}
