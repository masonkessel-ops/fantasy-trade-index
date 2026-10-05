import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Flame, Snowflake } from "lucide-react";
import { getLiveWeek, type LiveGame, type LivePlayer } from "@/lib/live";
import { getScoring } from "@/lib/prefs";
import { TeamLogo } from "@/components/PlayerBits";
import { AutoRefresh, LocalKickoff } from "./AutoRefresh";
import { PlayerRowLink, TopScorers } from "./TopScorers";

export const metadata: Metadata = { title: "Live Tracker" };

export default async function LivePage({ searchParams }: PageProps<"/live">) {
  const [{ week: w }, scoring] = await Promise.all([searchParams, getScoring()]);
  const data = await getLiveWeek(scoring, Number(w) || undefined);
  const isCurrent = data.week === data.currentWeek;
  const final = data.games.filter((g) => g.state === "final").length;

  return (
    <div className="space-y-6">
      <header className="flex animate-rise flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-rocket">
            {data.anyLive && (
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-down opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-down" />
              </span>
            )}
            {data.anyLive ? "Games in progress" : `${final}/${data.games.length} games final`} · {data.season}
          </p>
          <h1 className="font-display text-4xl font-extrabold uppercase italic leading-[0.95] sm:text-5xl">
            Week {data.week} <span className="text-gradient">Live</span>
          </h1>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          {isCurrent && <AutoRefresh updatedAt={data.updatedAt} live={data.anyLive} />}
          <nav className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {Array.from({ length: data.currentWeek }, (_, i) => i + 1).map((wk) => (
              <Link
                key={wk}
                href={wk === data.currentWeek ? "/live" : `/live?week=${wk}`}
                className={clsx(
                  "grid h-8 min-w-10 shrink-0 place-items-center rounded-full px-3 text-xs font-bold transition",
                  wk === data.week ? "bg-ink text-bg" : "bg-surface text-muted ring-1 ring-line hover:text-ink",
                )}
              >
                W{wk}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-5">
        <section className="card animate-rise p-5 [animation-delay:120ms] xl:col-span-3">
          <h2 className="mb-3 font-display text-xl font-bold uppercase tracking-wide">Top scorers</h2>
          <TopScorers players={data.players} />
        </section>
        <div className="grid gap-5 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-1">
          <BoomBust title="Booms" icon={<Flame className="size-5 text-flame" />} players={data.booms} empty="No big booms yet this week." />
          <BoomBust title="Busts" icon={<Snowflake className="size-5 text-volt" />} players={data.busts} empty="No busts yet (only finished games count)." />
        </div>
      </div>
      {/* Scoreboard */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold uppercase tracking-wide">Scoreboard</h2>
        <div className="grid animate-rise gap-3 [animation-delay:200ms] sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {data.games.map((g) => (
            <GameCard key={g.gameId} g={g} />
          ))}
        </div>
      </section>
    </div>
  );
}

function GameCard({ g }: { g: LiveGame }) {
  const live = g.state === "live";
  const homeWin = g.state === "final" && (g.homeScore ?? 0) > (g.awayScore ?? 0);
  const awayWin = g.state === "final" && (g.awayScore ?? 0) > (g.homeScore ?? 0);
  return (
    <div className={clsx("card overflow-hidden p-4", live && "border-down/40 shadow-[0_0_30px_-12px] shadow-down/60")}>
      <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
        {live ? (
          <span className="flex items-center gap-1.5 text-down">
            <span className="size-1.5 animate-pulse rounded-full bg-down" />
            {g.quarter === "H" ? "Halftime" : `Q${g.quarter} · ${g.clock}`}
          </span>
        ) : g.state === "final" ? (
          <span className="text-faint">Final{g.quarter === "OT" ? "/OT" : ""}</span>
        ) : (
          <LocalKickoff iso={g.kickoff} />
        )}
        {live && g.downDistance && <span className="normal-case text-muted">{g.downDistance}</span>}
      </div>
      {[
        { team: g.away, score: g.awayScore, win: awayWin, poss: g.possession === g.away },
        { team: g.home, score: g.homeScore, win: homeWin, poss: g.possession === g.home },
      ].map((t) => (
        <div key={t.team} className="flex items-center gap-2.5 py-1">
          <TeamLogo team={t.team} size={26} />
          <span className={clsx("flex-1 font-display text-lg font-bold", g.state === "final" && !t.win && "text-muted")}>
            {t.team}
            {t.poss && live && <span className="ml-1.5 inline-block size-1.5 -translate-y-0.5 rounded-full bg-flame" title="Possession" />}
          </span>
          <span className={clsx("font-display text-2xl font-bold tabular", g.state === "final" && !t.win && "text-muted")}>
            {g.state === "pre" ? "" : (t.score ?? 0)}
          </span>
        </div>
      ))}
      {g.top.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-line pt-3">
          {g.top.map((p) => (
            <li key={p.id}>
              <Link href={`/players/${p.id}`} className="flex items-center gap-2 text-xs hover:text-ink">
                <span className="w-7 font-semibold text-faint">{p.team}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink/90">{p.name}</span>
                <span className="font-display text-sm font-bold tabular text-flame">{p.pts}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BoomBust({ title, icon, players, empty }: { title: string; icon: React.ReactNode; players: LivePlayer[]; empty: string }) {
  return (
    <section className="card animate-rise p-5 [animation-delay:180ms]">
      <h2 className="mb-2 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
        {icon}
        {title}
        <span className="ml-auto text-[10px] font-semibold normal-case tracking-normal text-faint">vs. projection</span>
      </h2>
      {players.length === 0 ? (
        <p className="py-6 text-center text-sm text-faint">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {players.map((p) => (
            <li key={p.id}>
              <PlayerRowLink p={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
