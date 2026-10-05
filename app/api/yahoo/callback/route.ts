import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, STATE_COOKIE, exchangeCode, sealSession, sessionCookieOptions, yahooConfigured } from "@/lib/yahoo";

/** GET /api/yahoo/callback — Yahoo redirects here after the user approves. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get(STATE_COOKIE)?.value;
  const fail = (reason: string) => {
    const r = NextResponse.redirect(`${origin}/my-team?yahoo=${reason}`);
    r.cookies.delete(STATE_COOKIE);
    return r;
  };
  if (!yahooConfigured()) return fail("not_configured");
  if (req.nextUrl.searchParams.get("error")) return fail("denied");
  if (!code || !state || !expected || state !== expected) return fail("error");
  try {
    const session = await exchangeCode(code, origin);
    const res = NextResponse.redirect(`${origin}/my-team?yahoo=connected`);
    res.cookies.set(SESSION_COOKIE, sealSession(session), sessionCookieOptions);
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch {
    return fail("error");
  }
}
