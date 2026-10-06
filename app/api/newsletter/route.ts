import { NextResponse, type NextRequest } from "next/server";
import { EMAIL_RE, allowSignup, newsletterConfigured, subscribe } from "@/lib/newsletter";

/** POST /api/newsletter { email, source } — sign up for the weekly trade report. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; source?: string; company?: string };
  if (body.company) return NextResponse.json({ ok: true }); // bots fill the hidden field
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!newsletterConfigured()) return NextResponse.json({ error: "Signups open soon." }, { status: 503 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!(await allowSignup(ip))) return NextResponse.json({ error: "Too many signups from here. Try again later." }, { status: 429 });
  try {
    await subscribe(email, String(body.source ?? "site").slice(0, 40));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't sign you up right now. Please try again." }, { status: 502 });
  }
}
