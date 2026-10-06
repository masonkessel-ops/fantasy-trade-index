"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { InjuryTag, PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import { useMyTeam } from "@/lib/myTeam";
import { POS_COLOR } from "@/lib/ui";
import type { Position } from "@/lib/types";
import type { WeeklyRow } from "@/lib/weekly";

const TABS = ["ALL", "QB", "RB", "WR", "TE", "FLEX", "K", "DST"] as const;
type Tab = (typeof TABS)[number];
const FLEX: Position[] = ["RB", "WR", "TE"];

export function RankingsTable({ rows }: { rows: WeeklyRow[] }) {
  const [tab, setTab] = useState<Tab>("ALL");
  const [onlyMine, setOnlyMine] = useState(false);
  const [team] = useMyTeam();
  const mine = useMemo(() => new Set(team?.playerIds ?? []), [team]);

  const list = useMemo(() => {
    const byTab = rows.filter((r) => (tab === "ALL" ? true : tab === "FLEX" ? FLEX.includes(r.position) : r.position === tab));
    const filtered = onlyMine ? byTab.filter((r) => mine.has(r.id)) : byTab;
    return filtered.slice(0, onlyMine ? 60 : tab === "ALL" ? 150 : 120);
  }, [rows, tab, onlyMine, mine]);

  return (
    <div className="animate-rise [animation-delay:80ms]">
      <div className="sticky top-[57px] z-20 -mx-4 mb-3 flex flex-wrap items-center gap-2 bg-bg/85 px-4 pb-3 pt-1 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10 lg:pt-3">
        <div className="no-scrollbar -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1">
          {TABS.map((t) => {
            const active = tab === t;
            const color = t === "ALL" || t === "FLEX" ? "var(--color-rocket)" : POS_COLOR[t];
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx("relative h-8 shrink-0 rounded-full px-4 text-xs font-bold tracking-wide transition-colors", active ? "text-bg" : "bg-surface text-muted ring-1 ring-line hover:text-ink")}
              >
                {active && <motion.span layoutId="rank-tab" className="absolute inset-0 rounded-full" style={{ background: color }} transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span className="relative">{t === "ALL" ? "All" : t}</span>
              </button>
            );
          })}
        </div>
        {team && (
          <button
            onClick={() => setOnlyMine((v) => !v)}
            className={clsx(
              "h-8 shrink-0 rounded-full px-3.5 text-xs font-bold transition",
              onlyMine ? "bg-gradient-to-r from-brand to-brand-2 text-bg" : "bg-surface text-muted ring-1 ring-line hover:text-ink",
            )}
          >
            Only my team
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint sm:px-4">
          <span className="w-7 text-center">#</span>
          <span className="flex-1">Player</span>
          <span className="hidden w-20 sm:block">Matchup</span>
          <span className="w-14 text-right">Proj</span>
          <span className="hidden w-12 text-center sm:block">Value</span>
        </div>
        {list.length === 0 ? (
          <p className="px-4 py-14 text-center text-sm text-muted">{onlyMine ? "None of your players are playing at this position this week." : "No projections yet for this week."}</p>
        ) : (
          <ol>
            {list.map((r, i) => (
              <li key={r.id} className="border-b border-line last:border-0">
                <Link href={`/players/${r.id}`} className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.025] sm:px-4">
                  <span className="w-7 text-center font-display text-base font-semibold text-faint tabular">{tab === "ALL" || tab === "FLEX" || onlyMine ? i + 1 : r.posRank}</span>
                  <PlayerAvatar id={r.id} position={r.position} team={r.team} name={r.name} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold group-hover:text-white">{r.name}</span>
                      <InjuryTag status={r.injuryStatus} />
                      {mine.has(r.id) && <span className="rounded bg-rocket/15 px-1 py-px text-[9px] font-bold uppercase text-rocket">Mine</span>}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
                      <PosBadge pos={r.position} />
                      <span className="font-medium text-faint">
                        {r.position}
                        {r.posRank}
                      </span>
                      {r.team}
                      <span className="text-faint sm:hidden">{r.opponent}</span>
                    </span>
                  </span>
                  <span className="hidden w-20 text-sm text-muted sm:block">{r.opponent}</span>
                  <span className="w-14 text-right font-display text-xl font-bold tabular">{r.proj}</span>
                  <span className="hidden w-12 justify-center sm:flex">{r.value !== null ? <ValueBadge value={r.value} size="sm" /> : <span className="text-xs text-faint">–</span>}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="mt-3 text-xs text-faint">Projections from Sleeper, lowered for players listed Questionable or Doubtful. Your auto lineup on My Team uses the same numbers.</p>
    </div>
  );
}
