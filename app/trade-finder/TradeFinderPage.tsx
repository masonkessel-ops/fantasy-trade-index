"use client";

import Link from "next/link";
import { ChevronDown, Scale, Users } from "lucide-react";
import { useMyTeam } from "@/lib/myTeam";
import { FAIR_PERCENT } from "@/lib/tradeAnalysis";
import { MARKET_WEIGHT } from "@/lib/tradeValue";
import type { PlayerValue } from "@/lib/types";
import { TradeFinder } from "./TradeFinder";

export function TradeFinderPage({ players, initialAway, initialWant }: { players: PlayerValue[]; initialAway: string[]; initialWant: string[] }) {
  const [team, , hydrated] = useMyTeam();

  if (!hydrated) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="skeleton h-96 rounded-[1.25rem]" />
          <div className="skeleton h-96 rounded-[1.25rem]" />
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 size-6 shrink-0 text-rocket" />
          <div>
            <div className="font-display text-xl font-bold uppercase">Add your team first</div>
            <p className="text-sm text-muted">The finder builds trades from your roster. Import from Sleeper, Yahoo or ESPN, paste it, snap a photo, or build it by hand.</p>
          </div>
        </div>
        <Link
          href="/my-team"
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-2 px-5 text-sm font-bold text-bg transition hover:brightness-110"
        >
          Set up My Team
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="font-semibold text-ink">{team.name}</span>
        <span>{team.league ? `Trading inside ${team.league.name} (${team.league.teams.length} teams)` : "Trading with any team. Import your league to trade with real rosters."}</span>
        <Link href="/my-team" className="font-semibold text-rocket hover:underline">
          Edit team
        </Link>
      </div>
      <TradeFinder key={`${initialAway}|${initialWant}`} team={team} players={players} initialAway={initialAway} initialWant={initialWant} />
      <details className="card group p-5 text-sm text-muted">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink">
          <Scale className="size-4 text-volt" /> How fair is measured
          <ChevronDown className="ml-auto size-4 text-faint transition group-open:rotate-180" />
        </summary>
        <p className="mt-3">
          Each player&apos;s value is {Math.round(MARKET_WEIGHT * 100)}% real trade-market price (from thousands of actual fantasy trades on FantasyCalc) and{" "}
          {Math.round((1 - MARKET_WEIGHT) * 100)}% our live stats model. Trades are weighed on that market scale, so stars cost what they really cost: two mid-level players
          don&apos;t add up to one elite one. The <b className="text-ink">wt</b> totals on each card are that market weight (a 97 is worth far more than a 74, so 97 + 74 is
          about even with a 100). A trade counts as fair when the sides are within {Math.round(FAIR_PERCENT * 100)}%. Lineup numbers show how each side&apos;s best starting
          lineup changes.
        </p>
      </details>
    </div>
  );
}
