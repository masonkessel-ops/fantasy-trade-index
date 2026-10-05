import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_STATE_COOKIE, USER_COOKIE, googleConfigured, googleUserFromCode, sealUser, userCookieOptions } from "@/lib/auth";

/** GET /api/auth/google/callback — Google sends the user back here. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  let saved: { state?: string; back?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? "{}");
  } catch {
    /* ignore */
  }
  const back = saved.back && saved.back.startsWith("/") && !saved.back.startsWith("//") ? saved.back : "/my-team";
  const go = (status: string, detail?: string) => {
    const r = NextResponse.redirect(`${origin}${back}?google=${status}${detail ? `&detail=${encodeURIComponent(detail)}` : ""}`);
    r.cookies.delete(GOOGLE_STATE_COOKIE);
    return r;
  };
  if (!googleConfigured()) return go("not_configured");
  const err = req.nextUrl.searchParams.get("error");
  if (err) return go(err === "access_denied" ? "denied" : "error", err.slice(0, 60));
  const code = req.nextUrl.searchParams.get("code");
  if (!code || !saved.state || req.nextUrl.searchParams.get("state") !== saved.state) return go("error", "state_mismatch");
  try {
    const user = await googleUserFromCode(code, origin);
    const res = go("signed_in");
    res.cookies.set(USER_COOKIE, sealUser(user), userCookieOptions);
    return res;
  } catch (e) {
    return go("error", (e as Error).message.slice(0, 60));
  }
}
