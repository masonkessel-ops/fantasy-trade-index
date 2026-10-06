"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { TrendingDown, TrendingUp } from "lucide-react";
import { InjuryTag, PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import { useMyTeam } from "@/lib/myTeam";
import { POS_COLOR } from "@/lib/ui";
import { POSITIONS, type Position } from "@/lib/types";
import type { TrendingRow } from "@/lib/weekly";

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

export function WaiverWire({ adds, drops, week }: { adds: TrendingRow[]; drops: TrendingRow[]; week: number }) {
  const [kind, setKind] = useState<"add" | "drop">("add");
  const [pos, setPos] = useState<Position | "ALL">("ALL");
  const [team] = useMyTeam();
  const mine = useMemo(() => new Set(team?.playerIds ?? []), [team]);
  // With an imported league we know who's actually available.
  const rostered = useMemo(() => (team?.league ? new Set(team.league.teams.flatMap((t) => t.players)) : null), [team]);

  const list = (kind === "add" ? adds : drops).filter((r) => pos === "ALL" || r.position === pos);

  return (
    <div className="animate-rise [animation-delay:80ms]">
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1 sm:max-w-md">
        {(
          [
            { id: "add", label: "Most added", icon: TrendingUp, color: "text-up" },
            { id: "drop", label: "Most dropped", icon: TrendingDown, color: "text-down" },
          ] as const
        ).map((t) => (
          <button key={t.id} onClick={() => setKind(t.id)} className={clsx("relative flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold", kind === t.id ? "text-ink" : "text-muted hover:text-ink")}>
            {kind === t.id && <motion.span layoutId="waiver-tab" className="absolute inset-0 rounded-xl bg-surface-3" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <t.icon className={clsx("relative size-4", kind === t.id && t.color)} />
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
        {(["ALL", ...POSITIONS] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPos(p)}
            className={clsx("h-8 shrink-0 rounded-full px-4 text-xs font-bold tracking-wide transition-colors", pos === p ? "text-bg" : "bg-surface text-muted ring-1 ring-line hover:text-ink")}
            style={pos === p ? { background: p === "ALL" ? "var(--color-rocket)" : POS_COLOR[p] } : undefined}
          >
            {p === "ALL" ? "All" : p}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint sm:px-4">
          <span className="w-7 text-center">#</span>
          <span className="flex-1">Player</span>
          <span className="w-16 text-right">{kind === "add" ? "Adds" : "Drops"}</span>
          <span className="hidden w-14 text-right sm:block">Wk {week}</span>
          <span className="w-12 text-center">Value</span>
        </div>
        {list.length === 0 ? (
          <p className="px-4 py-14 text-center text-sm text-muted">Nobody trending at this position right now.</p>
        ) : (
          <ol>
            {list.map((r, i) => {
              const available = rostered && !rostered.has(r.id);
              return (
                <li key={r.id} className="border-b border-line last:border-0">
                  <Link href={`/players/${r.id}`} className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.025] sm:px-4">
                    <span className="w-7 text-center font-display text-base font-semibold text-faint tabular">{i + 1}</span>
                    <PlayerAvatar id={r.id} position={r.position} team={r.team} name={r.name} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold group-hover:text-white">{r.name}</span>
                        <InjuryTag status={r.injuryStatus} />
                        {mine.has(r.id) && <span className="rounded bg-rocket/15 px-1 py-px text-[9px] font-bold uppercase text-rocket">Mine</span>}
                        {available && kind === "add" && <span className="rounded bg-up/15 px-1 py-px text-[9px] font-bold uppercase text-up">Free agent</span>}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
                        <PosBadge pos={r.position} /> {r.team ?? "FA"}
                        {r.opponent && <span className="text-faint">{r.opponent}</span>}
                      </span>
                    </span>
                    <span className={clsx("w-16 text-right text-sm font-semibold tabular", kind === "add" ? "text-up" : "text-down")}>
                      {kind === "add" ? "+" : "−"}
                      {fmt(r.count)}
                    </span>
                    <span className="hidden w-14 text-right font-display text-base font-bold text-muted tabular sm:block">{r.proj ?? "–"}</span>
                    <span className="flex w-12 justify-center">{r.value !== null ? <ValueBadge value={r.value} size="sm" /> : <span className="text-xs text-faint">–</span>}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <p className="mt-3 text-xs text-faint">
        Counts are how many Sleeper leagues added or dropped each player in the last 24 hours.{" "}
        {team?.league ? "“Free agent” means nobody in your league has him." : "Import your league on My Team to see who's actually available to you."}
      </p>
    </div>
  );
}
