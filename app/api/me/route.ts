import { NextResponse } from "next/server";
import { currentUser, googleConfigured } from "@/lib/auth";
import { getPremium, isActive, premiumAvailable } from "@/lib/premium";
import { loadTeam, storeConfigured } from "@/lib/store";

/** GET /api/me — who's signed in, and their saved team (if any). */
export async function GET() {
  const configured = googleConfigured() && storeConfigured();
  const user = configured ? await currentUser() : null;
  let team: unknown = null;
  let storeError = false;
  let premium = null;
  if (user) {
    try {
      [team, premium] = await Promise.all([loadTeam(user.sub), getPremium(user.sub)]);
    } catch {
      storeError = true;
    }
  }
  return NextResponse.json(
    {
      configured,
      user: user ? { name: user.name, email: user.email, picture: user.picture } : null,
      team,
      storeError,
      premiumAvailable: premiumAvailable(),
      premium: isActive(premium) ? { plan: premium!.plan, until: premium!.until, cancelsAtPeriodEnd: !!premium!.cancelsAtPeriodEnd, canManage: !!premium!.customerId } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
