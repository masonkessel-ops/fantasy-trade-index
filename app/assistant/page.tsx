import type { Metadata } from "next";
import { getScoring } from "@/lib/prefs";
import { getValueBoard } from "@/lib/values";
import { Assistant } from "./Assistant";

export const metadata: Metadata = { title: "AI Trade Assistant" };

export default async function AssistantPage() {
  const scoring = await getScoring();
  const board = await getValueBoard(scoring);
  return <Assistant players={board.players} scoring={scoring} hasKey={!!process.env.ANTHROPIC_API_KEY} />;
}
