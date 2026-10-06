import type { Metadata } from "next";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { OfferCard } from "@/components/OfferCard";
import { pickOffer } from "@/lib/offers";
import { PageHeader } from "@/components/PageHeader";
import { getScoring } from "@/lib/prefs";
import { getWaiverTrends } from "@/lib/weekly";
import { WaiverWire } from "./WaiverWire";

export const metadata: Metadata = {
  title: "Waiver Wire",
  description: "Fantasy football waiver wire: the most added and dropped players across Sleeper leagues in the last 24 hours.",
};

export default async function WaiversPage() {
  const scoring = await getScoring();
  const { week, adds, drops } = await getWaiverTrends(scoring);
  return (
    <>
      <PageHeader
        eyebrow={`Week ${week} · last 24 hours`}
        title={
          <>
            Waiver <span className="text-gradient">Wire</span>
          </>
        }
        subtitle="Who fantasy managers are adding and dropping right now across Sleeper leagues, with each player's value and this week's projection."
      />
      <WaiverWire adds={adds} drops={drops} week={week} />
      <OfferCard offer={pickOffer(`w${week}`)} title="Back this week's breakouts with picks" className="mt-6" />
      <NewsletterSignup source="waivers" className="mt-6" />
    </>
  );
}
