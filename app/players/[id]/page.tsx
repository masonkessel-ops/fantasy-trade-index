import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ChangePill, InjuryTag, PlayerAvatar, PosBadge, TeamLogo, ValueBadge } from "@/components/PlayerBits";
import { ValueTrendChart, WeeklyPointsChart } from "@/components/Charts";
import { getScoring } from "@/lib/prefs";
import { getPlayerDetail } from "@/lib/values";
import { NFL_TEAMS, teamLogo } from "@/lib/teams";
import { POS_COLOR } from "@/lib/ui";
import { WEIGHTS, valueTier } from "@/lib/tradeValue";
import { getPlayers } from "@/lib/sleeper";
import { statLine } from "@/lib/statLine";

export async function generateMetadata({ params }: PageProps<"/players/[id]">): Promise<Metadata> {
  const { id } = await params;
  const players = await getPlayers();
  return { title: players[id]?.name ?? "Player" };
}

const FACTOR_LABELS: Record<string, { label: string; hint: string }> = {
  seasonPpg: { label: "Season PPG", hint: "Points per game over replacement" },
  recentForm: { label: "Recent form", hint: "Last 3 games over replacement" },
  restOfSeason: { label: "Rest of season", hint: "Projected points left over replacement" },
  scarcity: { label: "Scarcity", hint: "Positional tier × how thin the position is" },
  age: { label: "Age", hint: "1.0 until the position's age peak" },
  byeWeek: { label: "Bye week", hint: "Upcoming bye costs value" },
};

export default async function PlayerPage({ params }: PageProps<"/players/[id]">) {
  const [{ id }, scoring] = await Promise.all([params, getScoring()]);
  const detail = await getPlayerDetail(id, scoring);
  if (!detail) notFound();
  const { player, value, weeks, currentWeek } = detail;
  const color = POS_COLOR[player.position];
  const team = player.team ? NFL_TEAMS[player.team] : null;
  const tier = value ? valueTier(value.value) : null;
  const played = weeks.filter((w) => w.actual !== null);
  const best = played.reduce<(typeof weeks)[number] | null>((b, w) => (!b || w.actual! > b.actual! ? w : b), null);

  return (
    <div className="space-y-5">
      <Link href="/values" className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
        <ArrowLeft className="size-4" /> Trade values
      </Link>

      {/* Hero */}
      <section
        className="card relative animate-rise overflow-hidden p-5 sm:p-7"
        style={{
          background: `radial-gradient(600px 260px at 0% 0%, color-mix(in srgb, ${team?.color ?? "#333"} 45%, transparent), transparent 70%), radial-gradient(500px 240px at 100% 100%, color-mix(in srgb, ${color} 18%, transparent), transparent 70%), var(--color-surface)`,
        }}
      >
        {player.team && (
          // eslint-disable-next-line @next/next/no-img-element -- decorative CDN logo
          <img
            src={teamLogo(player.team)}
            alt=""
            className="pointer-events-none absolute -right-10 -top-10 size-64 opacity-[0.07]"
          />
        )}
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <PlayerAvatar id={player.id} position={player.position} team={player.team} name={player.name} size={96} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <PosBadge pos={player.position} />
              {value && (
                <span className="text-xs font-semibold text-muted">
                  {player.position}
                  {value.posRank} · #{value.overallRank} overall
                </span>
              )}
              <InjuryTag status={player.injuryStatus} />
            </div>
            <h1 className="mt-1 font-display text-4xl font-extrabold uppercase italic leading-none sm:text-5xl">
              {player.name}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {player.team && (
                <span className="flex items-center gap-1.5">
                  <TeamLogo team={player.team} size={16} /> {team ? `${team.city} ${team.name}` : player.team}
                </span>
              )}
              {player.age && <span>Age {player.age}</span>}
              {player.yearsExp !== null && player.position !== "DST" && (
                <span>{player.yearsExp === 0 ? "Rookie" : `${player.yearsExp} yr exp`}</span>
              )}
              {value?.byeWeek && <span>Bye wk {value.byeWeek}</span>}
              {player.injuryStatus && player.injuryBodyPart && (
                <span className="text-flame">
                  {player.injuryStatus} ({player.injuryBodyPart})
                </span>
              )}
            </p>
          </div>
          {value && tier && (
            <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1.5">
              <ValueBadge value={value.value} size="lg" />
              <div className="sm:text-right">
                <div className="text-xs font-bold uppercase tracking-widest text-muted">{tier.label} tier</div>
                <div className="text-xs text-muted" title="Linear 0–100 production score used to judge trade fairness">
                  Trade power <b className="text-ink">{value.power}</b>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted sm:justify-end">
                  vs last week <ChangePill change={value.change} />
                </div>
              </div>
            </div>
          )}
        </div>

        {value && (
          <div className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Points / game" value={value.ppg} sub={`${value.gamesPlayed} games`} />
            <Kpi label="Last 3 games" value={value.recentPpg ?? "–"} sub="per game" />
            <Kpi label="ROS projection" value={value.rosPpg} sub={`${value.rosPoints} pts left`} />
            <Kpi label="Best game" value={best?.actual ?? "–"} sub={best ? `Week ${best.week} ${best.opponent ?? ""}` : ""} />
          </div>
        )}
      </section>

      {!value && (
        <div className="card p-6 text-sm text-muted">
          {player.name} isn&apos;t on the trade value chart right now (not enough production or projected playing time).
        </div>
      )}

      {value && (
        <div className="grid gap-5 lg:grid-cols-5">
          <section className="card animate-rise p-5 [animation-delay:80ms] lg:col-span-3">
            <h2 className="font-display text-xl font-bold uppercase tracking-wide">Value trend</h2>
            <p className="mb-4 text-xs text-muted">Trade value after each week of the season</p>
            <ValueTrendChart values={value.trend} color={color} />
          </section>

          <section className="card animate-rise p-5 [animation-delay:140ms] lg:col-span-2">
            <h2 className="font-display text-xl font-bold uppercase tracking-wide">Value breakdown</h2>
            <p className="mb-4 text-xs text-muted">How each factor scores (0–100) and its weight</p>
            <ul className="space-y-3">
              {Object.entries(FACTOR_LABELS).map(([key, f]) => {
                const score = value.breakdown[key] ?? 0;
                return (
                  <li key={key} title={f.hint}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium">{f.label}</span>
                      <span className="text-muted tabular">
                        {Math.round(score * 100)} <span className="text-faint">· {Math.round(WEIGHTS[key as keyof typeof WEIGHTS] * 100)}%</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(2, score * 100)}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 55%, white))` }}
                      />
                    </div>
                  </li>
                );
              })}
              {value.breakdown.injury < 1 && (
                <li className="rounded-xl bg-down/10 px-3 py-2 text-xs text-down">
                  Injury discount: ×{value.breakdown.injury} ({player.injuryStatus})
                </li>
              )}
            </ul>
          </section>
        </div>
      )}

      <section className="card animate-rise p-5 [animation-delay:200ms]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold uppercase tracking-wide">Weekly points</h2>
            <p className="text-xs text-muted">Bars = actual, dashed line = Sleeper projection. Colored = beat projection.</p>
          </div>
        </div>
        <WeeklyPointsChart weeks={weeks.filter((w) => w.week <= Math.max(currentWeek + 3, 6))} color={color} />
      </section>

      <section className="card animate-rise overflow-hidden [animation-delay:260ms]">
        <h2 className="px-5 pt-5 font-display text-xl font-bold uppercase tracking-wide">Game log</h2>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-y border-line text-left text-[11px] uppercase tracking-wider text-faint">
                <th className="px-5 py-2 font-semibold">Wk</th>
                <th className="py-2 font-semibold">Opp</th>
                <th className="py-2 text-right font-semibold">Pts</th>
                <th className="py-2 text-right font-semibold">Proj</th>
                <th className="px-5 py-2 font-semibold">Line</th>
              </tr>
            </thead>
            <tbody>
              {weeks
                .filter((w) => w.week <= currentWeek)
                .reverse()
                .map((w) => {
                  const diff = w.actual !== null && w.projected !== null ? w.actual - w.projected : null;
                  return (
                    <tr key={w.week} className="border-b border-line last:border-0">
                      <td className="px-5 py-2.5 text-muted tabular">{w.week}</td>
                      <td className="py-2.5 text-muted">{w.opponent ?? "–"}</td>
                      <td className="py-2.5 text-right font-semibold tabular">{w.actual ?? "–"}</td>
                      <td className="py-2.5 text-right tabular">
                        <span className="text-muted">{w.projected ?? "–"}</span>
                        {diff !== null && (
                          <span className={`ml-1.5 text-xs ${diff >= 0 ? "text-up" : "text-down"}`}>
                            {diff >= 0 ? "+" : ""}
                            {diff.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-muted">{w.stats ? statLine(w.stats, player.position) : w.week === currentWeek ? "Yet to play" : w.opponent === "BYE" ? "Bye week" : "Did not play"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-bg/40 px-4 py-3 backdrop-blur">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</div>
      <div className="font-display text-3xl font-bold tabular">{value}</div>
      {sub && <div className="truncate text-xs text-muted">{sub}</div>}
    </div>
  );
}
