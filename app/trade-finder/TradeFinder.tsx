"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { ArrowDown, ArrowDownToLine, ArrowUpFromLine, Check, Plus, Search, X } from "lucide-react";
import { PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import { PlayerSearch } from "@/components/PlayerSearch";
import { TradeIdeaCard } from "@/components/TradeIdeaCard";
import type { SavedTeam } from "@/lib/myTeam";
import { analyzeTeam } from "@/lib/teamAnalysis";
import { findOffers, shopPlayers, type FinderIdea, type FinderPool } from "@/lib/tradeFinder";
import { POSITIONS, type PlayerValue } from "@/lib/types";

export type FinderMode = "away" | "for";

const MAX_AWAY = 3;
const MAX_WANT = 2;

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

export function TradeFinder({ team, players, initialAway = [], initialWant = [] }: { team: SavedTeam; players: PlayerValue[]; initialAway?: string[]; initialWant?: string[] }) {
  const { board, mine, pools, ownerOf, searchPool } = useFinderData(team, players);
  const [mode, setMode] = useState<FinderMode>(initialWant.length && !initialAway.length ? "for" : "away");
  const [away, setAway] = useState(() => initialAway.filter((id) => team.playerIds.includes(id)).slice(0, MAX_AWAY));
  const [want, setWant] = useState(() => initialWant.filter((id) => !team.playerIds.includes(id)).slice(0, MAX_WANT));
  const dAway = useDeferredValue(away);
  const dWant = useDeferredValue(want);
  const rp = team.rosterPositions;

  const awayIdeas = useMemo(() => shopPlayers(dAway.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p), mine, pools, rp), [dAway, board, mine, pools, rp]);
  const forIdeas = useMemo(() => {
    const targets = dWant.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p);
    return findOffers(targets, mine, rp, targets[0] ? (ownerOf.get(targets[0].id) ?? null) : null);
  }, [dWant, board, mine, rp, ownerOf]);

  const selected = mode === "away" ? away : want;
  const ideas = mode === "away" ? awayIdeas : forIdeas;
  const names = selected.map((id) => board.get(id)?.name).filter(Boolean).join(" + ");
  const scrollToResults = () => document.getElementById("finder-results")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="space-y-5">
      <ModeSwitch mode={mode} onChange={setMode} />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="card p-4 lg:sticky lg:top-6">
          {mode === "away" ? (
            <AwayPicker mine={mine} selected={away} onChange={setAway} />
          ) : (
            <ForPicker team={team} players={players} mine={mine} pool={searchPool} ownerOf={ownerOf} board={board} selected={want} onChange={setWant} />
          )}
          {selected.length > 0 && (
            <button
              onClick={scrollToResults}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-2 text-sm font-bold text-white lg:hidden"
            >
              See {ideas.length} trade{ideas.length === 1 ? "" : "s"} <ArrowDown className="size-4" />
            </button>
          )}
        </aside>

        <section id="finder-results" className="min-w-0 scroll-mt-20">
          {selected.length === 0 ? (
            <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-white/[0.04] text-faint">
                <Search className="size-5" />
              </span>
              <p className="font-display text-xl font-bold uppercase">{mode === "away" ? "Pick who to trade away" : "Pick who you want"}</p>
              <p className="max-w-sm text-sm text-muted">
                {mode === "away"
                  ? "Tap up to 3 of your players. You'll get fair packages you could ask for."
                  : "Search any player. You'll get fair offers built from your roster."}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 px-1">
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide">
                  {ideas.length} fair trade{ideas.length === 1 ? "" : "s"}
                </h2>
                <p className="min-w-0 truncate text-sm text-muted">
                  {mode === "away" ? "for " : "to get "}
                  <b className="text-ink">{names}</b>
                </p>
              </div>
              {ideas.length === 0 ? (
                <p className="card px-5 py-6 text-sm text-muted">
                  {mode === "away"
                    ? "No fair deals for that combo that keep both lineups full. Try adding or removing a player."
                    : "Nothing on your roster makes a fair offer without leaving a hole in your lineup. Try a cheaper target."}
                </p>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
                  {ideas.map((i, n) => (
                    <IdeaCard key={`${i.give.join()}-${i.get.join()}`} idea={i} index={n} board={board} fallbackTitle={mode === "away" ? "Trade idea" : "Offer"} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ModeSwitch({ mode, onChange }: { mode: FinderMode; onChange: (m: FinderMode) => void }) {
  const tabs = [
    { id: "away", label: "Trade away", hint: "See what your players can get", icon: ArrowUpFromLine, color: "text-rocket" },
    { id: "for", label: "Trade for", hint: "See what it takes to get someone", icon: ArrowDownToLine, color: "text-volt" },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1">
      {tabs.map((t) => {
        const on = mode === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} className={clsx("relative rounded-xl px-3 py-3 text-left transition sm:px-4", on ? "text-ink" : "text-muted hover:text-ink")}>
            {on && <motion.span layoutId="finder-mode" className="absolute inset-0 rounded-xl border border-line-strong bg-surface-3" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide sm:text-xl">
              <t.icon className={clsx("size-5", on && t.color)} /> {t.label}
            </span>
            <span className="relative mt-0.5 hidden text-xs text-muted sm:block">{t.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function PickerTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-lg font-bold uppercase tracking-wide">{title}</h2>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

function AwayPicker({ mine, selected, onChange }: { mine: PlayerValue[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : selected.length >= MAX_AWAY ? selected : [...selected, id]);
  const groups = POSITIONS.map((pos) => ({ pos, players: mine.filter((p) => p.position === pos) })).filter((g) => g.players.length);
  return (
    <>
      <PickerTitle title="Your players" hint={`Tap up to ${MAX_AWAY} you'd move. ${selected.length}/${MAX_AWAY} picked.`} />
      <div className="mb-3">
        <PlayerSearch players={mine} exclude={selected} onSelect={(p) => toggle(p.id)} placeholder="Search your team…" />
      </div>
      <div className="no-scrollbar -mx-1 space-y-3 px-1 lg:max-h-[calc(100dvh-20rem)] lg:overflow-y-auto">
        {groups.map((g) => (
          <div key={g.pos}>
            <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-[0.15em] text-faint">{g.pos}</div>
            <ul className="space-y-1">
              {g.players.map((p) => {
                const on = selected.includes(p.id);
                const full = !on && selected.length >= MAX_AWAY;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => toggle(p.id)}
                      disabled={full}
                      className={clsx(
                        "flex w-full items-center gap-2.5 rounded-xl border px-2 py-1.5 text-left transition",
                        on ? "border-rocket/60 bg-rocket/10" : "border-transparent hover:bg-white/[0.04]",
                        full && "opacity-40",
                      )}
                    >
                      <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold leading-tight">{p.name}</span>
                        <span className="text-[11px] text-muted">{p.team ?? "FA"}</span>
                      </span>
                      <ValueBadge value={p.value} size="sm" />
                      <span className={clsx("grid size-6 shrink-0 place-items-center rounded-full border", on ? "border-rocket bg-brand text-white" : "border-line-strong text-transparent")}>
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

function ForPicker({
  team,
  players,
  mine,
  pool,
  ownerOf,
  board,
  selected,
  onChange,
}: {
  team: SavedTeam;
  players: PlayerValue[];
  mine: PlayerValue[];
  pool: PlayerValue[];
  ownerOf: Map<string, FinderPool>;
  board: Map<string, PlayerValue>;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  // In a league, a 2-player ask has to come from the same team.
  const owner = selected[0] ? ownerOf.get(selected[0]) : undefined;
  const pickable = owner ? owner.roster : pool;
  const add = (id: string) => onChange(selected.length >= MAX_WANT || selected.includes(id) ? selected : [...selected, id]);

  // Ideas when nothing is picked yet: realistic upgrades at your weakest position.
  const suggestions = useMemo(() => {
    const weakest = analyzeTeam(mine, players, team.rosterPositions, team.league?.totalRosters ?? 12).weakest;
    if (!weakest) return null;
    const myBest = mine.find((p) => p.position === weakest.position)?.value ?? 0;
    const list = pool
      .filter((p) => p.position === weakest.position && p.value > myBest)
      .sort((a, b) => a.value - b.value)
      .slice(0, 5)
      .reverse();
    return list.length ? { pos: weakest.position, list } : null;
  }, [mine, players, pool, team]);

  return (
    <>
      <PickerTitle title="Who do you want?" hint={team.league ? `Any player on another ${team.league.name} team.` : "Any player on the value chart."} />
      <PlayerSearch
        players={pickable}
        exclude={selected}
        onSelect={(p) => add(p.id)}
        placeholder={selected.length ? (owner ? `Add another ${owner.teamName} player…` : "Add a second player…") : "Search a player…"}
      />
      {selected.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {selected.map((id) => {
            const p = board.get(id);
            if (!p) return null;
            return (
              <li key={id} className="flex items-center gap-2.5 rounded-xl border border-volt/50 bg-volt/10 px-2 py-1.5">
                <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold leading-tight">{p.name}</span>
                  <span className="text-[11px] text-muted">
                    {p.position} · {p.team ?? "FA"}
                    {ownerOf.get(id) && ` · ${ownerOf.get(id)!.teamName}`}
                  </span>
                </span>
                <ValueBadge value={p.value} size="sm" />
                <button onClick={() => onChange(selected.filter((x) => x !== id))} aria-label={`Remove ${p.name}`} className="grid size-7 place-items-center rounded-full text-faint hover:bg-white/5 hover:text-ink">
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selected.length === 0 && suggestions && (
        <div className="mt-4">
          <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.15em] text-faint">
            Upgrade your <PosBadge pos={suggestions.pos} className="h-4 min-w-7 text-[9px]" />
          </div>
          <ul className="space-y-1">
            {suggestions.list.map((p) => (
              <li key={p.id}>
                <button onClick={() => add(p.id)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/[0.04]">
                  <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold leading-tight">{p.name}</span>
                    <span className="text-[11px] text-muted">
                      {p.team ?? "FA"}
                      {ownerOf.get(p.id) && ` · ${ownerOf.get(p.id)!.teamName}`}
                    </span>
                  </span>
                  <ValueBadge value={p.value} size="sm" />
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line-strong text-muted">
                    <Plus className="size-3.5" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

function IdeaCard({ idea: i, index, board, fallbackTitle }: { idea: FinderIdea; index: number; board: Map<string, PlayerValue>; fallbackTitle: string }) {
  const pct = Math.round(Math.abs(i.balance) * 100);
  return (
    <TradeIdeaCard
      index={index}
      title={i.partner ? i.partner.teamName : fallbackTitle}
      subtitle={pct < 3 ? "Dead-even value" : i.balance > 0 ? `${pct}% in your favor` : `You pay ${pct}% extra`}
      give={i.give}
      get={i.get}
      board={board}
      partnerRosterId={i.partner?.rosterId}
      note={
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
      }
    />
  );
}
