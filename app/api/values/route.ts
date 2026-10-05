import { NextResponse, type NextRequest } from "next/server";
import { getValueBoard } from "@/lib/values";
import type { Scoring } from "@/lib/types";

/** GET /api/values?scoring=ppr|half|std — the full trade value board as JSON. */
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("scoring");
  const scoring: Scoring = s === "half" || s === "std" ? s : "ppr";
  const board = await getValueBoard(scoring);
  return NextResponse.json(board, {
    headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
  });
}
