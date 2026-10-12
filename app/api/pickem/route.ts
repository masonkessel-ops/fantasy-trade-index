import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { currentUser, googleConfigured } from "@/lib/auth";
import { getMatchups, getOpenWeek, getPicks, getResults, getStandings, savePicks, type Picks } from "@/lib/pickem";
import { clientIp, rateLimit, storeConfigured } from "@/lib/store";

const DEVICE_COOKIE = "fti_dev";

/** Who's picking: a signed-in Google account, or this browser. */
async function whoAmI() {
  const user = googleConfigured() ? await currentUser() : null;
  const jar = await cookies();
  let device = jar.get(DEVICE_COOKIE)?.value ?? null;
  const fresh = !device;
  if (!device) device = crypto.randomUUID();
  // Leaderboard name: first name + last initial ("Mason K.").
  const parts = user?.name.trim().split(/\s+/) ?? [];
  const name = parts.length ? (parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]) : null;
  return { key: user ? `u:${user.sub}` : `d:${device}`, user, name, device, fresh };
}

async function payload(week: number | null, me: Awaited<ReturnType<typeof whoAmI>>) {
  const open = await getOpenWeek();
  const w = week && week >= 1 && week <= open.week ? week : open.week;
  const slate = await getMatchups(open.season, w, w === open.week);
  const [matchups, picks, standings] = await Promise.all([getResults(open.season, w, slate), getPicks(open.season, w, me.key), getStandings(open.season)]);
  const graded = matchups.filter((m) => m.winner === "a" || m.winner === "b");
  const mine = standings.find((s) => s.user === me.key) ?? null;
  return {
    season: open.season,
    week: w,
    openWeek: open.week,
    matchups,
    picks,
    record: {
      week: { correct: graded.filter((m) => picks[m.id] === m.winner).length, graded: graded.filter((m) => picks[m.id]).length },
      season: mine ? { correct: mine.correct, graded: mine.graded, rank: standings.indexOf(mine) + 1 } : null,
    },
    leaderboard: standings.slice(0, 20).map((s) => ({ name: s.name, correct: s.correct, graded: s.graded, perfectWeeks: s.perfectWeeks, me: s.user === me.key })),
    players: standings.length,
    signedIn: !!me.user,
    signInAvailable: googleConfigured() && storeConfigured(),
    saving: storeConfigured(),
  };
}

function withDevice(res: NextResponse, me: Awaited<ReturnType<typeof whoAmI>>) {
  if (me.fresh) res.cookies.set(DEVICE_COOKIE, me.device, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 400 });
  return res;
}

/** GET /api/pickem?week=6 — the slate, your picks, live grades and the leaderboard. */
export async function GET(req: NextRequest) {
  const me = await whoAmI();
  const week = Number(req.nextUrl.searchParams.get("week")) || null;
  try {
    return withDevice(NextResponse.json(await payload(week, me), { headers: { "Cache-Control": "no-store" } }), me);
  } catch {
    return NextResponse.json({ error: "Pick'em is unavailable right now. Try again in a minute." }, { status: 503 });
  }
}

/** POST /api/pickem { week, picks: { m1: "a" } } — save picks (locked matchups keep their pick). */
export async function POST(req: NextRequest) {
  const me = await whoAmI();
  if (!storeConfigured()) return NextResponse.json({ error: "Saving picks isn't set up yet." }, { status: 503 });
  if (!(await rateLimit(`pickem:${clientIp(req)}`, 120))) return NextResponse.json({ error: "Too many changes. Try again in a bit." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { week?: number; picks?: Picks } | null;
  const open = await getOpenWeek();
  const week = Number(body?.week);
  if (week !== open.week && week !== open.current) return NextResponse.json({ error: "That week isn't open for picks." }, { status: 400 });
  try {
    const results = await getResults(open.season, week, await getMatchups(open.season, week, week === open.week));
    await savePicks(open.season, week, me.key, body?.picks ?? {}, results, me.name);
    return withDevice(NextResponse.json(await payload(week, me)), me);
  } catch {
    return NextResponse.json({ error: "Couldn't save your picks. Try again." }, { status: 503 });
  }
}
