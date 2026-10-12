import { NextResponse, type NextRequest } from "next/server";
import { KTC_CHOICES, getCrowdBoard, getTallies, recordRound, type KtcChoice } from "@/lib/ktc";
import { clientIp, rateLimit, storeConfigured } from "@/lib/store";

/** GET /api/ktc?ids=1,2,3 — crowd split for those players; GET /api/ktc — most kept / most cut. */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 10);
  try {
    if (ids.length) return NextResponse.json({ tallies: await getTallies(ids) });
    const board = await getCrowdBoard();
    const tallies = await getTallies([...new Set([...board.kept, ...board.cut].map((x) => x.id))]);
    return NextResponse.json({ ...board, tallies }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ kept: [], cut: [], rounds: 0, tallies: {} });
  }
}

/** POST /api/ktc { votes: [{ id, choice }] } — one round: exactly one keep, one trade, one cut. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { votes?: { id?: unknown; choice?: unknown }[] } | null;
  const votes = (body?.votes ?? []).map((v) => ({ id: String(v.id ?? ""), choice: v.choice as KtcChoice }));
  const valid =
    votes.length === 3 &&
    new Set(votes.map((v) => v.id)).size === 3 &&
    votes.every((v) => /^[A-Za-z0-9]{1,12}$/.test(v.id)) &&
    KTC_CHOICES.every((c) => votes.some((v) => v.choice === c));
  if (!valid) return NextResponse.json({ error: "Pick one keep, one trade and one cut." }, { status: 400 });
  if (!storeConfigured()) return NextResponse.json({ tallies: {} });
  try {
    if (!(await rateLimit(`ktc:${clientIp(req)}`, 400))) return NextResponse.json({ error: "Slow down a little and try again soon." }, { status: 429 });
    return NextResponse.json({ tallies: await recordRound(votes) });
  } catch {
    return NextResponse.json({ tallies: {} });
  }
}
