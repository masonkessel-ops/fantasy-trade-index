"use client";

import clsx from "clsx";
import { ShieldAlert } from "lucide-react";
import { playerRisk, type TradeRiskReward } from "@/lib/risk";
import type { PlayerValue } from "@/lib/types";

const RATING_CLS: Record<TradeRiskReward["rating"], string> = {
  Great: "bg-up/15 text-up",
  Good: "bg-up/10 text-up",
  Fair: "bg-volt/15 text-volt",
  Risky: "bg-flame/15 text-flame",
  Poor: "bg-down/15 text-down",
};

/** Compact "Risk/Reward: Good · +8% value, less risk" line for trade cards. */
export function RiskRewardPill({ rr, className }: { rr: TradeRiskReward; className?: string }) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-1.5 text-xs", className)}>
      <span className="text-faint">Risk/Reward</span>
      <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-bold", RATING_CLS[rr.rating])}>{rr.rating}</span>
      <span className="text-muted">{rr.summary}</span>
    </div>
  );
}

/** Bigger risk-vs-reward panel for the Trade Analyzer. */
export function RiskRewardPanel({ rr }: { rr: TradeRiskReward }) {
  const bar = (v: number, cls: string) => (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
      <div className={clsx("h-full rounded-full transition-all", cls)} style={{ width: `${Math.max(3, Math.min(100, v * 100))}%` }} />
    </div>
  );
  return (
    <div className="rounded-2xl border border-line bg-bg/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-display text-lg font-bold uppercase tracking-wide">Risk vs reward</span>
        <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-bold", RATING_CLS[rr.rating])}>{rr.rating}</span>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="w-28 text-muted">Risk you give up</span>
          {bar(rr.riskGive, "bg-rocket")}
          <span className="w-14 text-right tabular text-muted">{Math.round(rr.riskGive * 100)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-28 text-muted">Risk you take on</span>
          {bar(rr.riskGet, "bg-volt")}
          <span className="w-14 text-right tabular text-muted">{Math.round(rr.riskGet * 100)}</span>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink/90">{rr.summary.charAt(0).toUpperCase() + rr.summary.slice(1)}.</p>
      <p className="mt-1 text-[11px] text-faint">Risk counts injuries, age, boom/bust weeks, small samples and falling value, weighted by each player&apos;s trade value.</p>
    </div>
  );
}

/** Tiny per-player risk tag (only shown for Medium/High). */
export function RiskTag({ p }: { p: PlayerValue }) {
  const r = playerRisk(p);
  if (r.level === "Low") return null;
  return (
    <span
      title={`${r.level} risk: ${r.reasons.join(", ")}`}
      className={clsx("inline-flex items-center gap-0.5 rounded px-1 py-px text-[10px] font-bold", r.level === "High" ? "bg-down/15 text-down" : "bg-flame/15 text-flame")}
    >
      <ShieldAlert className="size-3" />
      {r.level === "High" ? "High risk" : "Risk"}
    </span>
  );
}
