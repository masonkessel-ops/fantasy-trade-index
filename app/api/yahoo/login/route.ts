import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE, authorizeUrl, sessionCookieOptions, yahooConfigured } from "@/lib/yahoo";

/** GET /api/yahoo/login — start "Sign in with Yahoo". */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (!yahooConfigured()) return NextResponse.redirect(`${origin}/my-team?yahoo=not_configured`);
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(origin, state));
  res.cookies.set(STATE_COOKIE, state, { ...sessionCookieOptions, maxAge: 600 });
  return res;
}
