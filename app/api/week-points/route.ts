import { NextResponse, type NextRequest } from "next/server";
import { getWeekPoints } from "@/lib/weekPoints";
import type { Scoring } from "@/lib/types";

/** GET /api/week-points?ids=a,b,c&scoring=ppr — this week's actual/projected points for those players. */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter((x) => /^[A-Za-z0-9]{1,12}$/.test(x)).slice(0, 60);
  const s = req.nextUrl.searchParams.get("scoring");
  const scoring: Scoring = s === "half" || s === "std" ? s : "ppr";
  if (!ids.length) return NextResponse.json({ week: null, points: {} });
  return NextResponse.json(await getWeekPoints(ids, scoring), { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
}
