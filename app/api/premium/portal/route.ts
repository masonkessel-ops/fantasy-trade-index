import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { getPremium, premiumAvailable, stripe } from "@/lib/premium";
import { SITE_URL } from "@/lib/site";

/** POST /api/premium/portal — open Stripe's billing page (update card, cancel, receipts). */
export async function POST(req: NextRequest) {
  if (!premiumAvailable()) return NextResponse.json({ error: "Premium isn't available." }, { status: 503 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign_in" }, { status: 401 });
  const rec = await getPremium(user.sub);
  if (!rec?.customerId) return NextResponse.json({ error: "No billing account yet." }, { status: 404 });
  const origin = req.nextUrl.origin.startsWith("http://localhost") ? req.nextUrl.origin : SITE_URL;
  const portal = await stripe().billingPortal.sessions.create({ customer: rec.customerId, return_url: `${origin}/premium` });
  return NextResponse.json({ url: portal.url });
}
