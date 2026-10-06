"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, ArrowUp, Check, HelpCircle, MessagesSquare, RotateCcw, Sparkles, Users, Zap } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { Markdown } from "@/components/Markdown";
import { TradeIdeaCard } from "@/components/TradeIdeaCard";
import { ChangePill, InjuryTag, PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import { RiskTag } from "@/components/RiskReward";
import { useMyTeam, type SavedTeam } from "@/lib/myTeam";
import { buildNameIndex } from "@/lib/bot/names";
import { EXAMPLES, HELP_TEXT, answer, helpReply, type Block, type WeekData } from "@/lib/bot/engine";
import { playerRisk } from "@/lib/risk";
import { SLOT_ELIGIBLE, SLOT_LABEL, gradeColor } from "@/lib/teamAnalysis";
import { POS_COLOR } from "@/lib/ui";
import { SCORINGS, type PlayerValue, type Scoring } from "@/lib/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  blocks?: Block[];
  suggestions?: string[];
  error?: string;
  streaming?: boolean;
}

export function Assistant({ players, scoring }: { players: PlayerValue[]; scoring: Scoring }) {
  const [team, setTeam, hydrated] = useMyTeam();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const focus = useRef<string[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const weekCache = useRef(new Map<string, Promise<WeekData>>());
  const board = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const names = useMemo(() => buildNameIndex(players), [players]);
  const mine = useMemo(() => (team ? team.playerIds.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p).sort((a, b) => b.value - a.value) : []), [team, board]);
  const starters = useMemo(() => helpReply(mine, players).suggestions, [mine, players]);

  useEffect(() => {
    if (messages.length) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const loadWeek = (ids: string[]) => {
    const key = [...ids].sort().join(",");
    let p = weekCache.current.get(key);
    if (!p) {
      p = fetch(`/api/week-points?ids=${key}&scoring=${scoring}`)
        .then((r) => r.json())
        .then((d) => ({ week: d.week ?? null, points: d.points ?? {}, plan: d.plan ?? null }) as WeekData)
        .catch(() => ({ week: null, points: {}, plan: null }));
      weekCache.current.set(key, p);
    }
    return p;
  };

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history: ChatMessage[] = [...messages.filter((m) => !m.error), { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    setBusy(true);
    const update = (fn: (m: ChatMessage) => ChatMessage) => setMessages((ms) => [...ms.slice(0, -1), fn(ms[ms.length - 1])]);

    try {
      const reply = await answer(q, { players, team, names, loadWeek }, focus.current);
      if (reply) {
        if (reply.focus.length) focus.current = reply.focus;
        update(() => ({ role: "assistant", content: reply.text, blocks: reply.blocks, suggestions: reply.suggestions }));
      } else {
        update(() => ({
          role: "assistant",
          content: `I didn't catch that one. I answer fantasy questions from the numbers, so try one of these, or tap **What can I ask?**`,
          suggestions: shuffle(EXAMPLES).slice(0, 4),
        }));
      }
    } catch (err) {
      update((m) => ({ ...m, streaming: false, error: (err as Error).message || "Something went wrong." }));
    } finally {
      setBusy(false);
    }
  }

  const showHelp = () =>
    setMessages((ms) => [...ms, { role: "assistant", content: HELP_TEXT, suggestions: shuffle(EXAMPLES).slice(0, 4) }]);

  const applyLineup = (ids: string[]) => team && setTeam({ ...team, starters: ids });
  const scoringLabel = SCORINGS.find((s) => s.id === scoring)!.label;
  const lastAssistant = messages.map((m) => m.role).lastIndexOf("assistant");

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col lg:min-h-[calc(100dvh-5rem)]">
      <header className="mb-4 flex animate-rise flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-rocket">
            <Zap className="size-3.5" /> Instant answers · no AI
          </p>
          <h1 className="font-display text-4xl font-extrabold uppercase italic leading-[0.95] sm:text-5xl">
            Trade <span className="text-gradient">Assistant</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hydrated && (
            <Link
              href="/my-team"
              className={clsx(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold",
                team ? "border-up/30 bg-up/10 text-up" : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              <Users className="size-3.5" />
              {team ? `${team.name} · ${scoringLabel}` : "No team yet: add yours"}
            </Link>
          )}
          <button
            onClick={showHelp}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-muted hover:text-ink"
          >
            <HelpCircle className="size-3.5" /> What can I ask?
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                focus.current = [];
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-muted hover:text-ink"
            >
              <RotateCcw className="size-3.5" /> Clear
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-6 pb-6">
        {messages.length === 0 ? (
          <div className="flex animate-rise flex-col items-center px-2 pt-6 text-center [animation-delay:80ms] sm:pt-10">
            <motion.div initial={{ scale: 0.6, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
              <LogoMark className="size-16 shadow-[0_10px_40px_-10px] shadow-rocket/70" />
            </motion.div>
            <h2 className="mt-5 font-display text-2xl font-bold uppercase">Ask me anything about fantasy</h2>
            <p className="mt-1 max-w-md text-sm text-muted">
              Who to start, trades to make, what a player is worth. I answer instantly from live trade values{team ? `, your roster${team.league ? " and every team in your league" : ""}` : ""} and this week&apos;s projections.
            </p>
            <div className="mt-6 grid w-full max-w-2xl grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
              {[...starters, "Make me a trade", ...EXAMPLES.filter((e) => /rising|Top 10|Grade/.test(e))].slice(0, 8).map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + i * 0.04 }}
                  onClick={() => send(s)}
                  className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left text-sm transition hover:border-rocket/40 hover:bg-surface-2"
                >
                  <MessagesSquare className="size-4 shrink-0 text-flame" />
                  <span className="min-w-0 flex-1">{s}</span>
                  <ArrowRight className="size-4 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-rocket" />
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <Message key={i} m={m} board={board} team={team} mine={mine} onAsk={send} onApply={applyLineup} showSuggestions={i === lastAssistant && !busy} />
          ))
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
            autoFocus
            placeholder="Ask anything about fantasy… (Enter to send)"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none [field-sizing:content] placeholder:text-faint"
          />
          <button
            disabled={!input.trim() || busy}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-br from-rocket to-flame px-4 text-sm font-bold text-bg transition hover:brightness-110 disabled:opacity-40"
          >
            Send <ArrowUp className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

function shuffle<T>(xs: T[]) {
  return [...xs].sort(() => Math.random() - 0.5);
}

function Message({
  m,
  board,
  team,
  mine,
  onAsk,
  onApply,
  showSuggestions,
}: {
  m: ChatMessage;
  board: Map<string, PlayerValue>;
  team: SavedTeam | null;
  mine: PlayerValue[];
  onAsk: (q: string) => void;
  onApply: (ids: string[]) => void;
  showSuggestions: boolean;
}) {
  if (m.role === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-rocket to-[#ff7a2c] px-4 py-2.5 text-sm font-medium text-bg">{m.content}</div>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl border border-line-strong bg-surface-2">
        <LogoMark className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-3 text-sm text-ink/90">
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
        {m.error && <p className="rounded-xl bg-down/10 px-3 py-2 text-down">{m.error}</p>}
        {m.blocks?.map((b, i) => <BlockView key={i} b={b} board={board} mine={mine} team={team} onAsk={onAsk} onApply={onApply} />)}
        {showSuggestions && m.suggestions && m.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {m.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onAsk(s)}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-rocket/40 hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function BlockView({
  b,
  board,
  mine,
  team,
  onAsk,
  onApply,
}: {
  b: Block;
  board: Map<string, PlayerValue>;
  mine: PlayerValue[];
  team: SavedTeam | null;
  onAsk: (q: string) => void;
  onApply: (ids: string[]) => void;
}) {
  switch (b.kind) {
    case "player": {
      const p = board.get(b.id);
      return p ? <PlayerCard p={p} mine={mine.some((x) => x.id === p.id)} /> : null;
    }
    case "players":
      return (
        <ol className="overflow-hidden rounded-2xl border border-line bg-surface">
          {b.ids.map((id, i) => {
            const p = board.get(id);
            if (!p) return null;
            return (
              <li key={id} className="border-b border-line last:border-0">
                <button onClick={() => onAsk(`What's ${p.name} worth?`)} className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-white/[0.03]">
                  <span className="w-5 text-center font-display text-sm font-bold text-faint">{i + 1}</span>
                  <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-semibold">{p.name}</span>
                      <InjuryTag status={p.injuryStatus} />
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <PosBadge pos={p.position} /> {p.team ?? "FA"} · {p.ppg} ppg
                    </span>
                  </span>
                  {b.show === "change" && <ChangePill change={p.change} />}
                  <ValueBadge value={p.value} size="sm" />
                </button>
              </li>
            );
          })}
        </ol>
      );
    case "trades":
      return (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {b.cards.map((c, i) => (
            <TradeIdeaCard key={`${c.give.join()}-${c.get.join()}`} index={i} title={c.title} subtitle={c.subtitle} give={c.give} get={c.get} board={board} partnerRosterId={c.partnerRosterId} note={c.note} />
          ))}
        </div>
      );
    case "compare":
      return <CompareTable ids={b.ids} board={board} week={b.week} proj={b.proj} />;
    case "lineup":
      return <LineupCard b={b} board={board} team={team} onApply={onApply} />;
    case "grades":
      return (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {b.strengths.map((s) => (
            <button key={s.position} onClick={() => onAsk(`Top 10 ${s.position === "DST" ? "defenses" : `${s.position}s`}`)} className="rounded-2xl border border-line bg-surface p-3 text-center transition hover:border-line-strong">
              <PosBadge pos={s.position} />
              <div className="mt-1.5 font-display text-3xl font-extrabold leading-none" style={{ color: gradeColor(s.grade) }}>
                {s.grade}
              </div>
              <div className="mt-1 text-[10px] text-faint tabular">{Math.round(s.ratio * 100)}% of avg</div>
            </button>
          ))}
        </div>
      );
    case "link":
      return (
        <Link href={b.href} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-rocket/40 bg-rocket/10 px-4 text-xs font-bold text-rocket transition hover:bg-rocket/20">
          {b.label} <ArrowRight className="size-3.5" />
        </Link>
      );
  }
}

function PlayerCard({ p, mine }: { p: PlayerValue; mine: boolean }) {
  const stats: [string, string | number][] = [
    ["Pos rank", `${p.position}${p.posRank}`],
    ["Season PPG", p.ppg],
    ["Last 3", p.recentPpg ?? "–"],
    ["ROS proj", p.rosPpg],
  ];
  return (
    <div className="rounded-2xl border border-line-strong bg-gradient-to-b from-surface-2 to-surface p-4">
      <div className="flex items-center gap-3">
        <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={52} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-xl font-bold uppercase leading-tight">{p.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <PosBadge pos={p.position} /> {p.team ?? "FA"}
            {p.age ? ` · ${p.age} yrs` : ""} <InjuryTag status={p.injuryStatus} /> <RiskTag p={p} />
          </div>
        </div>
        <ValueBadge value={p.value} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
        {stats.map(([label, v]) => (
          <div key={label} className="rounded-xl bg-white/[0.04] py-2">
            <div className="font-display text-lg font-bold tabular">{v}</div>
            <div className="text-[9px] uppercase tracking-wider text-faint">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/trade-finder?${mine ? "away" : "want"}=${p.id}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-rocket to-flame px-4 text-xs font-bold text-bg transition hover:brightness-110"
        >
          {mine ? "Trade away" : "What would it take?"} <ArrowRight className="size-3.5" />
        </Link>
        <Link href={`/players/${p.id}`} className="inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-xs font-semibold text-muted transition hover:text-ink">
          Full stats
        </Link>
      </div>
    </div>
  );
}

function CompareTable({ ids, board, week, proj }: { ids: string[]; board: Map<string, PlayerValue>; week: number | null; proj: Record<string, number | null> | null }) {
  const ps = ids.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p).slice(0, 4);
  const rows: { label: string; get: (p: PlayerValue) => number | null; fmt?: (n: number) => string; low?: boolean }[] = [
    ...(proj ? [{ label: `Week ${week ?? ""} proj`, get: (p: PlayerValue) => proj[p.id] ?? null }] : []),
    { label: "Trade value", get: (p) => p.value },
    { label: "Trade weight", get: (p) => Math.round(p.power) },
    { label: "Season PPG", get: (p) => p.ppg },
    { label: "Last 3 PPG", get: (p) => p.recentPpg },
    { label: "ROS PPG", get: (p) => p.rosPpg },
    { label: "Risk", get: (p) => playerRisk(p).score, fmt: (n) => (n < 0.2 ? "Low" : n < 0.45 ? "Med" : "High"), low: true },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid border-b border-line" style={{ gridTemplateColumns: `minmax(5.5rem,1fr) repeat(${ps.length}, minmax(0,1fr))` }}>
        <span />
        {ps.map((p) => (
          <div key={p.id} className="flex flex-col items-center gap-1 px-1 py-3 text-center">
            <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={36} />
            <span className="w-full truncate text-xs font-semibold">{p.name}</span>
            <span className="text-[10px] text-muted">
              {p.position}
              {p.posRank} · {p.team ?? "FA"}
            </span>
          </div>
        ))}
      </div>
      {rows.map((r) => {
        const vals = ps.map(r.get);
        const nums = vals.filter((v): v is number => v !== null);
        const best = nums.length ? (r.low ? Math.min(...nums) : Math.max(...nums)) : null;
        return (
          <div key={r.label} className="grid border-b border-line text-sm last:border-0" style={{ gridTemplateColumns: `minmax(5.5rem,1fr) repeat(${ps.length}, minmax(0,1fr))` }}>
            <span className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-faint">{r.label}</span>
            {vals.map((v, i) => (
              <span key={i} className={clsx("py-2 text-center font-display text-base font-bold tabular", v !== null && v === best && nums.length > 1 ? "text-up" : "text-ink/80")}>
                {v === null ? "–" : r.fmt ? r.fmt(v) : v}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function LineupCard({ b, board, team, onApply }: { b: Extract<Block, { kind: "lineup" }>; board: Map<string, PlayerValue>; team: SavedTeam | null; onApply: (ids: string[]) => void }) {
  const [done, setDone] = useState(false);
  const total = Math.round(b.slots.reduce((s, x) => s + (x.proj ?? 0), 0) * 10) / 10;
  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-faint">Best lineup{b.week ? ` · week ${b.week}` : ""}</span>
        <span className="font-display text-lg font-bold text-gradient tabular">{total} pts</span>
      </div>
      <ul className="space-y-1">
        {b.slots.map((s, i) => {
          const p = s.id ? board.get(s.id) : null;
          const eligible = SLOT_ELIGIBLE[s.slot];
          const color = eligible?.length === 1 ? POS_COLOR[eligible[0]] : undefined;
          return (
            <li key={i} className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-2 py-1.5">
              <span
                className="grid h-7 w-11 shrink-0 place-items-center rounded-lg text-[10px] font-bold"
                style={color ? { color, background: `color-mix(in srgb, ${color} 15%, transparent)` } : { background: "rgb(255 255 255 / 0.05)" }}
              >
                {SLOT_LABEL[s.slot] ?? s.slot}
              </span>
              {p ? (
                <>
                  <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={28} />
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <span className="font-display font-bold tabular">{s.proj ?? "–"}</span>
                </>
              ) : (
                <span className="flex-1 text-faint">Empty</span>
              )}
            </li>
          );
        })}
      </ul>
      {b.apply && team && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              onApply(b.apply!);
              setDone(true);
            }}
            disabled={done}
            className={clsx(
              "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition",
              done ? "bg-up/10 text-up" : "bg-gradient-to-r from-rocket to-flame text-bg hover:brightness-110",
            )}
          >
            {done ? <Check className="size-4" /> : <Sparkles className="size-4" />}
            {done ? "Lineup set" : `Set this lineup${b.gain > 0 ? ` (+${b.gain})` : ""}`}
          </button>
          {done && (
            <Link href="/my-team" className="text-xs font-semibold text-rocket hover:underline">
              See it on My Team →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
