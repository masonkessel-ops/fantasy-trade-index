"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, ArrowUp, Bot, KeyRound, RotateCcw, Sparkles, Square, Users } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { Markdown } from "@/components/Markdown";
import { TradeIdeaCard } from "@/components/TradeIdeaCard";
import { useMyTeam, type SavedTeam } from "@/lib/myTeam";
import { SCORINGS, type PlayerValue, type Scoring } from "@/lib/types";

interface Trade {
  title: string;
  give: string[];
  get: string[];
  partner: string | null;
  why: string;
}
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  trades?: Trade[];
  error?: string;
  streaming?: boolean;
}

function teamPayload(team: SavedTeam | null) {
  if (!team) return undefined;
  return {
    name: team.name,
    playerIds: team.playerIds,
    rosterPositions: team.rosterPositions,
    scoringSettings: team.league?.scoringSettings,
    leagueName: team.league?.name,
    totalRosters: team.league?.totalRosters,
    leagueTeams: team.league?.teams.map((t) => ({
      teamName: t.teamName,
      players: t.players,
      mine: t.rosterId === team.league!.myRosterId,
    })),
  };
}

export function Assistant({ players, scoring, hasKey }: { players: PlayerValue[]; scoring: Scoring; hasKey: boolean }) {
  const [team, , hydrated] = useMyTeam();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const board = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const suggestions = useMemo(() => {
    const mine = team ? team.playerIds.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p) : [];
    const star = [...mine].sort((a, b) => b.value - a.value)[0];
    return [
      "I want to trade for a top 5 WR. What's a fair offer?",
      star ? `Who should I trade ${star.name} for?` : "Who should I trade Malik Nabers for?",
      team ? "What's my team's biggest weakness, and how do I fix it with a trade?" : "Which players are the best sell-high candidates right now?",
      "Which RBs are buy-low candidates after a slow start?",
    ];
  }, [team, board]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history: ChatMessage[] = [...messages.filter((m) => !m.error), { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;

    const update = (fn: (m: ChatMessage) => ChatMessage) =>
      setMessages((ms) => [...ms.slice(0, -1), fn(ms[ms.length - 1])]);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          scoring,
          team: teamPayload(team),
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error === "missing_key" ? "The AI assistant isn't set up yet: ANTHROPIC_API_KEY is missing." : data.error || "Something went wrong.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.type === "text") update((m) => ({ ...m, content: m.content + evt.text }));
          else if (evt.type === "trades") update((m) => ({ ...m, trades: evt.trades }));
          else if (evt.type === "error") update((m) => ({ ...m, error: evt.error }));
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") update((m) => ({ ...m, error: (err as Error).message }));
    } finally {
      update((m) => ({ ...m, streaming: false, content: m.content.trimEnd() }));
      setBusy(false);
      abort.current = null;
    }
  }

  const scoringLabel = SCORINGS.find((s) => s.id === scoring)!.label;

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col lg:min-h-[calc(100dvh-5rem)]">
      <header className="mb-4 flex animate-rise flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-rocket">Powered by Claude</p>
          <h1 className="font-display text-4xl font-extrabold uppercase italic leading-[0.95] sm:text-5xl">
            AI Trade <span className="text-gradient">Assistant</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {hydrated && (
            <Link
              href="/my-team"
              className={clsx(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold",
                team ? "border-up/30 bg-up/10 text-up" : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              <Users className="size-3.5" />
              {team ? `${team.name} · ${scoringLabel}` : "No team, import yours"}
            </Link>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => {
                abort.current?.abort();
                setMessages([]);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-muted hover:text-ink"
            >
              <RotateCcw className="size-3.5" /> New chat
            </button>
          )}
        </div>
      </header>

      {!hasKey && (
        <div className="card mb-4 flex gap-3 border-flame/30 p-4 text-sm">
          <KeyRound className="mt-0.5 size-5 shrink-0 text-flame" />
          <div className="text-muted">
            <p className="font-semibold text-ink">Add your Anthropic API key to turn on the assistant</p>
            Create <code className="rounded bg-surface-3 px-1 text-ink">.env.local</code> with{" "}
            <code className="rounded bg-surface-3 px-1 text-ink">ANTHROPIC_API_KEY=sk-ant-…</code> and restart the dev server. On Vercel, add it under
            Project → Settings → Environment Variables.
          </div>
        </div>
      )}

      <div className="flex-1 space-y-6 pb-6">
        {messages.length === 0 ? (
          <div className="flex animate-rise flex-col items-center px-2 pt-6 text-center [animation-delay:80ms] sm:pt-12">
            <motion.div
              initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
            >
              <LogoMark className="size-16 shadow-[0_10px_40px_-10px] shadow-rocket/70" />
            </motion.div>
            <h2 className="mt-5 font-display text-2xl font-bold uppercase">Ask me about any trade</h2>
            <p className="mt-1 max-w-md text-sm text-muted">
              I see live trade values{team ? `, your roster${team.league ? " and every team in your league" : ""}` : ""}, so answers use real numbers.
            </p>
            <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
              {suggestions.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.06 }}
                  onClick={() => send(s)}
                  disabled={!hasKey}
                  className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left text-sm transition hover:border-rocket/40 hover:bg-surface-2 disabled:opacity-50"
                >
                  <Sparkles className="size-4 shrink-0 text-flame" />
                  <span className="flex-1">{s}</span>
                  <ArrowRight className="size-4 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-rocket" />
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <Message key={i} m={m} board={board} team={team} />)
        )}
        <div ref={bottom} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-20 lg:bottom-6"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface-2/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl focus-within:border-rocket/50">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={hasKey ? "Ask about a trade…" : "Add an API key to chat"}
            disabled={!hasKey}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none [field-sizing:content] placeholder:text-faint"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-3 text-ink transition hover:bg-white/10"
              aria-label="Stop"
            >
              <Square className="size-4 fill-current" />
            </button>
          ) : (
            <button
              disabled={!input.trim() || !hasKey}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rocket to-flame text-bg transition hover:brightness-110 disabled:opacity-40"
              aria-label="Send"
            >
              <ArrowUp className="size-5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Message({ m, board, team }: { m: ChatMessage; board: Map<string, PlayerValue>; team: SavedTeam | null }) {
  if (m.role === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-rocket to-[#ff7a2c] px-4 py-2.5 text-sm font-medium text-bg">
          {m.content}
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl border border-line-strong bg-surface-2 text-rocket">
        <Bot className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm text-ink/90">
        {m.content ? (
          <>
            <Markdown text={m.content} />
            {m.streaming && <span className="mt-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-rocket" />}
          </>
        ) : m.streaming ? (
          <div className="flex items-center gap-2 py-1.5 text-muted">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1.5 rounded-full bg-rocket"
                  animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </span>
            Crunching the numbers…
          </div>
        ) : null}
        {m.error && <p className="mt-2 rounded-xl bg-down/10 px-3 py-2 text-down">{m.error}</p>}
        <AnimatePresence>
          {m.trades && m.trades.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {m.trades.map((t, i) => (
                <TradeCard key={i} trade={t} board={board} team={team} index={i} />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function TradeCard({ trade, board, team, index }: { trade: Trade; board: Map<string, PlayerValue>; team: SavedTeam | null; index: number }) {
  const partner = team?.league?.teams.find((t) => t.teamName.toLowerCase() === trade.partner?.toLowerCase());
  return (
    <TradeIdeaCard
      title={trade.title}
      subtitle={trade.partner ? `with ${trade.partner}` : null}
      give={trade.give}
      get={trade.get}
      board={board}
      partnerRosterId={partner?.rosterId}
      note={trade.why}
      index={index}
    />
  );
}
