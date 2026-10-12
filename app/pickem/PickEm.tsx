"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { Check, ChevronLeft, ChevronRight, Crown, Loader2, Lock, Radio, Trophy, X } from "lucide-react";
import { PlayerAvatar, PosBadge } from "@/components/PlayerBits";
import type { Position } from "@/lib/types";

type Side = "a" | "b";

interface PlayerResult {
  id: string;
  name: string;
  team: string | null;
  position: Position;
  projected: number;
  opponent: string | null;
  kickoff: string | null;
  state: "pre" | "live" | "final";
  points: number | null;
}

interface Matchup {
  id: string;
  a: PlayerResult;
  b: PlayerResult;
  locked: boolean;
  winner: Side | "push" | null;
}

interface Data {
  season: string;
  week: number;
  openWeek: number;
  matchups: Matchup[];
  picks: Record<string, Side>;
  record: { week: { correct: number; graded: number }; season: { correct: number; graded: number; rank: number } | null };
  leaderboard: { name: string; correct: number; graded: number; perfectWeeks: number; me: boolean }[];
  players: number;
  signedIn: boolean;
  signInAvailable: boolean;
  saving: boolean;
  error?: string;
}

const kickoffLabel = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
};

export function PickEm() {
  const [data, setData] = useState<Data | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((w: number | null) => {
    fetch(`/api/pickem${w ? `?week=${w}` : ""}`)
      .then((r) => r.json())
      .then((d: Data) => {
        if (d.error) setError(d.error);
        else {
          setData(d);
          setError(null);
        }
      })
      .catch(() => setError("Couldn't load Pick'em. Check your connection and try again."));
  }, []);

  useEffect(() => {
    load(week);
  }, [load, week]);

  async function pick(m: Matchup, side: Side) {
    if (!data || m.locked) return;
    const prev = data;
    setData({ ...data, picks: { ...data.picks, [m.id]: side } });
    setSaving(true);
    try {
      const res = await fetch("/api/pickem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week: data.week, picks: { [m.id]: side } }) });
      const d = (await res.json()) as Data;
      if (!res.ok) throw new Error(d.error ?? "Couldn't save that pick.");
      setData(d);
      setError(null);
    } catch (e) {
      setData(prev);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return error ? (
      <p className="card p-6 text-sm text-down">{error}</p>
    ) : (
      <div className="card grid h-72 place-items-center text-muted">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  const picked = data.matchups.filter((m) => data.picks[m.id]).length;
  const allLocked = data.matchups.every((m) => m.locked);
  const graded = data.matchups.filter((m) => m.winner === "a" || m.winner === "b");

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
            <button
              onClick={() => setWeek(data.week - 1)}
              disabled={data.week <= 1}
              aria-label="Previous week"
              className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-white/5 hover:text-ink disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 font-display text-lg font-bold uppercase">Week {data.week}</span>
            <button
              onClick={() => setWeek(data.week + 1)}
              disabled={data.week >= data.openWeek}
              aria-label="Next week"
              className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-white/5 hover:text-ink disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <p className="text-sm text-muted">
            {graded.length
              ? `You went ${data.record.week.correct} for ${data.record.week.graded}${graded.length < data.matchups.length ? " so far" : ""}.`
              : allLocked
                ? `${picked} of ${data.matchups.length} picked · games underway`
                : `${picked} of ${data.matchups.length} picked`}
            {saving && <Loader2 className="ml-2 inline size-3.5 animate-spin" />}
          </p>
        </div>

        {!data.matchups.length && (
          <p className="card p-6 text-sm text-muted">
            {data.week < data.openWeek ? "No Pick'em ran this week. The contest started later in the season." : "This week's matchups will post once the schedule is set. Check back soon."}
          </p>
        )}

        {data.matchups.map((m, i) => (
          <motion.div key={`${data.week}-${m.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] text-faint">
              <span>
                Matchup {i + 1} · {m.a.position} vs {m.b.position}
              </span>
              <MatchupStatus m={m} mine={data.picks[m.id]} />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch">
              <Half p={m.a} side="a" m={m} mine={data.picks[m.id]} onPick={() => pick(m, "a")} />
              <div className="grid place-items-center px-1 font-display text-sm font-bold text-faint">VS</div>
              <Half p={m.b} side="b" m={m} mine={data.picks[m.id]} onPick={() => pick(m, "b")} />
            </div>
          </motion.div>
        ))}
        {error && <p className="text-sm text-down">{error}</p>}
        {!data.saving && <p className="text-xs text-faint">Picks can&apos;t be saved on this server yet.</p>}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <section className="card p-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
            <Trophy className="size-4 text-volt" /> Season leaderboard
          </h2>
          {data.record.season && (
            <p className="mt-1 text-sm text-muted">
              You&apos;re <b className="text-ink">#{data.record.season.rank}</b> of {data.players} at {data.record.season.correct}-{data.record.season.graded - data.record.season.correct}.
            </p>
          )}
          {data.leaderboard.length ? (
            <ol className="mt-3 space-y-1">
              {data.leaderboard.map((row, i) => (
                <li key={i} className={clsx("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm", row.me ? "bg-brand/15" : i % 2 ? "" : "bg-white/[0.02]")}>
                  <span className="w-5 text-right text-xs font-bold tabular text-faint">{i + 1}</span>
                  {i === 0 && <Crown className="size-3.5 text-volt" />}
                  <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
                  {row.perfectWeeks > 0 && <span className="rounded bg-up/15 px-1.5 text-[10px] font-bold text-up">{row.perfectWeeks}× 5/5</span>}
                  <span className="text-xs tabular text-muted">
                    {row.correct}-{row.graded - row.correct}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted">No graded picks yet. Results post as games finish.</p>
          )}
          {!data.signedIn && data.signInAvailable && (
            <a
              href={`/api/auth/google/login?next=${encodeURIComponent("/pickem")}`}
              className="mt-3 flex h-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-bg transition hover:bg-white/90"
            >
              Sign in with Google to join
            </a>
          )}
          {!data.signedIn && <p className="mt-2 text-xs text-faint">Your picks are saved on this device either way. Signing in puts you on the leaderboard.</p>}
        </section>
        <section className="card p-4 text-sm text-muted">
          <h2 className="mb-1 font-semibold text-ink">How it works</h2>
          <ul className="list-disc space-y-1 pl-4 text-xs">
            <li>Five head-to-heads of players projected to score about the same.</li>
            <li>Pick who scores more PPR points. Change picks any time before kickoff.</li>
            <li>A tie is a push. Go 5 for 5 to earn a perfect week.</li>
            <li>
              Want more? Play <Link href="/play" className="font-semibold text-rocket hover:underline">Keep · Trade · Cut</Link>.
            </li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

function MatchupStatus({ m, mine }: { m: Matchup; mine: Side | undefined }) {
  if (m.winner === "push") return <span className="text-muted">Push</span>;
  if (m.winner && mine) return m.winner === mine ? <span className="flex items-center gap-1 text-up"><Check className="size-3.5" /> Correct</span> : <span className="flex items-center gap-1 text-down"><X className="size-3.5" /> Missed</span>;
  if (m.winner) return <span className="text-muted">Final</span>;
  if (m.a.state === "live" || m.b.state === "live") return <span className="flex items-center gap-1 text-flame"><Radio className="size-3.5" /> Live</span>;
  if (m.locked) return <span className="flex items-center gap-1"><Lock className="size-3" /> Locked</span>;
  const first = [m.a.kickoff, m.b.kickoff].filter(Boolean).sort()[0] ?? null;
  return <span>Locks {kickoffLabel(first)}</span>;
}

function Half({ p, side, m, mine, onPick }: { p: PlayerResult; side: Side; m: Matchup; mine: Side | undefined; onPick: () => void }) {
  const picked = mine === side;
  const won = m.winner === side;
  const showPoints = p.points !== null;
  return (
    <button
      onClick={onPick}
      disabled={m.locked}
      className={clsx(
        "relative flex flex-col items-center gap-1.5 px-2 py-4 text-center transition sm:px-4",
        !m.locked && "hover:bg-white/[0.04]",
        picked && "bg-brand/10",
        m.locked && !picked && "opacity-80",
      )}
    >
      {picked && (
        <span className={clsx("absolute top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", m.winner ? (won ? "bg-up/20 text-up" : "bg-down/20 text-down") : "bg-brand/25 text-rocket")}>
          Your pick
        </span>
      )}
      <span className={clsx("mt-4 rounded-full p-[3px]", picked ? "bg-gradient-to-br from-brand to-brand-2" : won ? "bg-up" : "bg-transparent")}>
        <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={56} />
      </span>
      <span className="line-clamp-2 w-full text-sm font-semibold leading-tight">{p.name}</span>
      <span className="flex items-center gap-1 text-[11px] text-muted">
        <PosBadge pos={p.position} className="h-4 min-w-7 text-[9px]" /> {p.team} {p.opponent}
      </span>
      {showPoints ? (
        <span className={clsx("font-display text-3xl font-bold tabular", won ? "text-up" : "text-ink")}>{p.points}</span>
      ) : (
        <span className="text-xs text-faint">
          Proj <b className="text-muted">{p.projected}</b>
        </span>
      )}
      {showPoints && <span className="text-[10px] text-faint">proj {p.projected}</span>}
    </button>
  );
}
