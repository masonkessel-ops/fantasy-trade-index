import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { getScoring } from "@/lib/prefs";
import { getValueBoard } from "@/lib/values";
import { edgeLabel, evaluateTrade, tradeGrade } from "@/lib/tradeAnalysis";
import { SCORINGS } from "@/lib/types";
import { TradeAnalyzer } from "./TradeAnalyzer";

const ids = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v.join(",") : (v ?? "")).split(",").filter((x) => /^[A-Za-z0-9]{1,10}$/.test(x));

/** A shared trade link previews as a picture of the trade, its verdict and grade. */
export async function generateMetadata({ searchParams }: PageProps<"/trade">): Promise<Metadata> {
  const [sp, scoring] = await Promise.all([searchParams, getScoring()]);
  const give = ids(sp.give);
  const get = ids(sp.get);
  if (!give.length || !get.length) return { title: "Trade Analyzer", description: "Grade any fantasy football trade with market-priced trade values." };
  const board = await getValueBoard(scoring);
  const byId = new Map(board.players.map((p) => [p.id, p]));
  const names = (list: string[]) => list.map((id) => byId.get(id)?.name).filter(Boolean).join(" + ");
  const r = evaluateTrade(give.map((id) => byId.get(id)!).filter(Boolean), get.map((id) => byId.get(id)!).filter(Boolean));
  const title = `${names(give)} for ${names(get)}`;
  const description = `${r.verdict === "fair" ? "Fair trade" : r.verdict === "win" ? "The giving side wins" : "The giving side overpays"} (${edgeLabel(r)}). Grade: ${tradeGrade(r.balance)}.`;
  const image = `/api/og/trade?give=${give.join(",")}&get=${get.join(",")}&scoring=${scoring}`;
  return { title, description, openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", title, description, images: [image] } };
}

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
