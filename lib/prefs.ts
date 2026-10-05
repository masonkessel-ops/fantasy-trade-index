import "server-only";
import { cookies } from "next/headers";
import { SCORING_COOKIE, type Scoring } from "./types";

export async function getScoring(): Promise<Scoring> {
  const v = (await cookies()).get(SCORING_COOKIE)?.value;
  return v === "half" || v === "std" ? v : "ppr";
}
