"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStored } from "@/lib/localStore";
import { newRound } from "@/lib/ktcRound";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, Flame, Loader2, Scissors, Shield, Repeat2, Users } from "lucide-react";
import { InjuryTag, PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import type { Position } from "@/lib/types";

export interface KtcPlayer {
  id: string;
  name: string;
  position: Position;
  team: string | null;
  age: number | null;
  value: number;
  posRank: number;
  overallRank: number;
  injuryStatus: string | null;
  ppg: number;
}

type Choice = "keep" | "trade" | "cut";
type Tally = Record<Choice, number>;

const CHOICES: { id: Choice; label: string; icon: typeof Shield; tone: string; on: string }[] = [
  { id: "keep", label: "Keep", icon: Shield, tone: "text-up", on: "border-up/60 bg-up/15 text-up" },
  { id: "trade", label: "Trade", icon: Repeat2, tone: "text-volt", on: "border-volt/60 bg-volt/15 text-volt" },
  { id: "cut", label: "Cut", icon: Scissors, tone: "text-down", on: "border-down/60 bg-down/15 text-down" },
];
const BAR: Record<Choice, string> = { keep: "var(--color-up)", trade: "var(--color-volt)", cut: "var(--color-down)" };

const STORAGE = "fti_ktc_v1";

interface Stats {
  rounds: number;
  matched: number;
  graded: number;
  streak: number;
  lastDay: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const NO_STATS: Stats = { rounds: 0, matched: 0, graded: 0, streak: 0, lastDay: null };

/** Votes a player needs (yours included) before we compare you with the crowd. */
const MIN_CROWD = 4;
const votesOf = (t: Tally | undefined) => (t ? t.keep + t.trade + t.cut : 0);

/** The crowd's call for a player: whichever choice got the most votes. */
const crowdCall = (t: Tally | undefined): Choice | null => {
  if (!t || t.keep + t.trade + t.cut === 0) return null;
  return (["keep", "trade", "cut"] as Choice[]).reduce((a, b) => (t[b] > t[a] ? b : a));
};

export function KeepTradeCut({ pool, firstRound }: { pool: KtcPlayer[]; firstRound: string[] }) {
  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  const [round, setRound] = useState<KtcPlayer[]>(() => firstRound.map((id) => byId.get(id)!).filter(Boolean));
  const [picks, setPicks] = useState<Record<string, Choice>>({});
  const [result, setResult] = useState<Record<string, Tally> | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setStats] = useStored<Stats>(STORAGE);
  const stats = saved ?? NO_STATS;
  const [board, setBoard] = useState<{ kept: { id: string }[]; cut: { id: string }[]; rounds: number; tallies: Record<string, Tally> } | null>(null);

  useEffect(() => {
    fetch("/api/ktc")
      .then((r) => r.json())
      .then(setBoard)
      .catch(() => {});
  }, []);

  const choose = (id: string, c: Choice) => {
    if (result) return;
    setPicks((prev) => {
      const next = { ...prev };
      // Each choice is used once: whoever had it gives it up.
      for (const [pid, pc] of Object.entries(next)) if (pc === c && pid !== id) delete next[pid];
      if (next[id] === c) delete next[id];
      else next[id] = c;
      return next;
    });
  };

  const ready = round.length === 3 && Object.keys(picks).length === 3;

  async function submit() {
    if (!ready) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/ktc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votes: round.map((p) => ({ id: p.id, choice: picks[p.id] })) }),
      });
      const data = (await res.json()) as { tallies?: Record<string, Tally>; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      const tallies = data.tallies ?? {};
      setResult(tallies);
      // Score against the crowd (only players with a few votes besides yours).
      const graded = round.filter((p) => votesOf(tallies[p.id]) >= MIN_CROWD);
      const matched = graded.filter((p) => crowdCall(tallies[p.id]) === picks[p.id]).length;
      const s = stats;
      const day = today();
      const streak = s.lastDay === day ? s.streak : s.lastDay === yesterday() ? s.streak + 1 : 1;
      setStats({ rounds: s.rounds + 1, matched: s.matched + matched, graded: s.graded + graded.length, streak, lastDay: day });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const next = useCallback(() => {
    setRound((r) => newRound(pool, r.map((p) => p.id)));
    setPicks({});
    setResult(null);
    setError(null);
  }, [pool]);

  const gradedThisRound = result ? round.filter((p) => votesOf(result[p.id]) >= MIN_CROWD) : [];
  const matchedThisRound = gradedThisRound.filter((p) => crowdCall(result![p.id]) === picks[p.id]).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Rounds played" value={stats.rounds} />
        <Stat label="Day streak" value={stats.streak} icon={<Flame className="size-4 text-flame" />} />
        <Stat label="Agree with crowd" value={stats.graded ? `${Math.round((stats.matched / stats.graded) * 100)}%` : "–"} />
      </div>

      <section className="card p-4 sm:p-5">
        {!round.length ? (
          <div className="grid h-72 place-items-center text-muted">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {round.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ delay: i * 0.05 }}
                    className={clsx(
                      "flex flex-col rounded-2xl border bg-surface-2 p-4 transition",
                      picks[p.id] ? CHOICES.find((c) => c.id === picks[p.id])!.on.split(" ")[0] : "border-line",
                    )}
                  >
                    <div className="flex items-center gap-3 sm:flex-col sm:text-center">
                      <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={64} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-xl font-bold uppercase leading-tight">{p.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted sm:justify-center">
                          <PosBadge pos={p.position} /> {p.team ?? "FA"}
                          {p.age && <span>· Age {p.age}</span>}
                          <InjuryTag status={p.injuryStatus} />
                        </div>
                        <div className="mt-1 text-xs text-faint">{p.ppg} PPG this season</div>
                      </div>
                    </div>

                    {result ? (
                      <Reveal player={p} mine={picks[p.id]} tally={result[p.id]} />
                    ) : (
                      <div className="mt-4 grid grid-cols-3 gap-1.5">
                        {CHOICES.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => choose(p.id, c.id)}
                            className={clsx(
                              "flex h-11 items-center justify-center gap-1 rounded-xl border text-xs font-bold uppercase tracking-wide transition",
                              picks[p.id] === c.id ? c.on : "border-line bg-bg/40 text-muted hover:border-line-strong hover:text-ink",
                            )}
                          >
                            <c.icon className="size-3.5" /> {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
              <p className="text-sm text-muted">
                {!result
                  ? "Use each choice once: one keep, one trade, one cut."
                  : !gradedThisRound.length
                    ? "You're one of the first to vote on these three. Thanks for setting the line!"
                    : matchedThisRound === gradedThisRound.length
                      ? `You and the crowd agree on ${gradedThisRound.length === 3 ? "all three" : `all ${gradedThisRound.length}`}.`
                      : `You matched the crowd on ${matchedThisRound} of ${gradedThisRound.length}.`}
              </p>
              {result ? (
                <button onClick={next} className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-2 px-6 text-sm font-bold text-bg transition hover:brightness-110">
                  Next round <ArrowRight className="size-4" />
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={!ready || sending}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-2 px-6 text-sm font-bold text-bg transition hover:brightness-110 disabled:opacity-40"
                >
                  {sending && <Loader2 className="size-4 animate-spin" />} Lock it in
                </button>
              )}
            </div>
            {error && <p className="mt-2 text-center text-sm text-down">{error}</p>}
          </>
        )}
      </section>

      {board && (board.kept.length > 0 || board.cut.length > 0) && (
        <section className="grid gap-4 md:grid-cols-2">
          <CrowdList title="The crowd keeps" icon={<Shield className="size-4 text-up" />} rows={board.kept} tallies={board.tallies} byId={byId} pick="keep" />
          <CrowdList title="The crowd cuts" icon={<Scissors className="size-4 text-down" />} rows={board.cut} tallies={board.tallies} byId={byId} pick="cut" />
          <p className="flex items-center gap-1.5 text-xs text-faint md:col-span-2">
            <Users className="size-3.5" /> {board.rounds.toLocaleString()} rounds played so far.
          </p>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number | string; icon?: React.ReactNode }) {
  return (
    <div className="card px-3 py-2.5 text-center sm:px-4">
      <div className="flex items-center justify-center gap-1 font-display text-2xl font-bold tabular sm:text-3xl">
        {icon}
        {value}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</div>
    </div>
  );
}

function Reveal({ player, mine, tally }: { player: KtcPlayer; mine: Choice; tally: Tally | undefined }) {
  const total = tally ? tally.keep + tally.trade + tally.cut : 0;
  const call = crowdCall(tally);
  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">
          You: <b className={CHOICES.find((c) => c.id === mine)!.tone}>{CHOICES.find((c) => c.id === mine)!.label}</b>
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          <ValueBadge value={player.value} size="sm" /> {player.position}
          {player.posRank}
        </span>
      </div>
      {total >= MIN_CROWD ? (
        <>
          {call && (
            <div className={clsx("flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide", CHOICES.find((c) => c.id === call)!.on)}>
              <span>Most picked: {CHOICES.find((c) => c.id === call)!.label}</span>
              <span className="tabular">{Math.round(((tally?.[call] ?? 0) / total) * 100)}%</span>
            </div>
          )}
          {CHOICES.map((c) => {
            const pct = Math.round(((tally?.[c.id] ?? 0) / total) * 100);
            return (
              <div key={c.id}>
                <div className="mb-0.5 flex justify-between text-[11px]">
                  <span className={clsx("font-semibold", call === c.id ? c.tone : "text-muted")}>{c.label}</span>
                  <span className="tabular text-muted">{pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <motion.div className="h-full rounded-full" style={{ background: BAR[c.id] }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-faint">{total.toLocaleString()} votes</p>
        </>
      ) : (
        <p className="text-xs text-faint">You&apos;re one of the first to vote on {player.name.split(" ").slice(-1)[0]}. Crowd results fill in as more people play.</p>
      )}
    </div>
  );
}

function CrowdList({
  title,
  icon,
  rows,
  tallies,
  byId,
  pick,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { id: string }[];
  tallies: Record<string, Tally>;
  byId: Map<string, KtcPlayer>;
  pick: Choice;
}) {
  const shown = rows.filter((r) => byId.has(r.id)).slice(0, 6);
  if (!shown.length) return null;
  return (
    <div className="card p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
        {icon} {title}
      </h2>
      <ul className="space-y-2">
        {shown.map((r) => {
          const p = byId.get(r.id)!;
          const t = tallies[r.id];
          const total = t ? t.keep + t.trade + t.cut : 0;
          return (
            <li key={r.id}>
              <Link href={`/players/${p.id}`} className="flex items-center gap-2.5 rounded-xl px-1 py-1 transition hover:bg-white/[0.04]">
                <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                <span className="text-xs tabular text-muted">{total ? `${Math.round(((t?.[pick] ?? 0) / total) * 100)}% ${pick}` : ""}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
