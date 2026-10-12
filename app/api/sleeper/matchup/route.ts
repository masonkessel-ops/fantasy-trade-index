import { NextResponse, type NextRequest } from "next/server";
import { getMatchup } from "@/lib/matchup";
import type { Scoring } from "@/lib/types";

/** GET /api/sleeper/matchup?league=…&roster=…&scoring=ppr — this week's head-to-head, live. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const league = q.get("league") ?? "";
  const roster = Number(q.get("roster"));
  const s = q.get("scoring");
  const scoring: Scoring = s === "half" || s === "std" ? s : "ppr";
  if (!/^\d{5,25}$/.test(league) || !Number.isInteger(roster) || roster < 1) return NextResponse.json({ error: "Bad league or roster." }, { status: 400 });
  try {
    const matchup = await getMatchup(league, roster, scoring);
    return NextResponse.json({ matchup }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch {
    return NextResponse.json({ error: "Couldn't reach Sleeper." }, { status: 502 });
  }
}
