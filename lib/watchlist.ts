"use client";

import { useCallback } from "react";
import { useStored } from "./localStore";

/** Players you follow, with their value on the day you started (to show how they've moved). Kept in this browser. */
export type Watchlist = Record<string, { since: number; at: string }>;

const KEY = "fti_watch_v1";
const EMPTY: Watchlist = {};

export function useWatchlist() {
  const [list, set, hydrated] = useStored<Watchlist>(KEY);
  const toggle = useCallback(
    (id: string, value: number) => {
      const next = { ...(list ?? EMPTY) };
      if (next[id]) delete next[id];
      else next[id] = { since: value, at: new Date().toISOString().slice(0, 10) };
      set(next);
    },
    [list, set],
  );
  return { watching: list ?? EMPTY, toggle, hydrated };
}
