import { NextResponse } from "next/server";
import { currentUser, googleConfigured } from "@/lib/auth";
import { loadTeam, storeConfigured } from "@/lib/store";

/** GET /api/me — who's signed in, and their saved team (if any). */
export async function GET() {
  const configured = googleConfigured() && storeConfigured();
  const user = configured ? await currentUser() : null;
  let team: unknown = null;
  let storeError = false;
  if (user) {
    try {
      team = await loadTeam(user.sub);
    } catch {
      storeError = true;
    }
  }
  return NextResponse.json(
    { configured, user: user ? { name: user.name, email: user.email, picture: user.picture } : null, team, storeError },
    { headers: { "Cache-Control": "no-store" } },
  );
}
