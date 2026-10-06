"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowUpDown, Check, Sparkles, X } from "lucide-react";
import { InjuryTag, PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import { PlayerSearch } from "@/components/PlayerSearch";
import type { SavedTeam } from "@/lib/myTeam";
import { SLOT_ELIGIBLE, SLOT_LABEL, bestLineup, type LineupSlot } from "@/lib/teamAnalysis";
import { POS_COLOR } from "@/lib/ui";
import type { PlayerValue } from "@/lib/types";
import type { PlayerWeek } from "./PlayerSheet";

const PROVIDER_LABEL: Record<string, string> = { sleeper: "Sleeper", espn: "ESPN", yahoo: "Yahoo" };
const OUT = new Set(["Out", "IR", "PUP", "Sus", "NA"]);

/**
 * Starting lineup + bench, Sleeper-style: tap Move on a player, then tap who to swap with.
 * "Best lineup" fills the slots by this week's projections (players whose game has started stay put).
 */
export function Lineup({
  team,
  roster,
  players,
  offChart,
  points,
  week,
  plan,
  onChange,
  onOpen,
}: {
  team: SavedTeam;
  roster: PlayerValue[];
  players: PlayerValue[];
  offChart: string[];
  points?: Record<string, PlayerWeek>;
  week: number | null;
  /** next week's projections, once this week is mostly played */
  plan: { week: number; points: Record<string, PlayerWeek> } | null;
  onChange: (t: SavedTeam) => void;
  onOpen: (id: string) => void;
}) {
  const rp = team.rosterPositions;
  const [moving, setMoving] = useState<string | null>(null);

  // Whose lineup: your own edits, else the league's, else the best one by value.
  const record = team.league?.teams.find((t) => t.rosterId === team.league!.myRosterId);
  const leagueStarters = record?.starters?.length ? record.starters : null;
  const chosen = team.starters ?? leagueStarters;
  const { starters, bench } = useMemo(() => {
    if (!chosen) return bestLineup(roster, rp);
    const set = new Set(chosen);
    const fit = bestLineup(roster.filter((p) => set.has(p.id)), rp);
    return { starters: fit.starters, bench: [...roster.filter((p) => !set.has(p.id)), ...fit.bench].sort((a, b) => b.value - a.value) };
  }, [roster, rp, chosen]);
  const starterIds = starters.map((s) => s.player?.id).filter((id): id is string => !!id);
  const emptySlots = starters.filter((s) => !s.player).length;

  const pts = (id: string) => {
    const w = points?.[id];
    return w ? (w.actual ?? w.projected ?? 0) : 0;
  };
  const total = (ids: string[]) => Math.round(ids.reduce((s, id) => s + pts(id), 0) * 10) / 10;

  // Best lineup for the week you're planning (next week once this one is mostly played).
  // Players on bye or ruled out never start.
  const planPoints = plan?.points ?? points;
  const planWeek = plan?.week ?? week;
  const projOf = (id: string) => {
    const w = planPoints?.[id];
    return !w || w.state === "bye" ? 0 : (w.projected ?? 0);
  };
  const projTotal = (ids: string[]) => Math.round(ids.reduce((s, id) => s + projOf(id), 0) * 10) / 10;
  const starterKey = starterIds.join(",");
  const best = useMemo(() => {
    if (!planPoints) return null;
    const score = (p: PlayerValue) => {
      const w = planPoints[p.id];
      if (!w || w.state === "bye" || (p.injuryStatus && OUT.has(p.injuryStatus))) return -1 + p.value / 1000;
      return (w.projected ?? 0) + p.value / 1000;
    };
    const ids = bestLineup(roster, rp, score)
      .starters.map((s) => s.player?.id)
      .filter((id): id is string => !!id);
    return { ids, gain: Math.round((projTotal(ids) - projTotal(starterKey ? starterKey.split(",") : [])) * 10) / 10 };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- projTotal only reads planPoints
  }, [planPoints, roster, rp, starterKey]);
  const isBest = !best || [...best.ids].sort().join() === [...starterIds].sort().join();

  const setStarters = (ids: string[]) => {
    setMoving(null);
    onChange({ ...team, starters: ids });
  };

  /** Would swapping these two (or moving one into an empty slot) give a legal lineup? */
  const swapResult = (out: string | null, inn: string | null) => {
    const next = starterIds.filter((id) => id !== out);
    if (inn) next.push(inn);
    const set = new Set(next);
    const fit = bestLineup(roster.filter((p) => set.has(p.id)), rp);
    const filled = fit.starters.filter((s) => s.player).length;
    const ok = (!inn || fit.starters.some((s) => s.player?.id === inn)) && filled >= starters.length - emptySlots - (inn ? 0 : 1);
    return ok ? next : null;
  };

  const movingIsStarter = moving ? starterIds.includes(moving) : false;
  const targetFor = (id: string | null, slotIndex?: number): (() => void) | null => {
    if (!moving || id === moving) return null;
    if (movingIsStarter) {
      if (id && starterIds.includes(id)) return null; // starter ↔ starter: nothing to change
      const next = swapResult(moving, id);
      return next ? () => setStarters(next) : null;
    }
    // moving a bench player
    if (id === null && slotIndex !== undefined) {
      const slot = starters[slotIndex].slot;
      const p = roster.find((x) => x.id === moving);
      return p && SLOT_ELIGIBLE[slot]?.includes(p.position) ? () => setStarters([...starterIds, moving]) : null;
    }
    if (!id || !starterIds.includes(id)) return null;
    const next = swapResult(id, moving);
    return next ? () => setStarters(next) : null;
  };

  const note = team.starters
    ? leagueStarters
      ? `Your edits (your ${PROVIDER_LABEL[team.source] ?? "league"} lineup isn't changed).`
      : "Your lineup."
    : leagueStarters
      ? `As set in your ${PROVIDER_LABEL[team.source] ?? ""} league.`
      : "Best lineup by trade value.";

  return (
    <section className="card animate-rise p-4 [animation-delay:120ms] sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide">Lineup</h2>
          <p className="text-xs text-muted">
            {note} Tap a position tag to move a player.{" "}
            {team.starters && (
              <button onClick={() => onChange({ ...team, starters: undefined })} className="font-semibold text-rocket hover:underline">
                {leagueStarters ? "Use league lineup" : "Reset"}
              </button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {points && (
            <div className="mr-1 text-right leading-tight">
              <div className="font-display text-2xl font-bold text-gradient tabular">{total(starterIds)}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">{week ? `Week ${week} pts` : "pts"}</div>
            </div>
          )}
          {plan && (
            <div className="mr-1 text-right leading-tight">
              <div className="font-display text-2xl font-bold text-muted tabular">{projTotal(starterIds)}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">Wk {plan.week} proj</div>
            </div>
          )}
          {best && (
            <button
              onClick={() => setStarters(best.ids)}
              disabled={isBest}
              className={clsx(
                "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition",
                isBest ? "bg-up/10 text-up" : "bg-gradient-to-r from-rocket to-flame text-bg hover:brightness-110",
              )}
            >
              {isBest ? <Check className="size-4" /> : <Sparkles className="size-4" />}
              {isBest ? `Best for week ${planWeek}` : `Best lineup${best.gain > 0 ? ` +${best.gain}` : ""}`}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {moving && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-volt/30 bg-volt/10 px-3 py-2 text-sm">
              <span>
                Moving <b>{roster.find((p) => p.id === moving)?.name}</b>: tap a highlighted <b className="text-volt">Swap</b> spot.
              </span>
              <button onClick={() => setMoving(null)} className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted hover:text-ink">
                <X className="size-3.5" /> Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-4 xl:grid-cols-2">
        <div>
          <GroupHeader label="Starters" count={starters.length} pts={points ? total(starterIds) : null} />
          <ul className="space-y-1.5">
            {starters.map((s, i) => (
              <Row
                key={`${s.slot}-${i}`}
                slot={s}
                p={s.player}
                week={s.player ? points?.[s.player.id] : undefined}
                moving={moving}
                nextBye={!!plan && !!s.player && plan.points[s.player.id]?.state === "bye" ? plan.week : null}
                onMove={(id) => setMoving((m) => (m === id ? null : id))}
                onOpen={onOpen}
                target={targetFor(s.player?.id ?? null, i)}
              />
            ))}
          </ul>
        </div>
        <div>
          <GroupHeader label="Bench" count={bench.length + offChart.length} pts={points ? total(bench.map((p) => p.id)) : null} />
          <ul className="space-y-1.5">
            {moving && movingIsStarter && (
              <li>
                <button
                  onClick={() => {
                    const next = starterIds.filter((id) => id !== moving);
                    setStarters(next);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-volt/50 bg-volt/5 py-2.5 text-sm font-semibold text-volt"
                >
                  <ArrowUpDown className="size-4" /> Move to bench (leave the slot empty)
                </button>
              </li>
            )}
            {bench.map((p) => (
              <Row
                key={p.id}
                slot={null}
                p={p}
                week={points?.[p.id]}
                moving={moving}
                nextBye={plan && plan.points[p.id]?.state === "bye" ? plan.week : null}
                onMove={(id) => setMoving((m) => (m === id ? null : id))}
                onOpen={onOpen}
                target={targetFor(p.id)}
              />
            ))}
            {offChart.map((id) => {
              const d = team.directory[id];
              return (
                <li key={id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-muted">
                  <span className="truncate">
                    {d?.name ?? `Player ${id}`} <span className="text-xs text-faint">{d ? `${d.position} · ${d.team ?? "FA"}` : ""}</span>
                  </span>
                  <span className="text-xs text-faint">not on the chart</span>
                </li>
              );
            })}
            {bench.length === 0 && offChart.length === 0 && <li className="rounded-xl border border-dashed border-line py-5 text-center text-sm text-faint">No bench players</li>}
          </ul>
          {team.source === "manual" && (
            <div className="mt-3">
              <PlayerSearch players={players} exclude={team.playerIds} onSelect={(p) => onChange({ ...team, playerIds: [...team.playerIds, p.id] })} placeholder="Add a player to your team…" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function GroupHeader({ label, count, pts }: { label: string; count: number; pts: number | null }) {
  return (
    <div className="mb-2 flex items-baseline justify-between px-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-faint">
        {label} <span className="text-faint/70">· {count}</span>
      </span>
      {pts !== null && <span className="text-xs text-muted tabular">{pts} pts</span>}
    </div>
  );
}

/** The position tag doubles as the move button: tap it to move a player, then tap where he goes. */
function SlotPill({ slot, state = "idle", onClick, label }: { slot: string | null; state?: "idle" | "moving" | "target" | "static"; onClick?: () => void; label?: string }) {
  const eligible = slot ? SLOT_ELIGIBLE[slot] : null;
  const color = eligible?.length === 1 ? POS_COLOR[eligible[0]] : null;
  const text = slot ? (SLOT_LABEL[slot] ?? slot) : "BN";
  const cls = clsx(
    "flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold leading-none transition sm:w-12",
    state === "moving" && "bg-volt text-bg",
    state === "target" && "bg-volt/20 text-volt ring-1 ring-volt/60",
    (state === "idle" || state === "static") && !slot && "bg-white/[0.05] text-muted",
    (state === "idle" || state === "static") && slot && !color && "bg-gradient-to-br from-volt/15 to-rocket/10 text-ink/80",
    state === "idle" && "hover:brightness-125",
  );
  const style = (state === "idle" || state === "static") && color ? { color, background: `color-mix(in srgb, ${color} 15%, transparent)` } : undefined;
  const body =
    state === "moving" ? (
      <X className="size-4" strokeWidth={3} />
    ) : state === "target" ? (
      <>
        <ArrowUpDown className="size-3.5" />
        <span className="text-[9px] uppercase">Swap</span>
      </>
    ) : (
      <>
        {text}
        {state === "idle" && <ArrowUpDown className="size-2.5 opacity-60" />}
      </>
    );
  if (!onClick || state === "static") return <span className={cls} style={style}>{body}</span>;
  return (
    <button onClick={onClick} aria-label={label} title={label} className={cls} style={style}>
      {body}
    </button>
  );
}

function Row({
  slot,
  p,
  week,
  moving,
  nextBye,
  onMove,
  onOpen,
  target,
}: {
  slot: LineupSlot | null;
  p: PlayerValue | null;
  week?: PlayerWeek;
  moving: string | null;
  /** week number if the player is on bye in the week being planned */
  nextBye: number | null;
  onMove: (id: string) => void;
  onOpen: (id: string) => void;
  target: (() => void) | null;
}) {
  const isMoving = !!p && moving === p.id;
  const dim = !!moving && !isMoving && !target;
  const base = clsx(
    "flex items-center gap-2.5 rounded-xl border p-1.5 pr-2.5 transition sm:gap-3 sm:pr-3",
    isMoving ? "border-volt bg-volt/10" : target ? "border-volt/50 bg-volt/[0.06]" : slot ? "border-transparent bg-surface-2" : "border-line/60",
    dim && "opacity-35",
  );

  if (!p) {
    return (
      <li>
        <button onClick={target ?? undefined} disabled={!target} className={clsx(base, "w-full text-left")}>
          <SlotPill slot={slot?.slot ?? null} state={target ? "target" : "static"} />
          <span className="flex-1 text-sm text-faint">{target ? "Tap to start here" : "Empty slot"}</span>
        </button>
      </li>
    );
  }

  return (
    <li className={base}>
      <SlotPill
        slot={slot?.slot ?? null}
        state={isMoving ? "moving" : target ? "target" : "idle"}
        onClick={target ?? (() => onMove(p.id))}
        label={isMoving ? "Cancel move" : target ? `Swap with ${p.name}` : `Move ${p.name}`}
      />
      <button onClick={target ?? (() => onOpen(p.id))} className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3">
        <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={36} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold leading-tight">{p.name}</span>
            <InjuryTag status={p.injuryStatus} />
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted">
            <PosBadge pos={p.position} /> {p.team ?? "FA"}
            <span className="text-faint sm:hidden">· {p.value}</span>
            {nextBye && <span className="rounded bg-down/15 px-1 py-px text-[10px] font-bold text-down">Wk {nextBye} bye</span>}
            {week?.opponent && <span className="hidden truncate text-faint sm:inline">{week.opponent}</span>}
          </span>
        </span>
      </button>
      <Points week={week} />
      <span className="hidden sm:inline-flex">
        <ValueBadge value={p.value} size="sm" />
      </span>
    </li>
  );
}

function Points({ week }: { week?: PlayerWeek }) {
  if (!week) return <span className="w-11 shrink-0" />;
  return (
    <span className="w-11 shrink-0 text-right leading-none sm:w-12">
      {week.state === "bye" ? (
        <span className="text-xs font-bold text-down">BYE</span>
      ) : week.actual != null ? (
        <>
          <span className="block font-display text-lg font-bold tabular">{week.actual}</span>
          <span className={clsx("text-[10px]", week.state === "live" ? "text-down" : "text-faint")}>{week.state === "live" ? "● live" : "final"}</span>
        </>
      ) : (
        <>
          <span className="block font-display text-lg font-bold text-muted tabular">{week.projected ?? "–"}</span>
          <span className="text-[10px] text-faint">proj</span>
        </>
      )}
    </span>
  );
}
