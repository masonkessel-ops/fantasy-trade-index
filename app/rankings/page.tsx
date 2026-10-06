import type { Metadata } from "next";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { PageHeader } from "@/components/PageHeader";
import { getScoring } from "@/lib/prefs";
import { getWeeklyRankings } from "@/lib/weekly";
import { SCORINGS } from "@/lib/types";
import { RankingsTable } from "./RankingsTable";

export const metadata: Metadata = {
  title: "Weekly Rankings",
  description: "Fantasy football weekly rankings: every player ranked by projected points this week, with matchups and injuries.",
};

export default async function RankingsPage() {
  const scoring = await getScoring();
  const { week, rows } = await getWeeklyRankings(scoring);
  return (
    <>
      <PageHeader
        eyebrow={`Week ${week} · ${SCORINGS.find((s) => s.id === scoring)!.label}`}
        title={
          <>
            Weekly <span className="text-gradient">Rankings</span>
          </>
        }
        subtitle="Every player ranked by projected points this week, adjusted for injuries. Players on bye are left out. Use it as your start/sit cheat sheet."
      />
      <RankingsTable rows={rows} />
      <NewsletterSignup source="rankings" className="mt-6" />
    </>
  );
}
