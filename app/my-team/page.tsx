import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getScoring } from "@/lib/prefs";
import { getValueBoard } from "@/lib/values";
import { MyTeam } from "./MyTeam";

export const metadata: Metadata = { title: "My Team" };

const playerId = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9]{1,12}$/.test(v) ? v : null);

export default async function MyTeamPage({ searchParams }: PageProps<"/my-team">) {
  const [{ yahoo, google, detail, away, want }, scoring] = await Promise.all([searchParams, getScoring()]);
  // Older links opened the trade finder here; it has its own page now.
  const awayId = playerId(away);
  const wantId = playerId(want);
  if (awayId) redirect(`/trade-finder?away=${awayId}`);
  if (wantId) redirect(`/trade-finder?want=${wantId}`);
  const board = await getValueBoard(scoring);
  return (
    <MyTeam
      players={board.players}
      scoring={scoring}
      yahooStatus={typeof yahoo === "string" ? yahoo : null}
      googleStatus={typeof google === "string" ? google : null}
      yahooDetail={typeof detail === "string" ? detail.slice(0, 60) : null}
    />
  );
}
