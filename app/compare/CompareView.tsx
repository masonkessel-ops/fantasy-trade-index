"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowLeftRight, X } from "lucide-react";
import { InjuryTag, PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import { PlayerSearch } from "@/components/PlayerSearch";
import { playerRisk } from "@/lib/risk";
import { valueTier } from "@/lib/tradeValue";
import { valueColor } from "@/lib/ui";
import type { PlayerValue } from "@/lib/types";

/** One color per compared player (for the chart and headers). */
const SERIES = ["#60a5fa", "#facc15", "#f472b6"];

type Row = { label: string; get: (p: PlayerValue) => number | null; fmt?: (n: number, p: PlayerValue) => string; lowerIsBetter?: boolean; hint?: string };
const ROWS: Row[] = [
  { label: "Trade value", get: (p) => p.value },
  { label: "Trade weight", get: (p) => Math.round(p.power), hint: "What the market pays: stars count for far more than their 1–100 value suggests" },
  { label: "Overall rank", get: (p) => p.overallRank, fmt: (n) => `#${n}`, lowerIsBetter: true },
  { label: "Position rank", get: (p) => p.posRank, fmt: (n, p) => `${p.position}${n}`, lowerIsBetter: true },
  { label: "Market rank", get: (p) => p.marketRank, fmt: (n) => `#${n}`, lowerIsBetter: true },
  { label: "Season PPG", get: (p) => p.ppg },
  { label: "Last 3 PPG", get: (p) => p.recentPpg },
  { label: "Rest-of-season PPG", get: (p) => p.rosPpg },
  { label: "Value change (wk)", get: (p) => p.change, fmt: (n) => (n > 0 ? `+${n}` : String(n)) },
  { label: "Age", get: (p) => p.age, lowerIsBetter: true },
  { label: "Risk", get: (p) => playerRisk(p).score, fmt: (n) => (n < 0.2 ? "Low" : n < 0.45 ? "Medium" : "High"), lowerIsBetter: true },
];

export function CompareView({ players, initialIds }: { players: PlayerValue[]; initialIds: string[] }) {
  const board = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const [ids, setIds] = useState(initialIds.filter((id) => board.has(id)));
  const ps = ids.map((id) => board.get(id)!).filter(Boolean);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (ids.length) url.searchParams.set("ids", ids.join(","));
    else url.searchParams.delete("ids");
    window.history.replaceState(null, "", url);
  }, [ids]);

  const cols = `minmax(5.5rem,1fr) repeat(${Math.max(1, ps.length)}, minmax(0,1fr))`;

  return (
    <div className="space-y-5">
      {ps.length < 3 && (
        <div className="max-w-md">
          <PlayerSearch players={players} exclude={ids} onSelect={(p) => setIds((x) => [...x, p.id].slice(0, 3))} placeholder={ps.length ? "Add another player…" : "Search a player to compare…"} />
        </div>
      )}

      {ps.length === 0 ? (
        <div className="card px-6 py-14 text-center text-sm text-muted">Search for two or three players to compare them side by side.</div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
              <span />
              {ps.map((p, i) => (
                <div key={p.id} className="relative flex min-w-0 flex-col items-center gap-1.5 px-1 py-4 text-center sm:px-2">
                  <button onClick={() => setIds((x) => x.filter((id) => id !== p.id))} aria-label={`Remove ${p.name}`} className="absolute right-2 top-2 rounded-full p-1 text-faint hover:bg-white/5 hover:text-ink">
                    <X className="size-4" />
                  </button>
                  <span className="rounded-full p-[3px]" style={{ background: SERIES[i] }}>
                    <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={56} />
                  </span>
                  <Link href={`/players/${p.id}`} className="line-clamp-2 w-full text-sm font-semibold leading-tight hover:underline">
                    {p.name}
                  </Link>
                  <span className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted">
                    <PosBadge pos={p.position} /> {p.team ?? "FA"} <InjuryTag status={p.injuryStatus} />
                  </span>
                  <ValueBadge value={p.value} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: valueColor(p.value) }}>
                    {valueTier(p.value).label}
                  </span>
                </div>
              ))}
            </div>
            {ROWS.map((r) => {
              const vals = ps.map(r.get);
              const nums = vals.filter((v): v is number => v !== null);
              const best = nums.length > 1 && new Set(nums).size > 1 ? (r.lowerIsBetter ? Math.min(...nums) : Math.max(...nums)) : null;
              return (
                <div key={r.label} className="grid border-b border-line last:border-0" style={{ gridTemplateColumns: cols }}>
                  <span className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint sm:px-4" title={r.hint}>
                    {r.label}
                  </span>
                  {vals.map((v, i) => (
                    <span key={i} className={clsx("py-2.5 text-center font-display text-lg font-bold tabular", v !== null && v === best ? "text-up" : "text-ink/80")}>
                      {v === null ? "–" : r.fmt ? r.fmt(v, ps[i]) : v}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>

          <WeeklyChart players={ps} />

          {ps.length >= 2 && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/trade?give=${ps[1].id}&get=${ps[0].id}`}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-2 px-5 text-sm font-bold text-bg transition hover:brightness-110"
              >
                <ArrowLeftRight className="size-4" /> Check {ps[1].name.split(" ").slice(-1)[0]} for {ps[0].name.split(" ").slice(-1)[0]}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Fantasy points by week, one line per player. */
function WeeklyChart({ players }: { players: PlayerValue[] }) {
  const weeks = Math.max(...players.map((p) => p.weekPoints.length));
  const max = Math.max(10, ...players.flatMap((p) => p.weekPoints.map((v) => v ?? 0)));
  if (weeks < 2) return null;
  const W = 640;
  const H = 200;
  const pad = { l: 32, r: 12, t: 12, b: 24 };
  const x = (i: number) => pad.l + (i / (weeks - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const ticks = [0, Math.round(max / 2), Math.round(max)];
  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Points by week</h2>
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          {players.map((p, i) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span className="h-1 w-4 rounded-full" style={{ background: SERIES[i] }} /> {p.name}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Fantasy points by week">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(255 255 255 / 0.06)" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--color-faint)">
              {t}
            </text>
          </g>
        ))}
        {Array.from({ length: weeks }, (_, i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-faint)">
            {i + 1}
          </text>
        ))}
        {players.map((p, k) => {
          const pts = p.weekPoints.map((v, i) => (v === null ? null : [x(i), y(v)] as const)).filter((v): v is readonly [number, number] => !!v);
          return (
            <g key={p.id}>
              <polyline points={pts.map(([a, b]) => `${a},${b}`).join(" ")} fill="none" stroke={SERIES[k]} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map(([a, b], i) => (
                <circle key={i} cx={a} cy={b} r={3.5} fill={SERIES[k]} />
              ))}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
