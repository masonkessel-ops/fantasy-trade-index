"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, MessagesSquare, Repeat2, Sparkles, UserPlus } from "lucide-react";
import { InjuryTag, PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import { TradeIdeaCard } from "@/components/TradeIdeaCard";
import type { SavedTeam } from "@/lib/myTeam";
import type { PlayerValue, Scoring } from "@/lib/types";

/** Mirrors lib/advice.ts (kept separate so this client file doesn't import server code). */
interface Advice {
  week: number;
  weekPoints: Record<string, { points: number; locked: boolean; bye: boolean }>;
  lineup: { slot: string; id: string | null; points: number | null; locked: boolean; bye: boolean }[];
  swaps: { start: string; bench: string; startPoints: number; benchPoints: number; gain: number }[];
  pickups: { add: string; drop: string | null; kind: "value" | "stream"; gain: number; reason: string }[];
  trades: { partner: { rosterId: number | null; teamName: string }; give: string[]; get: string[]; myGain: number; theirGain: number | null; diff: number }[];
  hasLeague: boolean;
}

export function GamePlan({ team, players, scoring }: { team: SavedTeam; players: PlayerValue[]; scoring: Scoring }) {
  const board = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  // Result is tagged with the request it answers, so a stale result reads as "loading".
  const [result, setResult] = useState<{ key: string; advice?: Advice; error?: string } | null>(null);
  const myRoster = team.league?.teams.find((t) => t.rosterId === team.league!.myRosterId);

  const payload = useMemo(
    () =>
      JSON.stringify({
        scoring,
        team: {
          playerIds: team.playerIds,
          starters: myRoster?.starters?.length ? myRoster.starters : team.starters,
          rosterPositions: team.rosterPositions,
          myRosterId: team.league?.myRosterId,
          leagueTeams: team.league?.teams.map((t) => ({ rosterId: t.rosterId, teamName: t.teamName, players: t.players })),
        },
      }),
    [team, myRoster, scoring],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/advice", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Couldn't load recommendations.");
        if (!cancelled) setResult({ key: payload, advice: data });
      })
      .catch((e) => !cancelled && setResult({ key: payload, error: (e as Error).message }));
    return () => {
      cancelled = true;
    };
  }, [payload]);

  const current = result?.key === payload ? result : null;
  const advice = current?.advice ?? null;
  const error = current?.error ?? null;

  if (error) return <p className="rounded-xl bg-down/10 px-4 py-3 text-sm text-down">{error}</p>;
  if (!advice) {
    return (
      <section className="card flex items-center gap-3 p-5 text-sm text-muted">
        <Loader2 className="size-4 animate-spin text-rocket" /> Building your game plan…
      </section>
    );
  }


  const trades = advice.trades.slice(0, 3);

  return (
    <section className="space-y-5">
      {/* Trade ideas */}
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
              <Repeat2 className="size-5 text-flame" /> Trades you should make
            </h2>
            <p className="text-xs text-muted">
              {advice.hasLeague
                ? "Fair trades with teams in your league that upgrade your lineup without gutting theirs."
                : "Fair trades that upgrade your starting lineup. Import your league to target real rosters."}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/assistant"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-muted transition hover:text-ink"
            >
              <MessagesSquare className="size-3.5" /> Ask the assistant
            </Link>
            <Link
              href="/trade-finder"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-brand to-brand-2 px-4 text-xs font-bold text-bg transition hover:brightness-110"
            >
              Trade Finder <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
        {trades.length === 0 ? (
          <p className="rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-muted">No clear upgrades right now. Your roster is well balanced for its value.</p>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
            {trades.map((t, i) => (
              <TradeIdeaCard
                key={i}
                index={i}
                title={t.partner.teamName}
                subtitle={t.theirGain !== null ? (t.theirGain >= 0 ? "Helps both lineups" : "They may need convincing") : null}
                give={t.give}
                get={t.get}
                board={board}
                partnerRosterId={t.partner.rosterId}
                note={
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-up" />
                    <span>
                      <b className="text-up">+{t.myGain}</b> to your lineup
                      {t.theirGain !== null && (
                        <>
                          {" · "}
                          <span className={t.theirGain >= 0 ? "text-up" : "text-flame"}>
                            {t.theirGain >= 0 ? "+" : ""}
                            {t.theirGain}
                          </span>{" "}
                          to theirs
                        </>
                      )}
                    </span>
                  </span>
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Pickups (needs a league so we know who's a free agent) */}
      {advice.hasLeague && (
        <div className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
            <UserPlus className="size-5 text-up" /> Waiver pickups
          </h2>
          {advice.pickups.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No free agents beat what you have right now. Nice roster.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted">Free agents in your league who&apos;d help this week.</p>
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2">
                {advice.pickups.map((pk) => {
                  const add = board.get(pk.add);
                  const drop = pk.drop ? board.get(pk.drop) : null;
                  if (!add) return null;
                  return (
                    <li key={pk.add} className="rounded-xl border border-line bg-surface-2 p-3">
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar id={add.id} position={add.position} team={add.team} name={add.name} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-up">ADD</span>
                            <Link href={`/players/${add.id}`} className="truncate text-sm font-semibold hover:underline">
                              {add.name}
                            </Link>
                            <InjuryTag status={add.injuryStatus} />
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted">
                            <PosBadge pos={add.position} /> {add.team}
                            {pk.kind === "stream" && <span className="rounded bg-volt/15 px-1 text-[10px] font-bold text-volt">STREAM</span>}
                          </div>
                        </div>
                        <ValueBadge value={add.value} size="sm" />
                      </div>
                      {drop && (
                        <div className="mt-2 flex items-center gap-1.5 pl-12 text-xs text-muted">
                          <span className="font-bold text-down">DROP</span> {drop.name} ({drop.value})
                        </div>
                      )}
                      <p className="mt-1.5 pl-12 text-xs text-faint">{pk.reason}</p>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
