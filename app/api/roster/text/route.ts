import { NextResponse } from "next/server";
import { matchRosterText } from "@/lib/rosterMatch";

/** POST /api/roster/text { text } — find the players named in pasted roster text. Free, no AI. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = String(body.text ?? "").slice(0, 60_000);
  if (text.trim().length < 3) return NextResponse.json({ error: "Paste your roster first." }, { status: 400 });
  const matched = await matchRosterText(text);
  return NextResponse.json({ matched, unmatched: [] });
}
