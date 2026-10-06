import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { getScoring } from "@/lib/prefs";
import { getValueBoard } from "@/lib/values";
import { SCORINGS } from "@/lib/types";
import { TradeFinderPage } from "./TradeFinderPage";

export const metadata: Metadata = { title: "Trade Finder" };

const ids = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v.join(",") : (v ?? "")).split(",").filter((x) => /^[A-Za-z0-9]{1,12}$/.test(x)).slice(0, 3);

export default async function TradeFinderRoute({ searchParams }: PageProps<"/trade-finder">) {
  const [sp, scoring] = await Promise.all([searchParams, getScoring()]);
  const board = await getValueBoard(scoring);
  return (
    <>
      <PageHeader
        eyebrow={`Week ${board.week} values · ${SCORINGS.find((s) => s.id === scoring)!.label}`}
        title={
          <>
            Trade <span className="text-gradient">Finder</span>
          </>
        }
        subtitle="Pick who you'd trade away, or type who you want. Every idea is priced on real-market trade values and has to work for your roster: no empty starting spots, and in a league, nothing the other team would laugh off."
      />
      <TradeFinderPage players={board.players} initialAway={ids(sp.away)} initialWant={ids(sp.want)} />
    </>
  );
}
