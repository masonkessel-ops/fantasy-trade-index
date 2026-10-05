import type { Metadata } from "next";
import { getScoring } from "@/lib/prefs";
import { getValueBoard } from "@/lib/values";
import { MyTeam } from "./MyTeam";

export const metadata: Metadata = { title: "My Team" };

const playerId = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9]{1,12}$/.test(v) ? v : null);

export default async function MyTeamPage({ searchParams }: PageProps<"/my-team">) {
  const [{ yahoo, detail, away, want }, scoring] = await Promise.all([searchParams, getScoring()]);
  const board = await getValueBoard(scoring);
  // ?away=ID / ?want=ID open the trade finder pre-filled (links from player pages).
  const awayId = playerId(away);
  const wantId = playerId(want);
  const finderPreset = awayId ? { mode: "away" as const, ids: [awayId] } : wantId ? { mode: "for" as const, ids: [wantId] } : null;
  return (
    <MyTeam
      players={board.players}
      scoring={scoring}
      yahooStatus={typeof yahoo === "string" ? yahoo : null}
      yahooDetail={typeof detail === "string" ? detail.slice(0, 60) : null}
      finderPreset={finderPreset}
    />
  );
}
