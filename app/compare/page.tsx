import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { getScoring } from "@/lib/prefs";
import { getValueBoard } from "@/lib/values";
import { SCORINGS } from "@/lib/types";
import { CompareView } from "./CompareView";

export const metadata: Metadata = {
  title: "Compare Players",
  description: "Compare fantasy football players side by side: trade value, tier, points per game, recent form, projections and risk.",
};

const ids = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v.join(",") : (v ?? "")).split(",").filter((x) => /^[A-Za-z0-9]{1,12}$/.test(x)).slice(0, 3);

export default async function ComparePage({ searchParams }: PageProps<"/compare">) {
  const [sp, scoring] = await Promise.all([searchParams, getScoring()]);
  const board = await getValueBoard(scoring);
  return (
    <>
      <PageHeader
        eyebrow={`Week ${board.week} · ${SCORINGS.find((s) => s.id === scoring)!.label}`}
        title={
          <>
            Compare <span className="text-gradient">Players</span>
          </>
        }
        subtitle="Put up to three players side by side. The best number in each row is highlighted."
      />
      <CompareView players={board.players} initialIds={ids(sp.ids)} />
    </>
  );
}
