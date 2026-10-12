"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { Radio, Swords } from "lucide-react";
import type { SavedTeam } from "@/lib/myTeam";
import type { Scoring } from "@/lib/types";
import { Avatar } from "./TeamSetup";

interface Side {
  rosterId: number;
  points: number;
  projected: number;
  left: number;
}
interface Data {
  week: number;
  me: Side;
  them: Side;
  winChance: number;
  final: boolean;
}

const pctLabel = (p: number) => (p >= 0.995 ? ">99%" : p <= 0.005 ? "<1%" : `${Math.round(p * 100)}%`);

/** This week's head-to-head in a Sleeper league, refreshed every minute while games are on. */
export function MatchupCard({ team, scoring }: { team: SavedTeam; scoring: Scoring }) {
  const league = team.league!;
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      fetch(`/api/sleeper/matchup?league=${league.leagueId}&roster=${league.myRosterId}&scoring=${scoring}`)
        .then((r) => r.json())
        .then((d: { matchup?: Data | null }) => {
          if (stop) return;
          setData(d.matchup ?? null);
          if (d.matchup && !d.matchup.final) timer = setTimeout(load, 60_000);
        })
        .catch(() => {});
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [league.leagueId, league.myRosterId, scoring]);

  if (!data) return null;
  const them = league.teams.find((t) => t.rosterId === data.them.rosterId);
  const live = !data.final && (data.me.left > 0 || data.them.left > 0) && (data.me.points > 0 || data.them.points > 0);
  const winning = data.winChance >= 0.5;
  return (
    <section className="card relative animate-rise overflow-hidden p-5">
      <div className="pointer-events-none absolute -left-16 -top-16 size-48 rounded-full blur-3xl" style={{ background: winning ? "color-mix(in srgb, var(--color-up) 18%, transparent)" : "color-mix(in srgb, var(--color-down) 15%, transparent)" }} />
      <div className="relative mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
          <Swords className="size-5 text-rocket" /> Week {data.week} matchup
        </h2>
        {live && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-flame">
            <Radio className="size-3.5" /> Live
          </span>
        )}
      </div>
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <TeamScore name={team.name} avatar={team.avatar} side={data.me} lead={data.me.points >= data.them.points} />
        <span className="font-display text-sm font-bold text-faint">VS</span>
        <TeamScore name={them?.teamName ?? "Opponent"} avatar={them?.avatar ?? null} side={data.them} lead={data.them.points > data.me.points} right />
      </div>
      <div className="relative mt-4">
        <div className="mb-1 flex justify-between text-xs font-semibold">
          <span className={winning ? "text-up" : "text-muted"}>
            {data.final ? (data.me.points > data.them.points ? "You won" : data.me.points < data.them.points ? "You lost" : "Tie") : `You: ${pctLabel(data.winChance)} to win`}
          </span>
          {!data.final && <span className="text-muted">{pctLabel(1 - data.winChance)}</span>}
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-down/40">
          <motion.div className="h-full rounded-full bg-up" initial={{ width: "50%" }} animate={{ width: `${data.winChance * 100}%` }} transition={{ duration: 0.8 }} />
        </div>
        <p className="mt-2 text-xs text-faint">
          {data.final
            ? "Final. Every starter has played."
            : `Projected ${data.me.projected} to ${data.them.projected} · starters left to play: ${data.me.left} vs ${data.them.left}. Updates every minute during games.`}
        </p>
      </div>
    </section>
  );
}

function TeamScore({ name, avatar, side, lead, right }: { name: string; avatar: string | null; side: Side; lead: boolean; right?: boolean }) {
  return (
    <div className={clsx("flex min-w-0 items-center gap-3", right && "flex-row-reverse text-right")}>
      <Avatar src={avatar} label={name} size={44} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className={clsx("font-display text-3xl font-bold leading-none tabular", lead ? "text-ink" : "text-muted")}>{side.points}</div>
      </div>
    </div>
  );
}
