import type { Metadata } from "next";
import { OfferCard } from "@/components/OfferCard";
import { PageHeader } from "@/components/PageHeader";
import { pickOffer } from "@/lib/offers";
import { PickEm } from "./PickEm";

export const metadata: Metadata = {
  title: "Weekly Pick'em",
  description: "Five fantasy football head-to-heads every week. Pick who scores more, free, and climb the season leaderboard.",
};

export default function PickemPage() {
  return (
    <>
      <PageHeader
        eyebrow="Play · Free"
        title={
          <>
            Weekly <span className="text-gradient">Pick&apos;em</span>
          </>
        }
        subtitle="Five head-to-heads every week. Pick who scores more fantasy points (PPR). Picks lock at kickoff and grade themselves when the games end. Free, just bragging rights."
      />
      <PickEm />
      <OfferCard offer={pickOffer(7)} title="Like making picks? Try them for real" className="mt-6" />
    </>
  );
}
