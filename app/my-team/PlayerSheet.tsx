"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowUpFromLine, ExternalLink, Trash2, X } from "lucide-react";
import { InjuryTag, PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import { RiskTag } from "@/components/RiskReward";
import { playerRisk } from "@/lib/risk";
import { POS_COLOR } from "@/lib/ui";
import type { PlayerValue } from "@/lib/types";

export interface PlayerWeek {
  actual: number | null;
  projected: number | null;
  state: "pre" | "live" | "final" | "bye";
  opponent: string | null;
}

/** Quick player card: this week's points, season numbers, risk, and a Trade away shortcut. */
export function PlayerSheet({
  player,
  week,
  weekNumber,
  onClose,
  onTradeAway,
  onRemove,
}: {
  player: PlayerValue | null;
  week?: PlayerWeek;
  weekNumber: number | null;
  onClose: () => void;
  onTradeAway: (id: string) => void;
  /** only for hand-built teams */
  onRemove?: (id: string) => void;
}) {
  return (
    <AnimatePresence>
      {player && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label={player.name}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-line-strong bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
          >
            <Body player={player} week={week} weekNumber={weekNumber} onClose={onClose} onTradeAway={onTradeAway} onRemove={onRemove} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Body({
  player: p,
  week,
  weekNumber,
  onClose,
  onTradeAway,
  onRemove,
}: {
  player: PlayerValue;
  week?: PlayerWeek;
  weekNumber: number | null;
  onClose: () => void;
  onTradeAway: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const risk = playerRisk(p);
  const color = POS_COLOR[p.position];
  const pts = p.weekPoints;
  const max = Math.max(10, ...pts.map((x) => x ?? 0));
  return (
    <>
      <div className="mb-4 flex items-start gap-3">
        <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-display text-2xl font-extrabold uppercase italic leading-none">{p.name}</h3>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <PosBadge pos={p.position} /> {p.team} · {p.position}
            {p.posRank} <InjuryTag status={p.injuryStatus} /> <RiskTag p={p} />
          </div>
        </div>
        <ValueBadge value={p.value} />
        <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:text-ink">
          <X className="size-5" />
        </button>
      </div>

      {/* This week */}
      <div className="mb-3 rounded-2xl border border-line bg-bg/40 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            Week {weekNumber ?? ""} {week?.opponent ? `· ${week.opponent}` : ""}
          </span>
          <span className={clsx("text-[11px] font-bold uppercase", week?.state === "live" ? "text-down" : "text-faint")}>
            {week?.state === "live" ? "● Live" : week?.state === "final" ? "Final" : week?.state === "bye" ? "Bye" : week ? "Not started" : ""}
          </span>
        </div>
        <div className="mt-1 flex items-end gap-4">
          <div>
            <div className="font-display text-4xl font-bold tabular" style={{ color: week?.actual != null ? color : undefined }}>
              {week?.state === "bye" ? "BYE" : week?.actual ?? week?.projected ?? "–"}
            </div>
            <div className="text-xs text-muted">{week?.actual != null ? "points" : "projected"}</div>
          </div>
          {week?.actual != null && week.projected != null && (
            <div className="pb-1 text-sm text-muted">
              proj {week.projected}{" "}
              <span className={week.actual >= week.projected ? "text-up" : "text-down"}>
                ({week.actual >= week.projected ? "+" : ""}
                {Math.round((week.actual - week.projected) * 10) / 10})
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["Season PPG", p.ppg],
          ["Last 3", p.recentPpg ?? "–"],
          ["ROS proj", p.rosPpg],
        ].map(([label, v]) => (
          <div key={label} className="rounded-xl bg-surface-2 py-2">
            <div className="font-display text-xl font-bold tabular">{v}</div>
            <div className="text-[10px] uppercase tracking-wider text-faint">{label}</div>
          </div>
        ))}
      </div>

      {/* Weekly points */}
      <div className="mb-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Points by week</div>
        <div className="flex h-16 items-end gap-1">
          {pts.map((x, i) => (
            <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`Week ${i + 1}: ${x ?? "did not play"}`}>
              <div className="w-full rounded-t" style={{ height: `${x ? Math.max(6, (x / max) * 100) : 4}%`, background: x ? color : "rgb(255 255 255 / 0.06)" }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {pts.map((x, i) => (
            <span key={i} className="flex-1 text-center text-[10px] tabular text-faint">
              {x ?? "–"}
            </span>
          ))}
        </div>
      </div>

      <p className="mb-4 text-xs text-muted">
        Risk: <b className={risk.level === "High" ? "text-down" : risk.level === "Medium" ? "text-flame" : "text-up"}>{risk.level}</b>
        {risk.reasons.length > 0 && ` (${risk.reasons.join(", ")})`}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onTradeAway(p.id)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-2 text-sm font-bold text-white transition hover:brightness-110"
        >
          <ArrowUpFromLine className="size-4" /> Trade away
        </button>
        <Link href={`/players/${p.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong text-sm font-semibold transition hover:bg-white/5">
          Full stats <ExternalLink className="size-4" />
        </Link>
      </div>
      {onRemove && (
        <button
          onClick={() => onRemove(p.id)}
          className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-muted transition hover:bg-down/10 hover:text-down"
        >
          <Trash2 className="size-4" /> Remove from my team
        </button>
      )}
    </>
  );
}
