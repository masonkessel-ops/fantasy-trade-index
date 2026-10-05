"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Scoring } from "./types";

/**
 * The user's team lives in localStorage (no accounts needed). Other features
 * (Trade Analyzer, AI Assistant) read it through `useMyTeam()`.
 */
export interface SavedLeagueTeam {
  rosterId: number;
  ownerId: string | null;
  displayName: string;
  teamName: string;
  avatar: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  players: string[];
  starters: string[];
}

export interface SavedTeam {
  source: "sleeper" | "manual";
  name: string;
  avatar: string | null;
  scoring: Scoring;
  playerIds: string[];
  rosterPositions: string[];
  league?: {
    leagueId: string;
    name: string;
    season: string;
    totalRosters: number;
    avatar: string | null;
    scoringSettings: Record<string, number>;
    teams: SavedLeagueTeam[];
    myRosterId: number;
    username: string;
  };
  /** id -> basic info for rostered players who aren't on the value chart */
  directory: Record<string, { name: string; position: string; team: string | null }>;
  updatedAt: number;
}

export const DEFAULT_ROSTER_POSITIONS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"];

const KEY = "tr_team_v1";
const EVENT = "tr-team-change";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, cb);
  };
}

let cachedRaw: string | null = null;
let cachedTeam: SavedTeam | null = null;
function parse(raw: string | null): SavedTeam | null {
  if (raw === cachedRaw) return cachedTeam;
  cachedRaw = raw;
  try {
    cachedTeam = raw ? (JSON.parse(raw) as SavedTeam) : null;
  } catch {
    cachedTeam = null;
  }
  return cachedTeam;
}

export function saveTeam(team: SavedTeam | null) {
  try {
    if (team) localStorage.setItem(KEY, JSON.stringify({ ...team, updatedAt: Date.now() }));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable (private mode) — nothing to do */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Returns [team, setTeam, hydrated]. `hydrated` is false during SSR / first paint. */
export function useMyTeam() {
  const raw = useSyncExternalStore(subscribe, read, () => "__ssr__");
  const hydrated = raw !== "__ssr__";
  const team = hydrated ? parse(raw) : null;
  const set = useCallback((t: SavedTeam | null) => saveTeam(t), []);
  return [team, set, hydrated] as const;
}

export function scoringFromRec(rec: number | undefined): Scoring {
  if (rec === undefined) return "ppr";
  if (rec >= 0.75) return "ppr";
  if (rec >= 0.25) return "half";
  return "std";
}
