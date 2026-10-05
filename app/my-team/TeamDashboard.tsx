"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import clsx from "clsx";
import { AlertTriangle, Crown, Loader2, RefreshCw, ShieldAlert, Trash2, TrendingUp } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { PlayerSearch } from "@/components/PlayerSearch";
import { InjuryTag, PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import { setScoringCookie } from "@/components/ScoringToggle";
import type { SavedTeam } from "@/lib/myTeam";
import { SLOT_LABEL, analyzeTeam, bestLineup, gradeColor, type LineupSlot } from "@/lib/teamAnalysis";
import { POS_COLOR } from "@/lib/ui";
import { SCORINGS, type PlayerValue, type Position, type Scoring } from "@/lib/types";
import { Avatar } from "./TeamSetup";
import { LeagueError, refetchLeague, teamFromLeague } from "./leagueClient";
import { GamePlan } from "./GamePlan";
import { TradeFinder, type FinderMode } from "./TradeFinder";
import { PlayerSheet, type PlayerWeek } from "./PlayerSheet";

const PROVIDER_LABEL: Record<string, string> = { sleeper: "Sleeper", espn: "ESPN", yahoo: "Yahoo" };

export function TeamDashboard({
  team,
  players,
  scoring,
  onChange,
  finderPreset,
}: {
  team: SavedTeam;
  players: PlayerValue[];
  scoring: Scoring;
  onChange: (t: SavedTeam | null) => void;
  /** open the trade finder pre-filled (from a player card or a player page link) */
  finderPreset?: { mode: FinderMode; ids: string[] } | null;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [preset, setPreset] = useState<{ mode: FinderMode; ids: string[]; nonce: number } | null>(finderPreset ? { ...finderPreset, nonce: 1 } : null);

  // This week's points for everyone on the roster (actual once games start, projected before).
  const idsKey = team.playerIds.join(",");
  const [weekData, setWeekData] = useState<{ key: string; week: number | null; points: Record<string, PlayerWeek> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const key = `${idsKey}|${scoring}`;
    fetch(`/api/week-points?ids=${idsKey}&scoring=${scoring}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setWeekData({ key, week: d.week, points: d.points ?? {} }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [idsKey, scoring]);
  const pointsOf = (id: string) => weekData?.points[id];
  const scoreOf = (id: string) => {
    const w = pointsOf(id);
    return w ? (w.actual ?? w.projected ?? 0) : 0;
  };

  useEffect(() => {
    if (finderPreset) document.getElementById("trade-finder")?.scrollIntoView({ behavior: "smooth" });
  }, [finderPreset]);

  function tradeAway(id: string) {
    setSheetId(null);
    setPreset({ mode: "away", ids: [id], nonce: Date.now() });
    setTimeout(() => document.getElementById("trade-finder")?.scrollIntoView({ behavior: "smooth" }), 50);
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
    onChange({ ...team, name: t.teamName, avatar: t.avatar, playerIds: t.players, league: { ...l, myRosterId: rosterId } });
  }

  function setPlayers(ids: string[]) {
    onChange({ ...team, playerIds: ids });
  }

  const record = team.league?.teams.find((t) => t.rosterId === team.league!.myRosterId);

  // Starting lineup vs bench: the league's lineup when imported, your own picks for other teams,
  // otherwise the best lineup by value.
  const leagueStarters = record?.starters?.length ? record.starters : null;
  const chosenStarters = leagueStarters ?? team.starters ?? null;
  const canEditLineup = !leagueStarters;
  let starterSlots: LineupSlot[] = analysis.lineup.starters;
  let benchList: PlayerValue[] = analysis.lineup.bench;
  if (chosenStarters) {
    const chosen = new Set(chosenStarters);
    const fit = bestLineup(roster.filter((p) => chosen.has(p.id)), team.rosterPositions);
    starterSlots = fit.starters;
    benchList = [...roster.filter((p) => !chosen.has(p.id)), ...fit.bench].sort((a, b) => b.value - a.value);
  }
  const lineupNote = leagueStarters
    ? `As set in your ${PROVIDER_LABEL[team.source] ?? ""} league. Sync to refresh.`
    : team.starters
      ? "Your lineup. Tap Bench or Start to change it."
      : "Best lineup by value. Tap Bench or Start to set your own.";
  const currentStarterIds = starterSlots.map((s) => s.player?.id).filter((id): id is string => !!id);
  const moveToBench = (id: string) => onChange({ ...team, starters: currentStarterIds.filter((x) => x !== id) });
  const moveToStart = (id: string) => onChange({ ...team, starters: [...currentStarterIds, id] });

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex animate-rise flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar src={team.avatar ?? team.league?.avatar ?? null} label={team.name} size={60} />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rocket">
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
        <div className="flex flex-wrap items-center gap-2">
          {team.league && (
            <>
              <select
                value={team.league.myRosterId}
                onChange={(e) => switchRoster(Number(e.target.value))}
                className="h-9 max-w-44 rounded-full border border-line bg-surface px-3 text-xs font-medium outline-none"
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
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-muted transition hover:text-ink"
              >
                {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Sync
              </button>
            </>
          )}
          <button
            onClick={() => {
              if (confirm("Remove this team from Fantasy Trade Index? (Your league itself is not affected.)")) onChange(null);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-muted transition hover:border-down/40 hover:text-down"
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

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total team value" delay={60} accent>
          <CountUp value={analysis.total} />
        </Kpi>
        <Kpi label="Starting lineup value" delay={100}>
          <CountUp value={analysis.starterTotal} />
        </Kpi>
        {team.league ? (
          <Kpi label="League power rank" delay={140}>
            #{myRank}
            <span className="ml-1 text-base text-faint">/ {power.length}</span>
          </Kpi>
        ) : (
          <Kpi label="Players" delay={140}>
            {team.playerIds.length}
          </Kpi>
        )}
        <Kpi label="Avg value / player" delay={180}>
          {roster.length ? Math.round(analysis.total / roster.length) : 0}
        </Kpi>
      </div>

      <GamePlan team={team} players={players} scoring={scoring} />

      <TradeFinder
        key={preset?.nonce ?? 0}
        team={team}
        players={players}
        initialMode={preset?.mode}
        initialAway={preset?.mode === "away" ? preset.ids : []}
        initialWant={preset?.mode === "for" ? preset.ids : []}
      />

      <PlayerSheet
        player={sheetId ? (board.get(sheetId) ?? null) : null}
        week={sheetId ? pointsOf(sheetId) : undefined}
        weekNumber={weekData?.week ?? null}
        onClose={() => setSheetId(null)}
        onTradeAway={tradeAway}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-5">
        {/* Position strength */}
        <section className="card animate-rise p-5 [animation-delay:200ms] lg:col-span-3">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">Position strength</h2>
          <p className="mb-4 text-xs text-muted">Your starters vs. an average starter in a {teamsInLeague}-team league</p>
          <ul className="space-y-3.5">
            {analysis.strengths.map((s, i) => (
              <li key={s.position} className="flex items-center gap-3">
                <PosBadge pos={s.position} className="w-11" />
                <div className="flex-1">
                  <div className="relative h-3 overflow-hidden rounded-full bg-white/5">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-white/25" title="League average" />
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${POS_COLOR[s.position]}, color-mix(in srgb, ${POS_COLOR[s.position]} 50%, white))` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (s.ratio / 2) * 100)}%` }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-faint">
                    <span>
                      {s.mine} value in {s.slots} slot{s.slots > 1 ? "s" : ""}
                      {s.depth > 0 && ` · +${s.depth} depth`}
                    </span>
                    <span>{Math.round(s.ratio * 100)}% of avg</span>
                  </div>
                </div>
                <span
                  className="grid size-10 place-items-center rounded-xl font-display text-xl font-bold"
                  style={{ color: gradeColor(s.grade), background: `color-mix(in srgb, ${gradeColor(s.grade)} 14%, transparent)` }}
                >
                  {s.grade}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
          {analysis.strongest && (
            <Callout
              tone="up"
              icon={<TrendingUp className="size-5" />}
              title={`Strongest: ${analysis.strongest.position}`}
              grade={analysis.strongest.grade}
              text={`Your ${analysis.strongest.position} group is ${Math.round(analysis.strongest.ratio * 100)}% of a league-average starter. That's a surplus you can trade from.`}
            />
          )}
          {analysis.weakest && (
            <Callout
              tone="down"
              icon={<ShieldAlert className="size-5" />}
              title={`Weakest: ${analysis.weakest.position}`}
              grade={analysis.weakest.grade}
              text={`Your ${analysis.weakest.position} spot is only ${Math.round(analysis.weakest.ratio * 100)}% of average. Target an upgrade here.`}
              link={{ href: `/values?pos=${analysis.weakest.position}`, label: `Browse ${analysis.weakest.position}s` }}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
        {/* Starters */}
        <section className="card animate-rise p-5 [animation-delay:260ms]">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-bold uppercase tracking-wide">Starting lineup</h2>
            <PointsTotal ids={currentStarterIds} scoreOf={scoreOf} points={weekData?.points} week={weekData?.week ?? null} />
          </div>
          <p className="mb-3 text-xs text-muted">{lineupNote}</p>
          <ul className="space-y-1.5">
            {starterSlots.map((s, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
                <span className="w-10 text-center text-[11px] font-bold text-faint">{SLOT_LABEL[s.slot] ?? s.slot}</span>
                {s.player ? (
                  <RosterRow
                    p={s.player}
                    week={pointsOf(s.player.id)}
                    onOpen={() => setSheetId(s.player!.id)}
                    move={canEditLineup ? { label: "Bench", onClick: () => moveToBench(s.player!.id) } : undefined}
                    onRemove={team.source === "manual" ? () => setPlayers(team.playerIds.filter((id) => id !== s.player!.id)) : undefined}
                  />
                ) : (
                  <span className="flex-1 py-1.5 text-sm text-faint">Empty slot</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="card animate-rise p-5 [animation-delay:300ms]">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-bold uppercase tracking-wide">Bench</h2>
            <PointsTotal ids={benchList.map((p) => p.id)} scoreOf={scoreOf} points={weekData?.points} week={weekData?.week ?? null} muted />
          </div>
          {team.source === "manual" && (
            <div className="mb-3">
              <PlayerSearch players={players} exclude={team.playerIds} onSelect={(p) => setPlayers([...team.playerIds, p.id])} />
            </div>
          )}
          <ul className="space-y-1.5">
            {benchList.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-1.5">
                <RosterRow
                  p={p}
                  week={pointsOf(p.id)}
                  onOpen={() => setSheetId(p.id)}
                  move={canEditLineup ? { label: "Start", onClick: () => moveToStart(p.id) } : undefined}
                  onRemove={team.source === "manual" ? () => setPlayers(team.playerIds.filter((id) => id !== p.id)) : undefined}
                />
              </li>
            ))}
            {offChart.map((id) => {
              const d = team.directory[id];
              return (
                <li key={id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-1.5 text-sm text-muted">
                  <span className="truncate">
                    {d?.name ?? `Player ${id}`} <span className="text-xs text-faint">{d ? `${d.position} · ${d.team ?? "FA"}` : ""}</span>
                  </span>
                  <span className="text-xs text-faint">off chart</span>
                </li>
              );
            })}
            {benchList.length === 0 && offChart.length === 0 && <li className="py-4 text-center text-sm text-faint">No bench players.</li>}
          </ul>
        </section>
      </div>

      {power.length > 0 && (
        <section className="card animate-rise p-5 [animation-delay:340ms]">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">League power rankings</h2>
          <p className="mb-4 text-xs text-muted">Ranked by starting lineup trade value</p>
          <ol className="space-y-1.5">
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

function Kpi({ label, children, delay, accent }: { label: string; children: React.ReactNode; delay: number; accent?: boolean }) {
  return (
    <div
      className={clsx("card animate-rise px-4 py-4", accent && "border-rocket/30 bg-gradient-to-br from-rocket/15 to-transparent")}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</div>
      <div className={clsx("mt-1 font-display text-4xl font-bold tabular", accent && "text-gradient")}>{children}</div>
    </div>
  );
}

function Callout({
  tone,
  icon,
  title,
  grade,
  text,
  link,
}: {
  tone: "up" | "down";
  icon: React.ReactNode;
  title: string;
  grade: string;
  text: string;
  link?: { href: string; label: string };
}) {
  return (
    <section
      className={clsx(
        "card animate-rise p-5 [animation-delay:240ms]",
        tone === "up" ? "border-up/25 bg-gradient-to-br from-up/10 to-transparent" : "border-down/25 bg-gradient-to-br from-down/10 to-transparent",
      )}
    >
      <div className={clsx("mb-2 flex items-center justify-between", tone === "up" ? "text-up" : "text-down")}>
        <span className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
          {icon}
          {title}
        </span>
        <span className="font-display text-3xl font-extrabold">{grade}</span>
      </div>
      <p className="text-sm text-muted">{text}</p>
      {link && (
        <Link href={link.href} className="mt-3 inline-block text-xs font-semibold text-ink underline decoration-white/30 underline-offset-4 hover:decoration-white">
          {link.label} →
        </Link>
      )}
    </section>
  );
}

function RosterRow({
  p,
  onRemove,
  move,
  week,
  onOpen,
}: {
  p: PlayerValue;
  onRemove?: () => void;
  move?: { label: string; onClick: () => void };
  week?: PlayerWeek;
  onOpen?: () => void;
}) {
  const body = (
    <>
      <PlayerAvatar id={p.id} position={p.position as Position} team={p.team} name={p.name} size={32} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{p.name}</span>
          <InjuryTag status={p.injuryStatus} />
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
          <PosBadge pos={p.position} /> {p.team}
          {week?.opponent && <span className="text-faint">{week.opponent}</span>}
        </span>
      </span>
      {week && (
        <span className="w-14 shrink-0 text-right">
          {week.state === "bye" ? (
            <span className="text-xs font-bold text-down">BYE</span>
          ) : week.actual != null ? (
            <>
              <span className="block font-display text-lg font-bold leading-none tabular">{week.actual}</span>
              <span className={clsx("text-[10px]", week.state === "live" ? "text-down" : "text-faint")}>{week.state === "live" ? "● live" : `proj ${week.projected ?? "–"}`}</span>
            </>
          ) : (
            <>
              <span className="block font-display text-lg font-bold leading-none text-muted tabular">{week.projected ?? "–"}</span>
              <span className="text-[10px] text-faint">proj</span>
            </>
          )}
        </span>
      )}
    </>
  );
  return (
    <>
      {onOpen ? (
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {body}
        </button>
      ) : (
        <Link href={`/players/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          {body}
        </Link>
      )}
      <ValueBadge value={p.value} size="sm" />
      {move && (
        <button
          onClick={move.onClick}
          className="rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-muted transition hover:border-line-strong hover:text-ink"
        >
          {move.label}
        </button>
      )}
      {onRemove && (
        <button onClick={onRemove} className="rounded-lg p-1.5 text-faint transition hover:bg-down/10 hover:text-down" aria-label={`Remove ${p.name}`}>
          <Trash2 className="size-4" />
        </button>
      )}
    </>
  );
}

/** "112.4 pts · 98.1 so far" header total for a group of players. */
function PointsTotal({
  ids,
  scoreOf,
  points,
  week,
  muted,
}: {
  ids: string[];
  scoreOf: (id: string) => number;
  points?: Record<string, PlayerWeek>;
  week: number | null;
  muted?: boolean;
}) {
  if (!points) return <span className="text-xs text-faint">{ids.length} players</span>;
  const total = Math.round(ids.reduce((s, id) => s + scoreOf(id), 0) * 10) / 10;
  const anyStarted = ids.some((id) => points[id]?.actual != null);
  return (
    <span className="text-right">
      <span className={clsx("font-display text-xl font-bold tabular", muted ? "text-muted" : "text-gradient")}>{total}</span>
      <span className="ml-1 text-[11px] text-faint">
        pts {anyStarted ? "(actual + proj)" : "proj"}
        {week ? ` · wk ${week}` : ""}
      </span>
    </span>
  );
}
