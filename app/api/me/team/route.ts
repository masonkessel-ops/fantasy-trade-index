import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { deleteTeam, saveTeam, storeConfigured } from "@/lib/store";

const MAX_BYTES = 200_000;

/** PUT /api/me/team — save the signed-in user's team.  DELETE — remove it. */
export async function PUT(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Send JSON." }, { status: 415 });
  const user = storeConfigured() ? await currentUser() : null;
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "Team is too large to save." }, { status: 413 });
  let team: { playerIds?: unknown; updatedAt?: unknown };
  try {
    team = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid team." }, { status: 400 });
  }
  if (!team || !Array.isArray(team.playerIds)) return NextResponse.json({ error: "Invalid team." }, { status: 400 });
  try {
    await saveTeam(user.sub, team);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't save right now." }, { status: 502 });
  }
}

export async function DELETE() {
  const user = storeConfigured() ? await currentUser() : null;
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    await deleteTeam(user.sub);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't delete right now." }, { status: 502 });
  }
}
