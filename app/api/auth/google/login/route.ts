import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_STATE_COOKIE, googleAuthorizeUrl, googleConfigured, userCookieOptions } from "@/lib/auth";

/** GET /api/auth/google/login?next=/my-team — start "Sign in with Google". */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const next = req.nextUrl.searchParams.get("next");
  const back = next && next.startsWith("/") && !next.startsWith("//") ? next : "/my-team";
  if (!googleConfigured()) return NextResponse.redirect(`${origin}${back}?google=not_configured`);
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(googleAuthorizeUrl(origin, state));
  res.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify({ state, back }), { ...userCookieOptions, maxAge: 600 });
  return res;
}
