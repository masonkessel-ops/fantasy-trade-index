"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import clsx from "clsx";
import { AlertTriangle, Crown, Loader2, RefreshCw, ShieldAlert, Trash2, TrendingUp } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { PosBadge } from "@/components/PlayerBits";
import { setScoringCookie } from "@/components/ScoringToggle";
import type { SavedTeam } from "@/lib/myTeam";
import { analyzeTeam, gradeColor, type PositionStrength } from "@/lib/teamAnalysis";
import { POS_COLOR } from "@/lib/ui";
import { SCORINGS, type PlayerValue, type Scoring } from "@/lib/types";
import { Avatar } from "./TeamSetup";
import { LeagueError, refetchLeague, teamFromLeague } from "./leagueClient";
import { GamePlan } from "./GamePlan";
import { Lineup } from "./Lineup";
import { PlayerSheet, type PlayerWeek } from "./PlayerSheet";

const PROVIDER_LABEL: Record<string, string> = { sleeper: "Sleeper", espn: "ESPN", yahoo: "Yahoo" };

export function TeamDashboard({
  team,
  players,
  scoring,
  onChange,
}: {
  team: SavedTeam;
  players: PlayerValue[];
  scoring: Scoring;
  onChange: (t: SavedTeam | null) => void;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);

  // This week's points for everyone on the roster (actual once games start, projected before).
  const idsKey = team.playerIds.join(",");
  const [weekData, setWeekData] = useState<{
    key: string;
    week: number | null;
    points: Record<string, PlayerWeek>;
    plan: { week: number; points: Record<string, PlayerWeek> } | null;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const key = `${idsKey}|${scoring}`;
    fetch(`/api/week-points?ids=${idsKey}&scoring=${scoring}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setWeekData({ key, week: d.week, points: d.points ?? {}, plan: d.plan ?? null }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [idsKey, scoring]);
  const pointsOf = (id: string) => weekData?.points[id];

  function tradeAway(id: string) {
    setSheetId(null);
    router.push(`/trade-finder?away=${id}`);
  }
  const board = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const roster = team.playerIds.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p);
  const offChart = team.playerIds.filter((id) => !board.has(id));
  const teamsInLeague = team.league?.totalRosters ?? 12;
  const analysis = analyzeTeam(roster, players, team.rosterPositions, teamsInLeague);

  const power = useMemo(() => {
    if (!team.league) return [];
    return team.league.teams
      .map((t) => {
        const r = t.players.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p);
        const a = analyzeTeam(r, players, team.rosterPositions, teamsInLeague);
        return { team: t, total: a.total, starters: a.starterTotal };
      })
      .sort((a, b) => b.starters - a.starters);
  }, [team, board, players, teamsInLeague]);
  const myRank = power.findIndex((p) => p.team.rosterId === team.league?.myRosterId) + 1;

  const scoringLabel = (s: Scoring) => SCORINGS.find((x) => x.id === s)!.label;
  const mismatch = team.source !== "manual" && team.scoring !== scoring;

  async function refresh() {
    if (!team.league) return;
    setRefreshing(true);
    setError(null);
    try {
      const data = await refetchLeague(team);
      onChange(teamFromLeague(data, team.league.myRosterId, team.league.username));
    } catch (e) {
      if (e instanceof LeagueError && e.needsCookies) setError("This is a private ESPN league. To refresh it, click Reset and import it again with your ESPN cookies.");
      else if (e instanceof LeagueError && e.signedOut) setError("Your Yahoo sign-in expired. Click Reset, then sign in with Yahoo again.");
      else setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  function switchRoster(rosterId: number) {
    const l = team.league!;
    const t = l.teams.find((x) => x.rosterId === rosterId)!;
    onChange({ ...team, name: t.teamName, avatar: t.avatar, playerIds: t.players, starters: undefined, league: { ...l, myRosterId: rosterId } });
  }

  const record = team.league?.teams.find((t) => t.rosterId === team.league!.myRosterId);
  const starterValues = analysis.lineup.starters.filter((s) => s.player).map((s) => s.player!.value);
  const avgStarter = starterValues.length ? Math.round(starterValues.reduce((a, b) => a + b, 0) / starterValues.length) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex animate-rise flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar src={team.avatar ?? team.league?.avatar ?? null} label={team.name} size={56} />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-rocket">
              {team.league ? `${PROVIDER_LABEL[team.source] ?? ""} · ${team.league.name}` : "Custom roster"} · {scoringLabel(team.scoring)}
            </p>
            <h1 className="truncate font-display text-4xl font-extrabold uppercase italic leading-none sm:text-5xl">{team.name}</h1>
            {record && (
              <p className="mt-1 text-sm text-muted">
                {record.wins}-{record.losses}
                {record.ties ? `-${record.ties}` : ""} · {record.pointsFor.toFixed(1)} PF
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {team.league && (
            <>
              <select
                value={team.league.myRosterId}
                onChange={(e) => switchRoster(Number(e.target.value))}
                className="h-9 min-w-0 flex-1 rounded-full border border-line bg-surface px-3 text-xs font-medium outline-none sm:max-w-44 sm:flex-none"
                aria-label="Switch team"
              >
                {team.league.teams.map((t) => (
                  <option key={t.rosterId} value={t.rosterId}>
                    {t.teamName}
                  </option>
                ))}
              </select>
              <button
                onClick={refresh}
                disabled={refreshing}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-muted transition hover:text-ink"
              >
                {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Sync
              </button>
            </>
          )}
          <button
            onClick={() => {
              if (confirm("Remove this team from Fantasy Trade Index? (Your league itself is not affected.)")) onChange(null);
            }}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-muted transition hover:border-down/40 hover:text-down"
          >
            <Trash2 className="size-3.5" /> Reset
          </button>
        </div>
      </header>

      {error && <p className="rounded-xl bg-down/10 px-3 py-2 text-sm text-down">{error}</p>}

      {mismatch && (
        <div className="flex animate-rise flex-col gap-3 rounded-2xl border border-flame/30 bg-flame/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 text-flame">
            <AlertTriangle className="size-4 shrink-0" />
            Your league uses {scoringLabel(team.scoring)} scoring, but values are showing {scoringLabel(scoring)}.
          </span>
          <button
            onClick={() => {
              setScoringCookie(team.scoring);
              router.refresh();
            }}
            className="rounded-full bg-flame px-4 py-1.5 text-xs font-bold text-bg"
          >
            Use {scoringLabel(team.scoring)}
          </button>
        </div>
      )}

      {/* Stat strip */}
      <div className="card grid animate-rise grid-cols-2 divide-line [animation-delay:60ms] sm:grid-cols-4 sm:divide-x">
        <Stat label="Team value" accent>
          <CountUp value={analysis.total} />
        </Stat>
        <Stat label="Avg starter">{avgStarter}</Stat>
        {team.league ? (
          <Stat label="Power rank">
            #{myRank}
            <span className="ml-1 text-base text-faint">/ {power.length}</span>
          </Stat>
        ) : (
          <Stat label="Players">{team.playerIds.length}</Stat>
        )}
        <Stat label="Weakest spot">
          {analysis.weakest ? (
            <span className="flex items-baseline gap-2">
              {analysis.weakest.position}
              <span className="text-xl" style={{ color: gradeColor(analysis.weakest.grade) }}>
                {analysis.weakest.grade}
              </span>
            </span>
          ) : (
            "–"
          )}
        </Stat>
      </div>

      <Lineup
        team={team}
        roster={roster}
        players={players}
        offChart={offChart}
        points={weekData?.points}
        week={weekData?.week ?? null}
        plan={weekData?.plan ?? null}
        onChange={onChange}
        onOpen={setSheetId}
      />

      <PlayerSheet
        player={sheetId ? (board.get(sheetId) ?? null) : null}
        week={sheetId ? pointsOf(sheetId) : undefined}
        weekNumber={weekData?.week ?? null}
        onClose={() => setSheetId(null)}
        onTradeAway={tradeAway}
        onRemove={
          team.source === "manual"
            ? (id) => {
                setSheetId(null);
                onChange({ ...team, playerIds: team.playerIds.filter((x) => x !== id), starters: team.starters?.filter((x) => x !== id) });
              }
            : undefined
        }
      />

      <GamePlan team={team} players={players} scoring={scoring} />

      <TeamBreakdown strengths={analysis.strengths} strongest={analysis.strongest} weakest={analysis.weakest} teams={teamsInLeague} />

      {power.length > 0 && (
        <section className="card animate-rise p-5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">League power rankings</h2>
          <p className="mb-4 text-xs text-muted">Ranked by starting lineup trade value</p>
          <ol className="grid grid-cols-[minmax(0,1fr)] gap-1.5 lg:grid-cols-2 lg:gap-x-4">
            {power.map((p, i) => {
              const mine = p.team.rosterId === team.league!.myRosterId;
              const max = power[0].starters || 1;
              return (
                <li
                  key={p.team.rosterId}
                  className={clsx("relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2", mine ? "bg-rocket/10 ring-1 ring-rocket/30" : "bg-surface-2")}
                >
                  <motion.span
                    className="absolute inset-y-0 left-0 bg-white/[0.035]"
                    initial={{ width: 0 }}
                    animate={{ width: `${(p.starters / max) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.3 + i * 0.03 }}
                  />
                  <span className="relative w-6 text-center font-display text-lg font-bold text-faint">
                    {i === 0 ? <Crown className="mx-auto size-4 text-flame" /> : i + 1}
                  </span>
                  <Avatar src={p.team.avatar} label={p.team.teamName} size={30} />
                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.team.teamName}</span>
                    <span className="text-xs text-muted">
                      {p.team.wins}-{p.team.losses} · {p.total} total value
                    </span>
                  </span>
                  <span className="relative font-display text-xl font-bold tabular">{p.starters}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

function Stat({ label, children, accent }: { label: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className="px-4 py-3.5 sm:px-5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</div>
      <div className={clsx("mt-0.5 font-display text-3xl font-bold leading-tight tabular", accent && "text-gradient")}>{children}</div>
    </div>
  );
}

/** Grade per position in one row, plus the strongest/weakest takeaway. */
function TeamBreakdown({
  strengths,
  strongest,
  weakest,
  teams,
}: {
  strengths: PositionStrength[];
  strongest: PositionStrength | null;
  weakest: PositionStrength | null;
  teams: number;
}) {
  return (
    <section className="card animate-rise p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">Team breakdown</h2>
          <p className="text-xs text-muted">Your starters vs. an average starter in a {teams}-team league. Tap a position to browse players.</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {strengths.map((s, i) => (
          <Link
            key={s.position}
            href={`/values?pos=${s.position}`}
            className="group rounded-2xl border border-line bg-surface-2 p-3 text-center transition hover:border-line-strong"
          >
            <PosBadge pos={s.position} />
            <div className="mt-1.5 font-display text-3xl font-extrabold leading-none" style={{ color: gradeColor(s.grade) }}>
              {s.grade}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: POS_COLOR[s.position] }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (s.ratio / 2) * 100)}%` }}
                transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </div>
            <div className="mt-1 text-[10px] text-faint tabular">{Math.round(s.ratio * 100)}% of avg</div>
          </Link>
        ))}
      </div>
      {(strongest || weakest) && (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2 text-sm sm:grid-cols-2">
          {strongest && (
            <p className="flex items-start gap-2 rounded-xl bg-up/[0.07] px-3 py-2.5 text-muted">
              <TrendingUp className="mt-0.5 size-4 shrink-0 text-up" />
              <span>
                <b className="text-ink">{strongest.position} is your strength</b> ({Math.round(strongest.ratio * 100)}% of average). That&apos;s depth you can trade from.
              </span>
            </p>
          )}
          {weakest && weakest !== strongest && (
            <p className="flex items-start gap-2 rounded-xl bg-down/[0.07] px-3 py-2.5 text-muted">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-down" />
              <span>
                <b className="text-ink">Upgrade {weakest.position}</b> ({Math.round(weakest.ratio * 100)}% of average).{" "}
                <Link href="/trade-finder" className="font-semibold text-rocket hover:underline">
                  Find a trade
                </Link>
              </span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
