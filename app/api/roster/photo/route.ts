import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { matchEntries } from "@/lib/rosterMatch";

/**
 * POST /api/roster/photo { image: "data:image/png;base64,..." }
 * Claude reads the player list off a screenshot of any fantasy app; we match
 * the names to our player database. Needs ANTHROPIC_API_KEY.
 */
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

const RosterSchema = z.object({
  teamName: z.string().nullable(),
  players: z.array(
    z.object({
      name: z.string(),
      position: z.string().nullable(),
      nflTeam: z.string().nullable(),
      isStarter: z.boolean().nullable(),
    }),
  ),
});

const PROMPT = `This is a screenshot of a fantasy football team (from Yahoo, ESPN, Sleeper, NFL.com or similar).
List every NFL player on the user's roster that is visible: starters, bench and IR.
- name: exactly as shown (abbreviations like "J. Gibbs" are fine).
- position: QB, RB, WR, TE, K or DEF as shown, or null.
- nflTeam: the NFL team abbreviation shown next to the player, or null.
- isStarter: true if the player is in a starting lineup slot, false if on the bench (BN) or IR, null if you can't tell.
- For a team defense, use the team name (e.g. "Chicago Bears") and position DEF.
Skip opponents, empty slots, projections and anything that isn't a player on this roster.
teamName: the fantasy team's name if visible, else null.`;

// Simple per-IP limit: photo reading costs API credits.
const hits = new Map<string, number[]>();
const limited = (ip: string) => {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 10;
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Photo import needs the site's ANTHROPIC_API_KEY. Use Paste roster instead, or add the key in Vercel." }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many photo uploads. Try again in an hour." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { image?: string };
  const m = String(body.image ?? "").match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/);
  const mediaType = m?.[1] as (typeof TYPES)[number] | undefined;
  if (!m || !mediaType || !TYPES.includes(mediaType)) return NextResponse.json({ error: "Upload a PNG, JPG, WEBP or GIF screenshot." }, { status: 400 });
  if ((m[2].length * 3) / 4 > MAX_BYTES) return NextResponse.json({ error: "That image is over 5 MB. Try a smaller screenshot." }, { status: 413 });

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(RosterSchema) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: m[2] } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "Couldn't read a roster from that image. Try a clearer screenshot of your team page." }, { status: 422 });
    }
    const { teamName, players } = response.parsed_output;
    const { matched, unmatched } = await matchEntries(players.map((p) => ({ name: p.name, position: p.position, team: p.nflTeam, starter: p.isStarter })));
    return NextResponse.json({ teamName, matched, unmatched });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "The site's Anthropic API key is invalid." }, { status: 502 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "The photo reader is busy. Try again in a minute." }, { status: 429 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: `Photo reading failed (${e.status ?? "network"}). Try again.` }, { status: 502 });
    return NextResponse.json({ error: "Couldn't process that photo." }, { status: 500 });
  }
}
