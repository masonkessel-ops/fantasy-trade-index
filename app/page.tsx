import Link from "next/link";
import { ArrowLeftRight, ArrowRight, Flame, ListOrdered, MessagesSquare, Radio, Repeat, TrendingDown, TrendingUp, Users } from "lucide-react";
import { ChangePill, PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import { Sparkline } from "@/components/Charts";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { getLiveWeek } from "@/lib/live";
import { getScoring } from "@/lib/prefs";
import { getValueBoard } from "@/lib/values";
import { getWeeklyRankings } from "@/lib/weekly";
import { POS_COLOR } from "@/lib/ui";
import type { PlayerValue } from "@/lib/types";
import { PlayerRowLink } from "./live/TopScorers";

export default async function Home() {
  const scoring = await getScoring();
  const [board, live, weekly] = await Promise.all([getValueBoard(scoring), getLiveWeek(scoring), getWeeklyRankings(scoring)]);
  const top = board.players.slice(0, 8);
  const movers = board.players.filter((p) => p.change !== null && p.value >= 55);
  const risers = [...movers].sort((a, b) => b.change! - a.change!).slice(0, 5);
  const fallers = [...movers].sort((a, b) => a.change! - b.change!).slice(0, 5);
  // Hot = biggest jump in last-3 PPG over season PPG, among real contributors.
  const hot = board.players
    .filter((p) => p.recentPpg !== null && p.recentPpg >= 12 && p.value >= 60 && p.gamesPlayed >= 2 && p.position !== "K" && p.position !== "DST")
    .sort((a, b) => b.recentPpg! - b.ppg - (a.recentPpg! - a.ppg) || b.recentPpg! - a.recentPpg!)
    .slice(0, 6);
  const liveCount = live.games.filter((g) => g.state === "live").length;
  const finalCount = live.games.filter((g) => g.state === "final").length;

  return (
    <div className="space-y-6">
      <section className="relative animate-rise overflow-hidden rounded-[1.75rem] border border-line bg-surface p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-rocket/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-40 size-72 rounded-full bg-volt/10 blur-3xl" />
        <Link
          href="/live"
          className="relative inline-flex items-center gap-2 rounded-full border border-line bg-bg/40 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted transition hover:text-ink"
        >
          {liveCount > 0 ? (
            <>
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-down opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-down" />
              </span>
              {liveCount} game{liveCount > 1 ? "s" : ""} live
            </>
          ) : (
            <>
              <span className="size-2 rounded-full bg-up" />
              Week {board.week} · {finalCount}/{live.games.length} final
            </>
          )}
        </Link>
        <h1 className="relative mt-4 max-w-2xl font-display text-5xl font-extrabold uppercase italic leading-[0.9] sm:text-7xl">
          Win every <span className="text-gradient">trade.</span>
        </h1>
        <p className="relative mt-4 max-w-lg text-sm text-muted sm:text-base">
          Live 1–100 trade values priced on the real trade market, fair trades built from your roster, and a lineup that starts whoever is projected to score the most.
        </p>
        <div className="relative mt-6 flex flex-wrap gap-2">
          <Link
            href="/my-team"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-2 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_30px_-8px] shadow-rocket/60 transition hover:brightness-110"
          >
            Set up my team <ArrowRight className="size-4" />
          </Link>
          <Link href="/trade" className="inline-flex items-center gap-2 rounded-full border border-line-strong px-5 py-2.5 text-sm font-semibold transition hover:bg-white/5">
            Analyze a trade
          </Link>
          <Link href="/values" className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-muted transition hover:text-ink">
            Trade values
          </Link>
        </div>
        <p className="relative mt-5 text-xs text-faint">Free · no AI · import from Sleeper, ESPN, a Yahoo screenshot, or build by hand</p>
      </section>

      {/* Tools */}
      <section className="grid animate-rise grid-cols-2 gap-3 [animation-delay:40ms] md:grid-cols-3">
        {[
          { href: "/my-team", icon: Users, title: "My Team", text: "Auto lineup, grades and trade ideas" },
          { href: "/trade", icon: ArrowLeftRight, title: "Trade Analyzer", text: "Grade any deal in seconds" },
          { href: "/trade-finder", icon: Repeat, title: "Trade Finder", text: "Fair trades for your roster" },
          { href: "/rankings", icon: ListOrdered, title: "Weekly Rankings", text: "Who to start this week" },
          { href: "/waivers", icon: TrendingUp, title: "Waiver Wire", text: "Who everyone is adding" },
          { href: "/assistant", icon: MessagesSquare, title: "Trade Assistant", text: "Ask anything, instant answers" },
        ].map((f) => (
          <Link key={f.href} href={f.href} className="card group flex items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:border-rocket/40">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand/25 to-brand-2/10 text-rocket transition group-hover:scale-105">
              <f.icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg font-bold uppercase leading-tight">{f.title}</span>
              <span className="block text-xs text-muted">{f.text}</span>
            </span>
          </Link>
        ))}
      </section>

      {/* Hot players */}
      <section className="animate-rise [animation-delay:60ms]">
        <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
          <Flame className="size-5 text-flame" /> Hot players
          <span className="text-xs font-medium normal-case tracking-normal text-faint">last 3 games vs. season</span>
        </h2>
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 xl:grid-cols-6">
          {hot.map((p) => (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className="card group relative w-44 shrink-0 snap-start overflow-hidden p-4 transition hover:-translate-y-0.5 hover:border-flame/40 sm:w-auto"
            >
              <div className="absolute inset-x-0 top-0 h-16 opacity-30" style={{ background: `linear-gradient(180deg, ${POS_COLOR[p.position]}, transparent)` }} />
              <div className="relative flex items-center justify-between">
                <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={44} />
                <ValueBadge value={p.value} size="sm" />
              </div>
              <div className="relative mt-3 truncate text-sm font-semibold">{p.name}</div>
              <div className="relative flex items-center gap-1.5 text-xs text-muted">
                <PosBadge pos={p.position} /> {p.team}
              </div>
              <div className="relative mt-3 flex items-end justify-between">
                <div>
                  <div className="font-display text-2xl font-bold leading-none text-flame">{p.recentPpg}</div>
                  <div className="text-[10px] text-faint">L3 ppg · {p.ppg} season</div>
                </div>
                <Sparkline values={p.weekPoints} color={POS_COLOR[p.position]} width={56} height={22} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card animate-rise p-5 [animation-delay:100ms]">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold uppercase tracking-wide">Top trade values</h2>
            <Link href="/values" className="text-xs font-semibold text-rocket hover:underline">
              Full chart
            </Link>
          </div>
          <ol className="divide-y divide-line">
            {top.map((p, i) => (
              <PlayerRow key={p.id} p={p} rank={i + 1} />
            ))}
          </ol>
        </section>

        <section className="card animate-rise p-5 [animation-delay:140ms]">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
              {live.players.length === 0 ? (
                <>
                  <ListOrdered className="size-5 text-volt" /> Week {weekly.week} projected leaders
                </>
              ) : (
                <>
                  <Radio className="size-5 text-down" /> Week {live.week} top scorers
                </>
              )}
            </h2>
            <Link href={live.players.length === 0 ? "/rankings" : "/live"} className="text-xs font-semibold text-rocket hover:underline">
              {live.players.length === 0 ? "All rankings" : "Live tracker"}
            </Link>
          </div>
          {live.players.length === 0 ? (
            <ol className="divide-y divide-line">
              {weekly.rows.slice(0, 8).map((r, i) => (
                <li key={r.id}>
                  <Link href={`/players/${r.id}`} className="flex items-center gap-3 py-2.5 transition hover:opacity-80">
                    <span className="w-5 text-center font-display text-sm font-bold text-faint">{i + 1}</span>
                    <PlayerAvatar id={r.id} position={r.position} team={r.team} name={r.name} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{r.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        <PosBadge pos={r.position} /> {r.team} <span className="text-faint">{r.opponent}</span>
                      </span>
                    </span>
                    <span className="text-right leading-none">
                      <span className="block font-display text-xl font-bold tabular">{r.proj}</span>
                      <span className="text-[10px] text-faint">proj</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <ol className="divide-y divide-line">
              {live.players.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <PlayerRowLink p={p} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <MoverCard title="Risers" icon={<TrendingUp className="size-5 text-up" />} players={risers} delay={180} />
        <MoverCard title="Fallers" icon={<TrendingDown className="size-5 text-down" />} players={fallers} delay={220} />
      </div>

      <NewsletterSignup source="home" />

    </div>
  );
}

function PlayerRow({ p, rank }: { p: PlayerValue; rank?: number }) {
  return (
    <li>
      <Link href={`/players/${p.id}`} className="flex items-center gap-3 py-2.5 transition hover:opacity-80">
        {rank !== undefined && <span className="w-5 text-center font-display font-semibold text-faint">{rank}</span>}
        <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{p.name}</span>
          <span className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted">
            <PosBadge pos={p.position} /> {p.team} · {p.ppg} ppg
          </span>
        </span>
        <ChangePill change={p.change} />
        <ValueBadge value={p.value} size="sm" />
      </Link>
    </li>
  );
}

function MoverCard({ title, icon, players, delay }: { title: string; icon: React.ReactNode; players: PlayerValue[]; delay: number }) {
  return (
    <section className="card animate-rise p-5" style={{ animationDelay: `${delay}ms` }}>
      <h2 className="mb-2 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
        {icon} {title}
        <span className="text-xs font-medium normal-case tracking-normal text-faint">value vs. last week</span>
      </h2>
      <ol className="divide-y divide-line">
        {players.map((p) => (
          <PlayerRow key={p.id} p={p} />
        ))}
      </ol>
    </section>
  );
}
