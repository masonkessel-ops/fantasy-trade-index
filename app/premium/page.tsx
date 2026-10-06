import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { PRICE_IDS, premiumAvailable, priceLabels } from "@/lib/premium";
import { PremiumPlans } from "./PremiumPlans";

export const metadata: Metadata = {
  title: "Premium",
  description: "Fantasy Trade Index Premium: every trade idea, Package deals (2-for-1s, 1-for-2s), and support for an independent fantasy tool.",
};

/** What Premium adds. Keep this in sync with what's actually gated (usePremiumLock). */
const PREMIUM_PERKS = [
  { title: "Every trade idea", text: "See all the fair trades the Trade Finder finds, not just the top 3." },
  { title: "Package deals", text: "The best 2-for-1, 3-for-1, 1-for-2 and 1-for-3 trades for your roster, with a position filter." },
  { title: "No partner offers", text: "Premium members never see partner offers or ads." },
  { title: "Support the site", text: "Keep Fantasy Trade Index independent and fast." },
];

const FREE_PERKS = ["Trade values and tiers", "Trade Analyzer with grades", "Auto lineup for the most points", "Trade Assistant", "Rankings, Waiver Wire and Live Tracker", "Top 3 trade ideas per search"];

export default async function PremiumPage({ searchParams }: PageProps<"/premium">) {
  const { welcome } = await searchParams;
  const available = premiumAvailable();
  const prices = available ? await priceLabels().catch(() => ({ monthly: null, season: null })) : { monthly: null, season: null };
  return (
    <>
      <PageHeader
        eyebrow="Fantasy Trade Index"
        title={
          <>
            Go <span className="text-gradient">Premium</span>
          </>
        }
        subtitle="Everything that makes you better at trading stays free. Premium unlocks every idea the Trade Finder finds, plus Package deals."
      />
      {available ? (
        <PremiumPlans
          prices={prices}
          offered={{ monthly: !!PRICE_IDS.monthly(), season: !!PRICE_IDS.season() }}
          perks={PREMIUM_PERKS}
          free={FREE_PERKS}
          welcome={welcome === "1"}
        />
      ) : (
        <div className="space-y-5">
          <div className="card p-6 text-sm text-muted">
            <b className="text-ink">Premium is coming soon.</b> Everything on the site is free until then. Join the weekly report to hear when it launches.
          </div>
          <NewsletterSignup source="premium-waitlist" />
        </div>
      )}
    </>
  );
}
