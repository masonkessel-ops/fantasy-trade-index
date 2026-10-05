"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { PlayerAvatar, PosBadge } from "@/components/PlayerBits";
import { POS_COLOR } from "@/lib/ui";
import { POSITIONS, type Position } from "@/lib/types";
import type { LivePlayer } from "@/lib/live";

export function TopScorers({ players }: { players: LivePlayer[] }) {
  const [pos, setPos] = useState<Position | "ALL">("ALL");
  const rows = players.filter((p) => pos === "ALL" || p.position === pos).slice(0, 12);
  return (
    <>
      <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
        {(["ALL", ...POSITIONS] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPos(p)}
            className={clsx(
              "relative h-8 shrink-0 rounded-full px-3.5 text-xs font-bold",
              pos === p ? "text-bg" : "bg-surface-2 text-muted hover:text-ink",
            )}
          >
            {pos === p && (
              <motion.span
                layoutId="live-pos"
                className="absolute inset-0 rounded-full"
                style={{ background: p === "ALL" ? "var(--color-rocket)" : POS_COLOR[p] }}
              />
            )}
            <span className="relative">{p === "ALL" ? "All" : p}</span>
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-faint">No points scored yet.</p>
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="w-5 text-center font-display font-semibold text-faint">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <PlayerRowLink p={p} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function PlayerRowLink({ p }: { p: LivePlayer }) {
  return (
    <Link href={`/players/${p.id}`} className="flex items-center gap-3 py-2 transition hover:opacity-80">
      <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={34} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{p.name}</span>
          {p.gameState === "live" && <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-down" title="Game in progress" />}
        </span>
        <span className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted">
          <PosBadge pos={p.position} /> <span className="truncate">{p.line}</span>
        </span>
      </span>
      <span className="text-right">
        <span className="block font-display text-xl font-bold leading-none tabular">{p.pts}</span>
        {p.proj !== null && (
          <span className={clsx("text-[11px] tabular", p.diff! >= 0 ? "text-up" : "text-down")}>
            {p.diff! >= 0 ? "+" : ""}
            {p.diff} <span className="text-faint">/ {p.proj}</span>
          </span>
        )}
      </span>
    </Link>
  );
}
