"use client";

import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useMyTeam } from "@/lib/myTeam";

/** "Trade away" if he's on your team, otherwise "What would it take?" — both open the trade finder. */
export function PlayerTradeButtons({ id, name }: { id: string; name: string }) {
  const [team, , hydrated] = useMyTeam();
  if (!hydrated) return null;
  const onMyTeam = !!team?.playerIds.includes(id);
  const cls =
    "inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-rocket to-flame px-4 text-sm font-bold text-bg shadow-[0_8px_30px_-10px] shadow-rocket/60 transition hover:brightness-110";
  if (!team)
    return (
      <Link href="/my-team" className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold transition hover:bg-white/5">
        Add your team to see a fair trade for {name.split(" ").slice(-1)[0]}
      </Link>
    );
  return onMyTeam ? (
    <Link href={`/trade-finder?away=${id}`} className={cls}>
      <ArrowUpFromLine className="size-4" /> Trade away: see what you can get
    </Link>
  ) : (
    <Link href={`/trade-finder?want=${id}`} className={cls}>
      <ArrowDownToLine className="size-4" /> What would it take to get him?
    </Link>
  );
}
