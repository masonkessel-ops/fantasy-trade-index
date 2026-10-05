"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { LeagueProvider, Scoring } from "./types";

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
  source: LeagueProvider | "manual";
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
    provider?: LeagueProvider;
  };
  /** for non-league teams: player ids in the starting lineup (league teams use league.teams[].starters) */
  starters?: string[];
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

/** Listeners told about user edits (the account sync uses this to save to the cloud). */
const editListeners = new Set<(team: SavedTeam | null) => void>();
export function onTeamEdited(fn: (team: SavedTeam | null) => void) {
  editListeners.add(fn);
  return () => editListeners.delete(fn);
}

export function readSavedTeam(): SavedTeam | null {
  return parse(read());
}

/**
 * Save the team in this browser. `fromCloud` = this copy came from the user's
 * account, so don't echo it back to the server.
 */
export function saveTeam(team: SavedTeam | null, opts: { fromCloud?: boolean } = {}) {
  const stamped = team ? { ...team, updatedAt: opts.fromCloud ? team.updatedAt : Date.now() } : null;
  try {
    if (stamped) localStorage.setItem(KEY, JSON.stringify(stamped));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable (private mode) — nothing to do */
  }
  window.dispatchEvent(new Event(EVENT));
  if (!opts.fromCloud) editListeners.forEach((fn) => fn(stamped));
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
