"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A small JSON value kept in this browser's localStorage, shared by every
 * component that reads the same key (and other tabs). `null` until it has
 * been read on the client, or when nothing is stored yet.
 */
const EVENT = "fti-local-store";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function readRaw(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored<T>(key: string, value: T | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage full: the value just won't persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function readStored<T>(key: string): T | null {
  const raw = readRaw(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const cache = new Map<string, { raw: string | null; value: unknown }>();

/** [value, setValue, hydrated] for a JSON value in localStorage. */
export function useStored<T>(key: string): [T | null, (v: T | null) => void, boolean] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key) ?? "",
    () => "__ssr__",
  );
  const hydrated = raw !== "__ssr__";
  let value: T | null = null;
  if (hydrated && raw) {
    const hit = cache.get(key);
    if (hit && hit.raw === raw) value = hit.value as T;
    else {
      try {
        value = JSON.parse(raw) as T;
      } catch {
        value = null;
      }
      cache.set(key, { raw, value });
    }
  }
  const set = useCallback((v: T | null) => writeStored(key, v), [key]);
  return [value, set, hydrated];
}
