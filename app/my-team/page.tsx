import type { Metadata } from "next";
import { getScoring } from "@/lib/prefs";
import { getValueBoard } from "@/lib/values";
import { MyTeam } from "./MyTeam";

export const metadata: Metadata = { title: "My Team" };

export default async function MyTeamPage() {
  const scoring = await getScoring();
  const board = await getValueBoard(scoring);
  return <MyTeam players={board.players} scoring={scoring} />;
}
