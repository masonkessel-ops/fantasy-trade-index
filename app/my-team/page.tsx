import type { Metadata } from "next";
import { getScoring } from "@/lib/prefs";
import { getValueBoard } from "@/lib/values";
import { MyTeam } from "./MyTeam";

export const metadata: Metadata = { title: "My Team" };

export default async function MyTeamPage({ searchParams }: PageProps<"/my-team">) {
  const [{ yahoo, detail }, scoring] = await Promise.all([searchParams, getScoring()]);
  const board = await getValueBoard(scoring);
  return <MyTeam players={board.players} scoring={scoring} yahooStatus={typeof yahoo === "string" ? yahoo : null} yahooDetail={typeof detail === "string" ? detail.slice(0, 60) : null} />;
}
