"use client";

import Link from "next/link";
import clsx from "clsx";
import { Star } from "lucide-react";
import { InjuryTag, PlayerAvatar, PosBadge, ValueBadge } from "./PlayerBits";
import { useWatchlist } from "@/lib/watchlist";
import type { Position } from "@/lib/types";

export interface WatchRow {
  id: string;
  name: string;
  position: Position;
  team: string | null;
  value: number;
  injuryStatus: string | null;
}

/** "Your watchlist" on the home page: starred players and how their value moved since you started following. */
export function WatchlistPanel({ players }: { players: WatchRow[] }) {
  const { watching, toggle, hydrated } = useWatchlist();
  if (!hydrated) return null;
  const rows = players.filter((p) => watching[p.id]).sort((a, b) => b.value - a.value);
  if (!rows.length) return null;
  return (
    <section className="card animate-rise p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
        <Star className="size-5 fill-volt text-volt" /> Your watchlist
        <span className="text-xs font-medium normal-case tracking-normal text-faint">value change since you started watching</span>
      </h2>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => {
          const delta = p.value - watching[p.id].since;
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2">
              <Link href={`/players/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="flex items-center gap-1 text-[11px] text-muted">
                    <PosBadge pos={p.position} className="h-4 min-w-7 text-[9px]" /> {p.team ?? "FA"} <InjuryTag status={p.injuryStatus} />
                  </span>
                </span>
                <span className={clsx("text-xs font-bold tabular", delta > 0 ? "text-up" : delta < 0 ? "text-down" : "text-faint")}>
                  {delta > 0 ? "+" : ""}
                  {delta}
                </span>
                <ValueBadge value={p.value} size="sm" />
              </Link>
              <button onClick={() => toggle(p.id, p.value)} aria-label={`Stop watching ${p.name}`} className="rounded-full p-1 text-volt hover:bg-white/5">
                <Star className="size-4 fill-current" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
