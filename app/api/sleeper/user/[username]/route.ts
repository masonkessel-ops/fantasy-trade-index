import { NextResponse } from "next/server";
import { getNflState, getSleeperUser, getUserLeagues } from "@/lib/sleeper";

/** GET /api/sleeper/user/:username — the user plus their leagues this season. */
export async function GET(_req: Request, ctx: RouteContext<"/api/sleeper/user/[username]">) {
  const { username } = await ctx.params;
  if (!/^[\w.-]{1,40}$/.test(username)) {
    return NextResponse.json({ error: "That doesn't look like a Sleeper username." }, { status: 400 });
  }
  try {
    const user = await getSleeperUser(username);
    if (!user) return NextResponse.json({ error: `No Sleeper user named "${username}".` }, { status: 404 });
    const { season } = await getNflState();
    const leagues = await getUserLeagues(user.userId, season);
    return NextResponse.json({ user, season, leagues }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "Couldn't reach Sleeper. Try again in a moment." }, { status: 502 });
  }
}
