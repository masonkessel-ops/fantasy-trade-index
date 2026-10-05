"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "motion/react";

/** Tiny inline trend line for table rows. */
export function Sparkline({
  values,
  color = "var(--color-rocket)",
  width = 72,
  height = 24,
}: {
  values: (number | null)[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return <span className="inline-block" style={{ width, height }} />;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = Math.max(4, max - min);
  const x = (i: number) => (i / (values.length - 1)) * (width - 4) + 2;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={2.25} fill={color} />
    </svg>
  );
}

/** Area chart of a player's trade value across the season, with hover readout. */
export function ValueTrendChart({ values, color }: { values: (number | null)[]; color: string }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 480 ? 180 : 220;
  const pad = { l: 30, r: 14, t: 16, b: 26 };
  const n = values.length;
  const known = values.filter((v): v is number => v !== null);
  const lo = Math.max(0, Math.floor((Math.min(...known) - 8) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...known) + 8) / 10) * 10);
  const x = (i: number) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - pad.t - pad.b);
  const pts = values.map((v, i) => (v === null ? null : { x: x(i), y: y(v), v, i })).filter(Boolean) as {
    x: number;
    y: number;
    v: number;
    i: number;
  }[];
  const line = pts.map((p, k) => `${k ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const area = pts.length ? `${line} L${pts[pts.length - 1].x},${H - pad.b} L${pts[0].x},${H - pad.b} Z` : "";
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const active = hover !== null ? pts.find((p) => p.i === hover) : pts[pts.length - 1];

  return (
    <div className="relative" ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        height={H}
        className="w-full touch-none select-none"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.35} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(255 255 255 / 0.06)" strokeDasharray="3 5" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-faint text-[11px]">
              {t}
            </text>
          </g>
        ))}
        {values.map((_, i) =>
          n > 8 && W < 480 && i % 2 === 1 && i !== n - 1 ? null : (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-faint text-[11px]">
              W{i + 1}
            </text>
          ),
        )}
        <motion.path
          d={area}
          fill={`url(#${id}-fill)`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        {pts.map((p) => (
          <circle key={p.i} cx={p.x} cy={p.y} r={p.i === active?.i ? 6 : 3.5} fill="var(--color-bg)" stroke={color} strokeWidth={2.5} />
        ))}
        {active && (
          <line x1={active.x} x2={active.x} y1={pad.t} y2={H - pad.b} stroke={color} strokeOpacity={0.25} />
        )}
      </svg>
      {active && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-line-strong bg-surface-3/95 px-2.5 py-1 text-xs shadow-xl backdrop-blur"
          style={{ left: `${Math.min(85, Math.max(15, (active.x / W) * 100))}%`, top: -8 }}
        >
          <span className="text-muted">Week {active.i + 1}</span>{" "}
          <span className="font-display text-base font-bold" style={{ color }}>
            {active.v}
          </span>
        </div>
      )}
    </div>
  );
}

/** Weekly fantasy points as bars, with the projection shown as a marker. */
export function WeeklyPointsChart({
  weeks,
  color,
}: {
  weeks: { week: number; actual: number | null; projected: number | null; opponent: string | null }[];
  color: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(10, ...weeks.map((w) => Math.max(w.actual ?? 0, w.projected ?? 0)));
  return (
    <div>
      <div className="flex h-40 items-end gap-1 sm:gap-1.5">
        {weeks.map((w, i) => {
          const h = w.actual !== null ? (w.actual / max) * 100 : 0;
          const ph = w.projected !== null ? (w.projected / max) * 100 : null;
          const beat = w.actual !== null && w.projected !== null && w.actual >= w.projected;
          return (
            <div
              key={w.week}
              className="relative flex h-full flex-1 flex-col justify-end"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            >
              {ph !== null && (
                <div
                  className="absolute inset-x-0 z-10 border-t-2 border-dashed border-white/40"
                  style={{ bottom: `${ph}%` }}
                />
              )}
              {w.actual !== null ? (
                <motion.div
                  className="w-full rounded-t-md"
                  style={{
                    background: beat
                      ? `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 35%, transparent))`
                      : "linear-gradient(180deg, rgb(255 255 255 / 0.28), rgb(255 255 255 / 0.06))",
                  }}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(2, h)}%` }}
                  transition={{ duration: 0.6, delay: i * 0.03, ease: "easeOut" }}
                />
              ) : (
                <div className="h-1 w-full rounded bg-white/[0.04]" />
              )}
              {hover === i && (
                <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line-strong bg-surface-3 px-2.5 py-1.5 text-xs shadow-xl">
                  <div className="font-semibold">
                    Week {w.week} <span className="text-muted">{w.opponent}</span>
                  </div>
                  <div className="text-muted">
                    Actual <span className="font-semibold text-ink">{w.actual ?? "–"}</span> · Proj{" "}
                    <span className="font-semibold text-ink">{w.projected ?? "–"}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1 sm:gap-1.5">
        {weeks.map((w) => (
          <span key={w.week} className="flex-1 text-center text-[10px] text-faint">
            {w.week}
          </span>
        ))}
      </div>
    </div>
  );
}
