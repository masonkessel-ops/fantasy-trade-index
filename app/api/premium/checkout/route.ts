import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { PRICE_IDS, premiumAvailable, stripe, type Plan } from "@/lib/premium";
import { SITE_URL } from "@/lib/site";

/** POST /api/premium/checkout { plan: "monthly" | "season" } — start a Stripe Checkout. */
export async function POST(req: NextRequest) {
  if (!premiumAvailable()) return NextResponse.json({ error: "Premium isn't available yet." }, { status: 503 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign_in" }, { status: 401 });
  const { plan } = (await req.json().catch(() => ({}))) as { plan?: Plan };
  const price = plan && plan in PRICE_IDS ? PRICE_IDS[plan]() : "";
  if (!plan || !price) return NextResponse.json({ error: "Choose a plan." }, { status: 400 });

  const origin = req.nextUrl.origin.startsWith("http://localhost") ? req.nextUrl.origin : SITE_URL;
  const session = await stripe().checkout.sessions.create({
    mode: plan === "monthly" ? "subscription" : "payment",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.sub,
    customer_email: user.email,
    metadata: { sub: user.sub, plan },
    ...(plan === "monthly" ? { subscription_data: { metadata: { sub: user.sub } } } : { customer_creation: "always" as const }),
    allow_promotion_codes: true,
    success_url: `${origin}/premium?welcome=1`,
    cancel_url: `${origin}/premium`,
  });
  return NextResponse.json({ url: session.url });
}
