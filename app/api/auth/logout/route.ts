import { NextResponse } from "next/server";
import { USER_COOKIE } from "@/lib/auth";

/** POST /api/auth/logout — sign out of the site on this browser. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(USER_COOKIE);
  return res;
}
