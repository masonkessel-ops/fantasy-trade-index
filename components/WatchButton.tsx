"use client";

import clsx from "clsx";
import { Star } from "lucide-react";
import { useWatchlist } from "@/lib/watchlist";

/** Follow a player: he shows up in "Your watchlist" on the home page with his value change since. */
export function WatchButton({ id, value, name }: { id: string; value: number; name: string }) {
  const { watching, toggle, hydrated } = useWatchlist();
  if (!hydrated) return null;
  const on = !!watching[id];
  return (
    <button
      onClick={() => toggle(id, value)}
      aria-pressed={on}
      title={on ? `Stop watching ${name}` : `Watch ${name}: follow his value from your home page`}
      className={clsx(
        "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
        on ? "border-volt/50 bg-volt/10 text-volt" : "border-line-strong hover:bg-white/5",
      )}
    >
      <Star className={clsx("size-4", on && "fill-current")} /> {on ? "Watching" : "Watch"}
    </button>
  );
}
