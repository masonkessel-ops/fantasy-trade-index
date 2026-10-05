import { NextResponse } from "next/server";
import { readSession, yahooConfigured } from "@/lib/yahoo";

/** GET /api/yahoo/me — is Yahoo set up on this deployment, and is this browser signed in? */
export async function GET() {
  const s = yahooConfigured() ? await readSession() : null;
  return NextResponse.json({ configured: yahooConfigured(), signedIn: !!s, name: s?.name ?? null }, { headers: { "Cache-Control": "no-store" } });
}
