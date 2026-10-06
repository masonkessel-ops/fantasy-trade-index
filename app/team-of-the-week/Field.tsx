"use client";

import Link from "next/link";
import { motion } from "motion/react";
import clsx from "clsx";
import { Crown } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerBits";
import { POS_COLOR } from "@/lib/ui";
import type { LivePlayer } from "@/lib/live";

type Spot = { slot: string; player: LivePlayer | null };

/** Formation coordinates (% of field). Landscape: offense drives right. Portrait: offense drives up. */
const LANDSCAPE: Record<string, [number, number]> = {
  WR1: [55, 13],
  FLEX: [50, 31],
  TE: [53, 69],
  WR2: [55, 87],
  QB: [40, 50],
  RB1: [25, 36],
  RB2: [25, 64],
  DST: [71, 50],
  K: [89, 50],
};
const PORTRAIT: Record<string, [number, number]> = {
  WR1: [13, 42],
  FLEX: [33, 47],
  TE: [68, 50],
  WR2: [87, 42],
  QB: [50, 60],
  RB1: [33, 76],
  RB2: [67, 76],
  DST: [50, 29],
  K: [50, 11],
};

export function Field({ lineup, mvp, weekKey }: { lineup: Spot[]; mvp: string | null; weekKey: string }) {
  return (
    <>
      <FieldView lineup={lineup} mvp={mvp} weekKey={weekKey} coords={LANDSCAPE} orientation="landscape" className="hidden aspect-[16/9] xl:block" />
      <FieldView lineup={lineup} mvp={mvp} weekKey={weekKey} coords={PORTRAIT} orientation="portrait" className="mx-auto aspect-[3/4] max-w-xl xl:hidden" />
    </>
  );
}

function FieldView({
  lineup,
  mvp,
  weekKey,
  coords,
  orientation,
  className,
}: {
  lineup: Spot[];
  mvp: string | null;
  weekKey: string;
  coords: Record<string, [number, number]>;
  orientation: "landscape" | "portrait";
  className: string;
}) {
  const land = orientation === "landscape";
  return (
    <div
      className={clsx("relative w-full overflow-hidden rounded-[1.5rem] border border-white/10 shadow-2xl shadow-black/60", className)}
      style={{
        background: `repeating-linear-gradient(${land ? "90deg" : "0deg"}, #0f5d33 0 5%, #0d5530 5% 10%)`,
      }}
    >
      {/* end zones */}
      <div className={clsx("absolute flex items-center justify-center bg-gradient-to-br from-brand/90 to-brand-2/80", land ? "inset-y-0 left-0 w-[8%]" : "inset-x-0 bottom-0 h-[7%]")}>
        <span className={clsx("font-display text-sm font-extrabold uppercase italic tracking-[0.3em] text-white/90 sm:text-lg", land && "-rotate-90 whitespace-nowrap")}>
          Trade
        </span>
      </div>
      <div className={clsx("absolute flex items-center justify-center bg-gradient-to-br from-[#123] to-[#0a1a2a]", land ? "inset-y-0 right-0 w-[8%]" : "inset-x-0 top-0 h-[7%]")}>
        <span className={clsx("font-display text-sm font-extrabold uppercase italic tracking-[0.3em] text-white/80 sm:text-lg", land && "rotate-90 whitespace-nowrap")}>
          Index
        </span>
      </div>
      {/* yard lines */}
      {Array.from({ length: 9 }, (_, i) => {
        const pos = 8 + ((i + 1) * 84) / 10;
        const yard = i < 5 ? (i + 1) * 10 : (9 - i) * 10;
        const ppos = 7 + ((i + 1) * 86) / 10;
        return (
          <div key={i}>
            <div
              className="absolute bg-white/30"
              style={land ? { left: `${pos}%`, top: 0, bottom: 0, width: i === 4 ? 2 : 1 } : { top: `${ppos}%`, left: 0, right: 0, height: i === 4 ? 2 : 1 }}
            />
            <span
              className="absolute font-display text-[10px] font-bold text-white/25 sm:text-sm"
              style={land ? { left: `${pos}%`, top: "3%", transform: "translateX(-50%)" } : { top: `${ppos}%`, left: "3%", transform: "translateY(-50%)" }}
            >
              {yard}
            </span>
          </div>
        );
      })}
      {/* line of scrimmage */}
      <div
        className="absolute bg-volt/50 shadow-[0_0_12px] shadow-volt"
        style={land ? { left: "61%", top: 0, bottom: 0, width: 2 } : { top: "37%", left: 0, right: 0, height: 2 }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.45))]" />

      {lineup.map((s, i) => {
        const c = coords[s.slot];
        if (!c) return null;
        return (
          <motion.div
            key={`${weekKey}-${s.slot}`}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${c[0]}%`, top: `${c[1]}%` }}
            initial={{ opacity: 0, scale: 0.4, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.08 * i }}
          >
            <PlayerToken spot={s} mvp={s.player?.id === mvp} compact={!land} />
          </motion.div>
        );
      })}
    </div>
  );
}

function PlayerToken({ spot, mvp, compact }: { spot: Spot; mvp: boolean; compact: boolean }) {
  const p = spot.player;
  const label = spot.slot.replace(/\d/, "");
  if (!p) {
    return (
      <div className="grid size-12 place-items-center rounded-full border-2 border-dashed border-white/30 text-[10px] font-bold text-white/60">
        {label}
      </div>
    );
  }
  const color = POS_COLOR[p.position];
  return (
    <Link href={`/players/${p.id}`} className="group flex flex-col items-center">
      <div className="relative transition-transform group-hover:scale-110">
        {mvp && (
          <Crown className="absolute -top-4 left-1/2 size-4 -translate-x-1/2 fill-flame text-flame drop-shadow sm:-top-5 sm:size-5" />
        )}
        <div className={clsx("rounded-full p-[3px]", mvp && "animate-pulse")} style={{ background: mvp ? "linear-gradient(135deg,#facc15,#3b82f6)" : color }}>
          <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={compact ? 42 : 56} />
        </div>
        <span
          className="absolute -bottom-1 -right-2 rounded-md px-1.5 py-px font-display text-xs font-bold text-bg shadow sm:text-sm"
          style={{ background: color }}
        >
          {p.pts}
        </span>
      </div>
      <div className="mt-1.5 max-w-24 rounded-md bg-black/60 px-1.5 py-0.5 text-center backdrop-blur sm:max-w-32">
        <div className="truncate text-[10px] font-semibold text-white sm:text-xs">{p.position === "DST" ? p.team : p.name.split(" ").slice(-1)[0]}</div>
        <div className="text-[9px] font-bold uppercase tracking-wider text-white/50">{label}</div>
      </div>
    </Link>
  );
}
