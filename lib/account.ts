"use client";

import { useSyncExternalStore } from "react";
import { onTeamEdited, readSavedTeam, saveTeam, type SavedTeam } from "./myTeam";

/**
 * Signed-in account state + cloud sync for the saved team.
 * When signed in: edits are saved to your account, and on load the newer of
 * (this browser's copy, your account's copy) wins.
 */
export interface Account {
  loaded: boolean;
  configured: boolean;
  user: { name: string; email: string; picture: string | null } | null;
  syncing: boolean;
  lastSyncError: string | null;
  /** Premium is set up on this site (Stripe keys present) */
  premiumAvailable: boolean;
  /** this account's active membership */
  premium: { plan: "monthly" | "season"; until: number; cancelsAtPeriodEnd: boolean; canManage: boolean } | null;
}

let state: Account = { loaded: false, configured: false, user: null, syncing: false, lastSyncError: null, premiumAvailable: false, premium: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<Account>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

let started = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function push(team: SavedTeam | null) {
  if (!state.user) return;
  set({ syncing: true });
  try {
    const res = team
      ? await fetch("/api/me/team", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(team) })
      : await fetch("/api/me/team", { method: "DELETE" });
    set({ syncing: false, lastSyncError: res.ok ? null : "Couldn't save to your account." });
  } catch {
    set({ syncing: false, lastSyncError: "Couldn't save to your account." });
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  onTeamEdited((team) => {
    if (!state.user) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push(team), 600);
  });
  fetch("/api/me")
    .then((r) => r.json())
    .then((d: { configured: boolean; user: Account["user"]; team: SavedTeam | null; premiumAvailable?: boolean; premium?: Account["premium"] }) => {
      set({ loaded: true, configured: d.configured, user: d.user, premiumAvailable: !!d.premiumAvailable, premium: d.premium ?? null });
      if (!d.user) return;
      const local = readSavedTeam();
      const cloud = d.team;
      if (cloud && (!local || (cloud.updatedAt ?? 0) > (local.updatedAt ?? 0))) saveTeam(cloud, { fromCloud: true });
      else if (local && (!cloud || (local.updatedAt ?? 0) > (cloud.updatedAt ?? 0))) push(local);
    })
    .catch(() => set({ loaded: true }));
}

export function useAccount(): Account {
  start();
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  set({ user: null, premium: null });
}

/**
 * Should Premium-only extras be locked for this visitor? Only when Premium is actually
 * for sale on this site and they don't have it (before Stripe is set up, everything is free).
 */
export function usePremiumLock() {
  const a = useAccount();
  return { locked: a.loaded && a.premiumAvailable && !a.premium, loaded: a.loaded, account: a };
}
