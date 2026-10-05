"use client";

import { useState } from "react";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { POS_COLOR, INJURY_SHORT, valueColor } from "@/lib/ui";
import { playerHeadshot, teamLogo } from "@/lib/teams";
import type { Position } from "@/lib/types";

export function PosBadge({ pos, className }: { pos: Position; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex h-5 min-w-9 items-center justify-center rounded-md px-1.5 text-[10px] font-bold tracking-wide",
        className,
      )}
      style={{ color: POS_COLOR[pos], background: `color-mix(in srgb, ${POS_COLOR[pos]} 14%, transparent)` }}
    >
      {pos}
    </span>
  );
}

export function PlayerAvatar({
  id,
  position,
  team,
  name,
  size = 40,
}: {
  id: string;
  position: Position;
  team: string | null;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = position === "DST" ? (team ? teamLogo(team) : null) : playerHeadshot(id);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3 ring-1 ring-line-strong"
      style={{ width: size, height: size, boxShadow: `0 0 0 2px color-mix(in srgb, ${POS_COLOR[position]} 35%, transparent)` }}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote CDN thumbnails, no optimisation needed
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className={clsx("size-full", position === "DST" ? "object-contain p-1" : "object-cover object-top")}
        />
      ) : (
        <span className="text-xs font-bold text-muted">{initials}</span>
      )}
    </span>
  );
}

export function TeamLogo({ team, size = 18 }: { team: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- remote CDN logo
  return <img src={teamLogo(team)} alt={team} width={size} height={size} loading="lazy" className="inline-block" />;
}

export function ValueBadge({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  const color = valueColor(value);
  const dims = size === "lg" ? "size-20 text-4xl" : size === "sm" ? "h-7 w-10 text-sm" : "h-9 w-12 text-lg";
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-xl font-display font-bold tabular",
        dims,
        size === "lg" && "rounded-2xl",
      )}
      style={{
        color,
        background: `linear-gradient(160deg, color-mix(in srgb, ${color} 22%, transparent), color-mix(in srgb, ${color} 6%, transparent))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      {value}
    </span>
  );
}

export function ChangePill({ change }: { change: number | null }) {
  if (change === null) return <span className="text-xs text-faint">–</span>;
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular",
        change > 0 ? "text-up" : change < 0 ? "text-down" : "text-faint",
      )}
    >
      <Icon className="size-3.5" />
      {change === 0 ? "0" : Math.abs(change)}
    </span>
  );
}

export function InjuryTag({ status }: { status: string | null }) {
  if (!status) return null;
  const severe = ["Out", "IR", "PUP", "Sus", "NA"].includes(status);
  return (
    <span
      title={status}
      className={clsx(
        "rounded px-1 py-px text-[10px] font-bold",
        severe ? "bg-down/15 text-down" : "bg-flame/15 text-flame",
      )}
    >
      {INJURY_SHORT[status] ?? status}
    </span>
  );
}
