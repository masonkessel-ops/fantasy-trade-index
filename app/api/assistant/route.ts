import Anthropic from "@anthropic-ai/sdk";
import { boardContext, extractTrades, SYSTEM_INSTRUCTIONS, teamContext, type AssistantTeamContext } from "@/lib/assistant";
import { getValueBoard } from "@/lib/values";
import type { Scoring } from "@/lib/types";

/**
 * POST /api/assistant — streams Claude's answer as newline-delimited JSON:
 *   {"type":"text","text":"..."}      (repeated)
 *   {"type":"trades","trades":[...]}  (once, at the end, if any)
 *   {"type":"error","error":"..."}
 * The API key never leaves the server.
 */
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

// Basic per-IP rate limit so a public deploy can't burn through your API credits.
const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 25;
}

interface Body {
  messages?: { role: "user" | "assistant"; content: string }[];
  scoring?: Scoring;
  team?: AssistantTeamContext;
}

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: "missing_key" }, 503);
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return json({ error: "You're sending messages too fast. Try again in a few minutes." }, 429);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "Ask a question first." }, 400);
  if (messages[0].role !== "user") messages.shift();

  const scoring: Scoring = body.scoring === "half" || body.scoring === "std" ? body.scoring : "ppr";
  const board = await getValueBoard(scoring);
  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      let full = "";
      let forwarded = 0; // chars of `full` already sent to the browser
      const OPEN = "<trades>";

      // Forward text, but hold back the <trades> block (and anything that might be its start).
      const flush = (final: boolean) => {
        const cut = full.indexOf(OPEN);
        let safeEnd = cut >= 0 ? cut : full.length;
        if (cut < 0 && !final) {
          for (let k = Math.min(OPEN.length - 1, full.length); k > 0; k--) {
            if (OPEN.startsWith(full.slice(full.length - k))) {
              safeEnd = full.length - k;
              break;
            }
          }
        }
        if (safeEnd > forwarded) {
          send({ type: "text", text: full.slice(forwarded, safeEnd) });
          forwarded = safeEnd;
        }
      };

      try {
        const claude = client.beta.messages.stream(
          {
            model: MODEL,
            max_tokens: 8000,
            output_config: { effort: "medium" },
            // Re-run on Anthropic's recommended model if a safety classifier declines.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            system: [
              { type: "text", text: SYSTEM_INSTRUCTIONS },
              // The board only changes every few minutes, so cache everything up to here.
              { type: "text", text: boardContext(board), cache_control: { type: "ephemeral" } },
              { type: "text", text: teamContext(body.team, board) },
            ],
            messages,
          },
          { signal: req.signal },
        );

        for await (const event of claude) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            full += event.delta.text;
            flush(false);
          }
        }
        const final = await claude.finalMessage();
        if (final.stop_reason === "refusal") {
          send({ type: "error", error: "Claude couldn't help with that request. Try rephrasing it." });
        } else {
          flush(true);
          const trades = extractTrades(full, board);
          if (trades.length) send({ type: "trades", trades });
          if (final.stop_reason === "max_tokens") send({ type: "text", text: "\n\n_(Reply cut off — ask me to continue.)_" });
        }
      } catch (err) {
        if (req.signal.aborted) {
          // Browser hung up; nothing to report.
        } else if (err instanceof Anthropic.AuthenticationError) {
          send({ type: "error", error: "The Anthropic API key is invalid. Check ANTHROPIC_API_KEY." });
        } else if (err instanceof Anthropic.RateLimitError) {
          send({ type: "error", error: "Claude is rate limited right now. Try again in a minute." });
        } else if (err instanceof Anthropic.APIError) {
          send({ type: "error", error: `Claude API error (${err.status ?? "network"}). Try again.` });
        } else {
          send({ type: "error", error: "Something went wrong talking to Claude." });
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
