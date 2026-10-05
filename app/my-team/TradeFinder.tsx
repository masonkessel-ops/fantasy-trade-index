"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { ArrowDownToLine, ArrowUpFromLine, Search, X } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerBits";
import { PlayerSearch } from "@/components/PlayerSearch";
import { TradeIdeaCard } from "@/components/TradeIdeaCard";
import type { SavedTeam } from "@/lib/myTeam";
import { findOffers, shopPlayers, type FinderPool } from "@/lib/tradeFinder";
import type { PlayerValue } from "@/lib/types";

type Mode = "away" | "for";

export function TradeFinder({ team, players }: { team: SavedTeam; players: PlayerValue[] }) {
  const board = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const mine = useMemo(() => team.playerIds.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p).sort((a, b) => b.value - a.value), [team, board]);
  const [mode, setMode] = useState<Mode>("away");
  const [away, setAway] = useState<string[]>([]);
  const [want, setWant] = useState<string[]>([]);
  const dAway = useDeferredValue(away);
  const dWant = useDeferredValue(want);

  // With an imported league, only suggest players other teams actually have.
  const pools: FinderPool[] = useMemo(() => {
    const l = team.league;
    if (l) {
      return l.teams
        .filter((t) => t.rosterId !== l.myRosterId)
        .map((t) => ({ rosterId: t.rosterId, teamName: t.teamName, roster: t.players.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p) }));
    }
    const mineIds = new Set(team.playerIds);
    return [{ rosterId: null, teamName: "Any team", roster: players.filter((p) => !mineIds.has(p.id)) }];
  }, [team, board, players]);

  const ownerOf = useMemo(() => {
    const m = new Map<string, FinderPool>();
    for (const pool of pools) if (pool.rosterId !== null) for (const p of pool.roster) m.set(p.id, pool);
    return m;
  }, [pools]);

  const ideas = useMemo(() => {
    const rp = team.rosterPositions;
    if (mode === "away") return shopPlayers(dAway.map((id) => board.get(id)!).filter(Boolean), mine, pools, rp);
    const targets = dWant.map((id) => board.get(id)!).filter(Boolean);
    return findOffers(targets, mine, rp, targets[0] ? (ownerOf.get(targets[0].id) ?? null) : null);
  }, [mode, dAway, dWant, mine, pools, board, team.rosterPositions, ownerOf]);

  const selected = mode === "away" ? away : want;
  const toggleAway = (id: string) => setAway((a) => (a.includes(id) ? a.filter((x) => x !== id) : a.length >= 3 ? a : [...a, id]));
  const searchPool = useMemo(() => {
    const mineIds = new Set(team.playerIds);
    return team.league ? pools.flatMap((p) => p.roster) : players.filter((p) => !mineIds.has(p.id));
  }, [team, pools, players]);

  return (
    <section className="card p-5">
      <h2 className="font-display text-xl font-bold uppercase tracking-wide">Trade finder</h2>
      <p className="mb-4 text-xs text-muted">
        {team.league ? `Searches every roster in ${team.league.name}.` : "Searches every player on the value chart."} Trades are judged on trade power, so suggestions are ones the
        other side could accept.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
        {(
          [
            { id: "away", label: "Trade away", icon: ArrowUpFromLine },
            { id: "for", label: "Trade for", icon: ArrowDownToLine },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={clsx("relative flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold", mode === t.id ? "text-ink" : "text-muted hover:text-ink")}
          >
            {mode === t.id && <motion.span layoutId="finder-tab" className="absolute inset-0 rounded-lg bg-surface-3" />}
            <t.icon className="relative size-4" />
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {mode === "away" ? (
        <>
          <p className="mb-2 text-sm text-muted">Pick up to 3 of your players you&apos;d move:</p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {mine.map((p) => {
              const on = away.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleAway(p.id)}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs font-medium transition",
                    on ? "border-rocket bg-rocket/15 text-ink" : "border-line bg-surface-2 text-muted hover:text-ink",
                  )}
                >
                  <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={22} />
                  {p.name}
                  <span className="text-faint">{p.value}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">Who do you want? We&apos;ll find what to offer from your roster.</p>
          <div className="mb-3">
            <PlayerSearch players={searchPool} exclude={want} onSelect={(p) => setWant((w) => (w.length >= 2 ? w : [...w, p.id]))} placeholder="Search a player you want…" />
          </div>
          {want.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {want.map((id) => {
                const p = board.get(id);
                if (!p) return null;
                return (
                  <span key={id} className="flex items-center gap-1.5 rounded-full border border-volt/50 bg-volt/10 py-1 pl-1 pr-1.5 text-xs font-medium">
                    <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={22} />
                    {p.name} <span className="text-faint">{p.value}</span>
                    <button onClick={() => setWant((w) => w.filter((x) => x !== id))} aria-label={`Remove ${p.name}`} className="rounded-full p-0.5 text-faint hover:text-ink">
                      <X className="size-3.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </>
      )}

      {selected.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-line px-4 py-6 text-sm text-faint">
          <Search className="size-4" /> {mode === "away" ? "Pick a player above to see what you could get." : "Search for a player to see what it would take."}
        </div>
      ) : ideas.length === 0 ? (
        <p className="rounded-xl bg-white/[0.04] px-4 py-4 text-sm text-muted">
          {mode === "away"
            ? "No fair deals found for that combo. Try adding or removing a player."
            : "Nothing on your roster makes a fair offer without gutting your lineup. Try a cheaper target."}
        </p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ideas.map((i, n) => {
            const pct = Math.round(Math.abs(i.balance) * 100);
            return (
              <TradeIdeaCard
                key={`${i.give.join()}-${i.get.join()}`}
                index={n}
                title={i.partner ? i.partner.teamName : mode === "away" ? "Trade idea" : "Offer"}
                subtitle={pct < 3 ? "Dead-even value" : i.balance > 0 ? `${pct}% in your favor` : `You pay ${pct}% extra`}
                give={i.give}
                get={i.get}
                board={board}
                partnerRosterId={i.partner?.rosterId}
                note={
                  <span>
                    <b className={i.lineupGain >= 0 ? "text-up" : "text-flame"}>
                      {i.lineupGain >= 0 ? "+" : ""}
                      {i.lineupGain}
                    </b>{" "}
                    starting-lineup value for you
                  </span>
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
