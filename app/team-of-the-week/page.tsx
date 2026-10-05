import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { CountUp } from "@/components/CountUp";
import { PosBadge } from "@/components/PlayerBits";
import { getScoring } from "@/lib/prefs";
import { getTeamOfTheWeek } from "@/lib/totw";
import { SCORINGS } from "@/lib/types";
import { PlayerRowLink } from "../live/TopScorers";
import { Field } from "./Field";

export const metadata: Metadata = { title: "Team of the Week" };

export default async function TeamOfTheWeekPage({ searchParams }: PageProps<"/team-of-the-week">) {
  const [{ week: w }, scoring] = await Promise.all([searchParams, getScoring()]);
  const t = await getTeamOfTheWeek(scoring, Number(w) || undefined);
  const label = SCORINGS.find((s) => s.id === scoring)!.label;

  return (
    <div className="space-y-6">
      <header className="flex animate-rise flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-rocket">
            {t.season} · {label}
            {t.inProgress && " · Week in progress"}
          </p>
          <h1 className="font-display text-4xl font-extrabold uppercase italic leading-[0.95] sm:text-5xl">
            Team of the <span className="text-gradient">Week {t.week}</span>
          </h1>
          <p className="mt-2 text-sm text-muted">The highest-scoring lineup possible: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX, 1 K, 1 DST.</p>
        </div>
        <div className="flex items-end gap-4">
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">Total points</div>
            <CountUp value={t.total} decimals={1} className="font-display text-5xl font-extrabold text-gradient tabular" />
          </div>
        </div>
      </header>

      <nav className="no-scrollbar -mx-4 flex animate-rise gap-1.5 overflow-x-auto px-4 [animation-delay:40ms] lg:mx-0 lg:px-0">
        {Array.from({ length: t.currentWeek }, (_, i) => i + 1).map((wk) => (
          <Link
            key={wk}
            href={wk === t.currentWeek ? "/team-of-the-week" : `/team-of-the-week?week=${wk}`}
            className={clsx(
              "grid h-9 min-w-16 shrink-0 place-items-center rounded-full px-4 text-xs font-bold transition",
              wk === t.week ? "bg-gradient-to-r from-rocket to-flame text-bg" : "bg-surface text-muted ring-1 ring-line hover:text-ink",
            )}
          >
            Week {wk}
          </Link>
        ))}
      </nav>

      <section className="animate-rise [animation-delay:80ms]">
        <Field lineup={t.lineup} mvp={t.mvp} weekKey={`${t.week}-${scoring}`} />
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card animate-rise p-5 [animation-delay:140ms] lg:col-span-3">
          <h2 className="mb-2 font-display text-xl font-bold uppercase tracking-wide">Lineup</h2>
          <ul className="divide-y divide-line">
            {t.lineup.map((s) => (
              <li key={s.slot} className="flex items-center gap-3">
                <span className="w-11 shrink-0">
                  {s.slot === "FLEX" ? (
                    <span className="inline-flex h-5 min-w-9 items-center justify-center rounded-md bg-white/10 px-1.5 text-[10px] font-bold text-ink">FLEX</span>
                  ) : (
                    <PosBadge pos={s.player?.position ?? (s.slot.replace(/\d/, "") as "QB")} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  {s.player ? <PlayerRowLink p={s.player} /> : <p className="py-3 text-sm text-faint">No one has scored yet</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="card animate-rise p-5 [animation-delay:200ms] lg:col-span-2">
          <h2 className="mb-2 font-display text-xl font-bold uppercase tracking-wide">Just missed</h2>
          <ul className="divide-y divide-line">
            {t.honorable.map((p) => (
              <li key={p.id}>
                <PlayerRowLink p={p} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
