import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getPremium, ownerOfSubscription, periodEnd, seasonPassEnd, setPremium, stripe } from "@/lib/premium";

/**
 * POST /api/stripe/webhook — Stripe tells us about payments.
 * In Stripe: Developers → Webhooks → add https://YOUR-SITE/api/stripe/webhook with events
 * checkout.session.completed, customer.subscription.updated, customer.subscription.deleted,
 * then put its signing secret in STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "not configured" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const sub = s.metadata?.sub ?? s.client_reference_id;
      if (!sub) break;
      const customerId = typeof s.customer === "string" ? s.customer : (s.customer?.id ?? null);
      if (s.mode === "subscription" && s.subscription) {
        const subscription = await stripe().subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
        await setPremium(sub, { plan: "monthly", until: periodEnd(subscription), customerId, subscriptionId: subscription.id, cancelsAtPeriodEnd: subscription.cancel_at_period_end });
      } else if (s.mode === "payment" && s.payment_status === "paid") {
        const existing = await getPremium(sub);
        await setPremium(sub, { plan: "season", until: Math.max(seasonPassEnd(), existing?.until ?? 0), customerId, subscriptionId: existing?.subscriptionId ?? null });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const sub = subscription.metadata?.sub ?? (await ownerOfSubscription(subscription.id));
      if (!sub) break;
      const existing = await getPremium(sub);
      const ended = event.type === "customer.subscription.deleted" || subscription.status === "canceled" || subscription.status === "unpaid";
      await setPremium(sub, {
        plan: existing?.plan === "season" && (existing.until ?? 0) > Date.now() ? "season" : "monthly",
        until: ended ? Math.max(existing?.plan === "season" ? existing.until : 0, Date.now()) : periodEnd(subscription),
        customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
        subscriptionId: subscription.id,
        cancelsAtPeriodEnd: subscription.cancel_at_period_end,
      });
      break;
    }
  }
  return NextResponse.json({ received: true });
}
