"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Search, X } from "lucide-react";
import { ChangePill, InjuryTag, PlayerAvatar, PosBadge, TeamLogo, ValueBadge } from "@/components/PlayerBits";
import { Sparkline } from "@/components/Charts";
import { useMyTeam } from "@/lib/myTeam";
import { valueTier } from "@/lib/tradeValue";
import { POS_COLOR, valueColor } from "@/lib/ui";
import { TEAM_CODES } from "@/lib/teams";
import { POSITIONS, type PlayerValue, type Position } from "@/lib/types";

const TIER_RANGE: Record<string, string> = { Elite: "93–100", Star: "85–92", Starter: "76–84", Flex: "65–75", Depth: "under 65" };

type SortKey = "value" | "change" | "ppg" | "recentPpg" | "rosPpg" | "age" | "name";

const COLUMNS: { key: SortKey; label: string; className: string; title?: string }[] = [
  { key: "value", label: "Value", className: "w-14 justify-center" },
  { key: "change", label: "Wk Δ", className: "w-12 justify-center", title: "Change since last week" },
  { key: "ppg", label: "PPG", className: "hidden w-14 justify-end md:flex", title: "Season points per game" },
  { key: "recentPpg", label: "Last 3", className: "hidden w-14 justify-end md:flex", title: "Points per game, last 3 weeks" },
  { key: "rosPpg", label: "ROS", className: "hidden w-14 justify-end lg:flex", title: "Projected points per game, rest of season" },
  { key: "age", label: "Age", className: "hidden w-10 justify-end xl:flex" },
];

export function ValuesTable({ players, initialPos }: { players: PlayerValue[]; initialPos: Position | "ALL" }) {
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<Position | "ALL">(initialPos);
  const [team, setTeam] = useState("ALL");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "value", dir: "desc" });
  const q = useDeferredValue(query.trim().toLowerCase());
  const [myTeam] = useMyTeam();
  const mine = useMemo(() => new Set(myTeam?.playerIds ?? []), [myTeam]);

  const rows = useMemo(() => {
    const filtered = players.filter(
      (p) =>
        (pos === "ALL" || p.position === pos) &&
        (team === "ALL" || p.team === team) &&
        (!q || p.name.toLowerCase().includes(q) || p.team?.toLowerCase() === q),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.key === "name") return a.name.localeCompare(b.name) * dir;
      const av = a[sort.key] ?? -Infinity;
      const bv = b[sort.key] ?? -Infinity;
      return ((av as number) - (bv as number)) * dir || b.value - a.value;
    });
  }, [players, pos, team, q, sort]);

  function choosePos(next: Position | "ALL") {
    setPos(next);
    const url = new URL(window.location.href);
    if (next === "ALL") url.searchParams.delete("pos");
    else url.searchParams.set("pos", next);
    window.history.replaceState(null, "", url);
  }

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "age" || key === "name" ? "asc" : "desc" },
    );
  }

  return (
    <div className="animate-rise [animation-delay:80ms]">
      {/* Controls */}
      <div className="sticky top-[57px] z-20 -mx-4 mb-3 space-y-3 bg-bg/85 px-4 pb-3 pt-1 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10 lg:pt-3">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players…"
              className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-9 text-sm outline-none transition placeholder:text-faint focus:border-rocket/50 focus:ring-4 focus:ring-rocket/10"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-faint hover:text-ink"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </label>
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="h-11 w-[5.5rem] rounded-xl border border-line bg-surface px-2.5 text-sm outline-none focus:border-rocket/50 sm:w-32"
            aria-label="Filter by team"
          >
            <option value="ALL">Teams</option>
            {TEAM_CODES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {(["ALL", ...POSITIONS] as const).map((p) => {
            const active = pos === p;
            const color = p === "ALL" ? "var(--color-rocket)" : POS_COLOR[p];
            return (
              <button
                key={p}
                onClick={() => choosePos(p)}
                className={clsx(
                  "relative h-8 shrink-0 rounded-full px-4 text-xs font-bold tracking-wide transition-colors",
                  active ? "text-bg" : "bg-surface text-muted ring-1 ring-line hover:text-ink",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="pos-chip"
                    className="absolute inset-0 rounded-full"
                    style={{ background: color }}
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative">{p === "ALL" ? "All" : p}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint sm:px-4">
          <span className="w-7 text-center">#</span>
          <SortButton label="Player" active={sort.key === "name"} dir={sort.dir} onClick={() => toggleSort("name")} className="flex-1" />
          <span className="hidden w-[72px] sm:block">Trend</span>
          {COLUMNS.map((c) => (
            <SortButton
              key={c.key}
              label={c.label}
              title={c.title}
              active={sort.key === c.key}
              dir={sort.dir}
              onClick={() => toggleSort(c.key)}
              className={c.className}
            />
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-muted">No players match those filters.</div>
        ) : (
          <ul>
            {rows.map((p, i) => {
              const tier = valueTier(p.value);
              const showTier = sort.key === "value" && sort.dir === "desc" && (i === 0 || valueTier(rows[i - 1].value).label !== tier.label);
              return (
              <li key={p.id} className="border-b border-line last:border-0">
                {showTier && (
                  <div className="flex items-center gap-2 border-b border-line bg-white/[0.02] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] sm:px-4" style={{ color: valueColor(p.value) }}>
                    <span className="size-1.5 rounded-full" style={{ background: valueColor(p.value) }} />
                    {tier.label}
                    <span className="font-semibold text-faint">{TIER_RANGE[tier.label]}</span>
                  </div>
                )}
                <Link
                  href={`/players/${p.id}`}
                  className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.025] sm:px-4"
                  style={i < 24 ? { animation: `rise .45s cubic-bezier(.2,.8,.2,1) ${i * 18}ms both` } : undefined}
                >
                  <span className="w-7 text-center font-display text-base font-semibold text-faint tabular">
                    {sort.key === "value" && sort.dir === "desc" ? (pos === "ALL" ? p.overallRank : p.posRank) : i + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={38} />
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold group-hover:text-white">{p.name}</span>
                        <InjuryTag status={p.injuryStatus} />
                        {mine.has(p.id) && <span className="rounded bg-rocket/15 px-1 py-px text-[9px] font-bold uppercase text-rocket">Mine</span>}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
                        <PosBadge pos={p.position} />
                        <span className="hidden font-medium text-faint sm:inline">
                          {p.position}
                          {p.posRank}
                        </span>
                        {p.team && (
                          <>
                            <span className="hidden sm:inline-flex">
                              <TeamLogo team={p.team} size={14} />
                            </span>
                            <span>{p.team}</span>
                          </>
                        )}
                        <span className="text-faint md:hidden">· {p.ppg} ppg</span>
                        {p.byeWeek && <span className="hidden text-faint xl:inline">· Bye {p.byeWeek}</span>}
                      </span>
                    </span>
                  </span>
                  <span className="hidden w-[72px] sm:block">
                    <Sparkline values={p.trend} color={POS_COLOR[p.position]} />
                  </span>
                  <span className="flex w-14 justify-center">
                    <ValueBadge value={p.value} />
                  </span>
                  <span className="flex w-12 justify-center">
                    <ChangePill change={p.change} />
                  </span>
                  <Stat className="hidden md:flex" value={p.ppg} />
                  <Stat className="hidden md:flex" value={p.recentPpg} compare={p.ppg} />
                  <Stat className="hidden lg:flex" value={p.rosPpg} />
                  <span className="hidden w-10 justify-end text-sm text-muted tabular xl:flex">{p.age ?? "–"}</span>
                </Link>
              </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-3 text-xs text-faint">
        Showing {rows.length} of {players.length} players. Tap a player for their value trend and game log.
      </p>
    </div>
  );
}

function SortButton({
  label,
  title,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  title?: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={clsx("flex items-center gap-0.5 uppercase transition-colors hover:text-ink", active && "text-ink", className)}
    >
      {label}
      {active && (dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
    </button>
  );
}

function Stat({ value, compare, className }: { value: number | null; compare?: number; className?: string }) {
  const hot = compare !== undefined && value !== null && value > compare * 1.15;
  const cold = compare !== undefined && value !== null && value < compare * 0.85;
  return (
    <span
      className={clsx(
        "w-14 justify-end text-sm tabular",
        hot ? "text-up" : cold ? "text-down" : "text-ink/80",
        className,
      )}
    >
      {value ?? "–"}
    </span>
  );
}
