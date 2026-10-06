import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { getScoring } from "@/lib/prefs";
import { getValueBoard } from "@/lib/values";
import { SCORINGS } from "@/lib/types";
import { TradeAnalyzer } from "./TradeAnalyzer";

export const metadata: Metadata = { title: "Trade Analyzer" };

const ids = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v.join(",") : (v ?? "")).split(",").filter((x) => /^[A-Za-z0-9]{1,10}$/.test(x));

export default async function TradePage({ searchParams }: PageProps<"/trade">) {
  const [sp, scoring] = await Promise.all([searchParams, getScoring()]);
  const board = await getValueBoard(scoring);
  return (
    <>
      <PageHeader
        eyebrow={`Week ${board.week} values · ${SCORINGS.find((s) => s.id === scoring)!.label}`}
        title={
          <>
            Trade <span className="text-gradient">Analyzer</span>
          </>
        }
        subtitle="Add players to each side and get an instant verdict, plus risk vs reward. Values are priced on the real trade market, so stars cost what they really cost: a 100 takes about two 90s or three 85s, and 80 + 80 + 60 falls well short."
      />
      <TradeAnalyzer
        players={board.players}
        initialGive={ids(sp.give)}
        initialGet={ids(sp.get)}
        initialPartner={typeof sp.partner === "string" ? Number(sp.partner) || null : null}
      />
    </>
  );
}
