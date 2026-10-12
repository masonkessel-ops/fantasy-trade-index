import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { getScoring } from "@/lib/prefs";
import { getValueBoard } from "@/lib/values";
import { newRound } from "@/lib/ktcRound";
import { KeepTradeCut, type KtcPlayer } from "./KeepTradeCut";

export const metadata: Metadata = {
  title: "Keep, Trade, Cut",
  description: "Three fantasy football players. Keep one, trade one, cut one, then see how everyone else voted.",
};

/** How many of the top players can show up in a round. */
const POOL = 180;

export default async function PlayPage() {
  const scoring = await getScoring();
  const board = await getValueBoard(scoring);
  const pool: KtcPlayer[] = board.players
    .filter((p) => p.position !== "K" && p.position !== "DST")
    .sort((a, b) => b.power - a.power)
    .slice(0, POOL)
    .map((p) => ({ id: p.id, name: p.name, position: p.position, team: p.team, age: p.age, value: p.value, posRank: p.posRank, overallRank: p.overallRank, injuryStatus: p.injuryStatus, ppg: p.ppg }));
  return (
    <>
      <PageHeader
        eyebrow={`Play · Week ${board.week}`}
        title={
          <>
            Keep · Trade · <span className="text-gradient">Cut</span>
          </>
        }
        subtitle="Three players of about the same value. Keep one, trade one, cut one, then see how everyone else voted. Quick rounds, no account needed."
      />
      <KeepTradeCut pool={pool} firstRound={newRound(pool, []).map((p) => p.id)} />
    </>
  );
}
