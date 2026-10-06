"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { ArrowDownUp, ArrowRight } from "lucide-react";
import { PlayerAvatar, PosBadge, ValueBadge } from "./PlayerBits";
import { evaluateTrade } from "@/lib/tradeAnalysis";
import { tradeRiskReward } from "@/lib/risk";
import { RiskRewardPill } from "./RiskReward";
import type { PlayerValue } from "@/lib/types";

const VERDICT = {
  win: { label: "You win", cls: "bg-up/15 text-up" },
  fair: { label: "Fair", cls: "bg-volt/15 text-volt" },
  lose: { label: "You lose", cls: "bg-down/15 text-down" },
  empty: { label: "–", cls: "bg-white/5 text-muted" },
} as const;

/** Clickable trade card: both sides with values, a verdict pill, and a link into the analyzer. */
export function TradeIdeaCard({
  title,
  subtitle,
  give,
  get,
  board,
  partnerRosterId,
  note,
  footer,
  index = 0,
}: {
  title: string;
  subtitle?: string | null;
  give: string[];
  get: string[];
  board: Map<string, PlayerValue>;
  partnerRosterId?: number | null;
  note?: ReactNode;
  footer?: ReactNode;
  index?: number;
}) {
  const giveP = give.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p);
  const getP = get.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p);
  const r = evaluateTrade(giveP, getP);
  const rr = tradeRiskReward(giveP, getP);
  const href = `/trade?give=${give.join(",")}&get=${get.join(",")}${partnerRosterId ? `&partner=${partnerRosterId}` : ""}`;
  const v = VERDICT[r.verdict];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.06 }}
      className="flex h-full flex-col rounded-2xl border border-line-strong bg-gradient-to-b from-surface-2 to-surface p-4 transition hover:border-rocket/50 hover:shadow-[0_12px_40px_-16px] hover:shadow-rocket/50"
    >
      <Link href={href} className="group flex flex-1 flex-col">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-bold uppercase leading-tight">{title}</div>
            {subtitle && <div className="truncate text-xs text-muted">{subtitle}</div>}
          </div>
          <span className={clsx("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold", v.cls)}>{v.label}</span>
        </div>
        <Side label="You give" players={giveP} total={Math.round(r.adjGive)} color="text-rocket" />
        <div className="my-1.5 flex items-center gap-2 text-faint">
          <span className="h-px flex-1 bg-line" />
          <ArrowDownUp className="size-3.5" />
          <span className="h-px flex-1 bg-line" />
        </div>
        <Side label="You get" players={getP} total={Math.round(r.adjGet)} color="text-volt" />
        {rr && <RiskRewardPill rr={rr} className="mt-3" />}
        {note && <div className="mt-2 text-xs leading-relaxed text-muted">{note}</div>}
        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-rocket">
          Open in Trade Analyzer <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </Link>
      {footer}
    </motion.div>
  );
}

function Side({ label, players, total, color }: { label: string; players: PlayerValue[]; total: number; color: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-2.5">
      <div className="mb-1.5 flex items-baseline justify-between px-0.5">
        <span className={clsx("text-[10px] font-bold uppercase tracking-wider", color)}>{label}</span>
        <span className="text-xs text-muted tabular" title="Trade weight: what the market pays for this side (stars count for more than their 1–100 value)">
          <b className="font-display text-sm text-ink">{total}</b> wt
        </span>
      </div>
      <ul className="space-y-1.5">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={30} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight">{p.name}</span>
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <PosBadge pos={p.position} className="h-4 min-w-7 text-[9px]" /> {p.team ?? "FA"}
              </span>
            </span>
            <ValueBadge value={p.value} size="sm" />
          </li>
        ))}
      </ul>
    </div>
  );
}
