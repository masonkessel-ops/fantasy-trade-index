"use client";

import { useDeferredValue, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowDownToLine, ArrowUpFromLine, Search, X } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerBits";
import { PlayerSearch } from "@/components/PlayerSearch";
import { TradeIdeaCard } from "@/components/TradeIdeaCard";
import type { SavedTeam } from "@/lib/myTeam";
import { findOffers, shopPlayers, type FinderIdea, type FinderPool } from "@/lib/tradeFinder";
import type { PlayerValue } from "@/lib/types";

export type FinderMode = "away" | "for";

/** Your roster, the other rosters to trade with (or the whole chart), and who owns whom. */
function useFinderData(team: SavedTeam, players: PlayerValue[]) {
  return useMemo(() => {
    const board = new Map(players.map((p) => [p.id, p]));
    const toPlayers = (ids: string[]) => ids.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p);
    const mine = toPlayers(team.playerIds).sort((a, b) => b.value - a.value);
    const mineIds = new Set(team.playerIds);
    const l = team.league;
    // With an imported league, only suggest players other teams actually have.
    const pools: FinderPool[] = l
      ? l.teams.filter((t) => t.rosterId !== l.myRosterId).map((t) => ({ rosterId: t.rosterId, teamName: t.teamName, roster: toPlayers(t.players) }))
      : [{ rosterId: null, teamName: "Any team", roster: players.filter((p) => !mineIds.has(p.id)) }];
    const ownerOf = new Map<string, FinderPool>();
    for (const pool of pools) if (pool.rosterId !== null) for (const p of pool.roster) ownerOf.set(p.id, pool);
    return { board, mine, pools, ownerOf, searchPool: pools.flatMap((p) => p.roster) };
  }, [team, players]);
}

/** Both finders side by side (one column on phones). */
export function TradeFinderBoxes({ team, players, initialAway = [], initialWant = [] }: { team: SavedTeam; players: PlayerValue[]; initialAway?: string[]; initialWant?: string[] }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-2">
      <TradeAwayBox team={team} players={players} initial={initialAway} />
      <TradeForBox team={team} players={players} initial={initialWant} />
    </div>
  );
}

export function TradeAwayBox({ team, players, initial = [] }: { team: SavedTeam; players: PlayerValue[]; initial?: string[] }) {
  const { board, mine, pools } = useFinderData(team, players);
  const [away, setAway] = useState<string[]>(initial);
  const dAway = useDeferredValue(away);
  const ideas = useMemo(
    () => shopPlayers(dAway.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p), mine, pools, team.rosterPositions),
    [dAway, board, mine, pools, team.rosterPositions],
  );
  const toggle = (id: string) => setAway((a) => (a.includes(id) ? a.filter((x) => x !== id) : a.length >= 3 ? a : [...a, id]));

  return (
    <section id="trade-away" className="card scroll-mt-20 p-5">
      <BoxTitle icon={ArrowUpFromLine} color="text-rocket" title="Trade away">
        Pick up to 3 of your players. We&apos;ll find fair packages {team.league ? `on other ${team.league.name} rosters` : "from across the league"}.
      </BoxTitle>
      <div className="mb-3">
        <PlayerSearch players={mine} exclude={away} onSelect={(p) => toggle(p.id)} placeholder="Type a player on your team…" />
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {mine.map((p) => {
          const on = away.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
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
      <Results
        ideas={ideas}
        selected={away.length > 0}
        board={board}
        empty="Pick a player above to see what you could get."
        none="No fair deals for that combo that keep both lineups full. Try adding or removing a player."
        fallbackTitle="Trade idea"
      />
    </section>
  );
}

export function TradeForBox({ team, players, initial = [] }: { team: SavedTeam; players: PlayerValue[]; initial?: string[] }) {
  const { board, mine, ownerOf, searchPool } = useFinderData(team, players);
  const [want, setWant] = useState<string[]>(initial.filter((id) => !team.playerIds.includes(id)));
  const dWant = useDeferredValue(want);
  const ideas = useMemo(() => {
    const targets = dWant.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p);
    return findOffers(targets, mine, team.rosterPositions, targets[0] ? (ownerOf.get(targets[0].id) ?? null) : null);
  }, [dWant, board, mine, team.rosterPositions, ownerOf]);
  // In a league, a 2-player ask has to come from the same team.
  const owner = want[0] ? ownerOf.get(want[0]) : undefined;
  const pickable = owner ? owner.roster : searchPool;

  return (
    <section id="trade-for" className="card scroll-mt-20 p-5">
      <BoxTitle icon={ArrowDownToLine} color="text-volt" title="Trade for">
        Type who you want. We&apos;ll build fair offers from your roster that keep your lineup full.
      </BoxTitle>
      <div className="mb-3">
        <PlayerSearch
          players={pickable}
          exclude={want}
          onSelect={(p) => setWant((w) => (w.length >= 2 ? w : [...w, p.id]))}
          placeholder={want.length ? (owner ? `Add another ${owner.teamName} player…` : "Add a second player…") : "Search a player you want…"}
        />
      </div>
      {want.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
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
          {owner && <span className="text-xs text-faint">on {owner.teamName}</span>}
        </div>
      )}
      <Results
        ideas={ideas}
        selected={want.length > 0}
        board={board}
        empty="Search for a player to see what it would take."
        none="Nothing on your roster makes a fair offer without leaving a hole in your lineup. Try a cheaper target."
        fallbackTitle="Offer"
      />
    </section>
  );
}

function BoxTitle({ icon: Icon, color, title, children }: { icon: typeof Search; color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
        <Icon className={clsx("size-5", color)} /> {title}
      </h2>
      <p className="text-xs text-muted">{children}</p>
    </div>
  );
}

function Results({
  ideas,
  selected,
  board,
  empty,
  none,
  fallbackTitle,
}: {
  ideas: FinderIdea[];
  selected: boolean;
  board: Map<string, PlayerValue>;
  empty: string;
  none: string;
  fallbackTitle: string;
}) {
  if (!selected)
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-line px-4 py-6 text-sm text-faint">
        <Search className="size-4 shrink-0" /> {empty}
      </div>
    );
  if (!ideas.length) return <p className="rounded-xl bg-white/[0.04] px-4 py-4 text-sm text-muted">{none}</p>;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
      {ideas.map((i, n) => {
        const pct = Math.round(Math.abs(i.balance) * 100);
        return (
          <TradeIdeaCard
            key={`${i.give.join()}-${i.get.join()}`}
            index={n}
            title={i.partner ? i.partner.teamName : fallbackTitle}
            subtitle={pct < 3 ? "Dead-even value" : i.balance > 0 ? `${pct}% in your favor` : `You pay ${pct}% extra`}
            give={i.give}
            get={i.get}
            board={board}
            partnerRosterId={i.partner?.rosterId}
            note={<IdeaNote idea={i} />}
          />
        );
      })}
    </div>
  );
}

const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

function IdeaNote({ idea: i }: { idea: FinderIdea }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span>
        <b className={i.lineupGain >= 0 ? "text-up" : "text-flame"}>{signed(i.lineupGain)}</b> to your starting lineup
        {i.theirGain !== null && (
          <>
            , <b className={i.theirGain >= 0 ? "text-up" : "text-muted"}>{signed(i.theirGain)}</b> to theirs
          </>
        )}
      </span>
      {i.rosterChange > 0 && (
        <span className="text-flame">
          You get {i.rosterChange} more player{i.rosterChange > 1 ? "s" : ""} than you send: drop {i.rosterChange === 1 ? "a bench player" : `${i.rosterChange} bench players`}.
        </span>
      )}
      {i.rosterChange < 0 && <span>Opens {-i.rosterChange} roster spot{i.rosterChange < -1 ? "s" : ""} for a waiver pickup.</span>}
      {i.theirConcern && <span className="text-flame">{i.theirConcern}</span>}
    </span>
  );
}
