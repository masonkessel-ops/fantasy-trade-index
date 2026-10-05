import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/yahoo";

/** POST /api/yahoo/logout — forget the Yahoo session on this browser. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
