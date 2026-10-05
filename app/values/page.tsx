import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { getScoring } from "@/lib/prefs";
import { getValueBoard } from "@/lib/values";
import { POSITIONS, SCORINGS, type Position } from "@/lib/types";
import { ValuesTable } from "./ValuesTable";

export const metadata: Metadata = { title: "Trade Value Chart" };

export default async function ValuesPage({ searchParams }: PageProps<"/values">) {
  const [{ pos }, scoring] = await Promise.all([searchParams, getScoring()]);
  const board = await getValueBoard(scoring);
  const initialPos = POSITIONS.includes(pos as Position) ? (pos as Position) : "ALL";
  const label = SCORINGS.find((s) => s.id === scoring)!.label;

  return (
    <>
      <PageHeader
        eyebrow={`${board.season} · Week ${board.week} · ${label}`}
        title={
          <>
            Trade <span className="text-gradient">Values</span>
          </>
        }
        subtitle="Every fantasy-relevant player on one 1–100 scale. Built from season PPG, recent form, rest-of-season projections, positional scarcity, age, injuries and bye weeks."
      />
      <ValuesTable players={board.players} initialPos={initialPos} />
    </>
  );
}
