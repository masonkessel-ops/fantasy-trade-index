/**
 * Tiny in-memory cache with request de-duplication and stale-while-revalidate.
 * Sits on top of Next's fetch cache so we don't re-parse / re-trim large
 * Sleeper payloads on every request while a server instance is warm.
 */
type Entry = { value?: unknown; expires: number; pending?: Promise<unknown> };

const g = globalThis as unknown as { __trMemo?: Map<string, Entry> };
const store = (g.__trMemo ??= new Map<string, Entry>());

export function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = store.get(key);

  if (entry && entry.value !== undefined && entry.expires > now) {
    return Promise.resolve(entry.value as T);
  }
  if (entry?.pending) {
    // Serve stale data while a refresh is in flight.
    return entry.value !== undefined ? Promise.resolve(entry.value as T) : (entry.pending as Promise<T>);
  }

  const pending = fn()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .catch((err) => {
      if (entry?.value !== undefined) {
        // Keep serving the stale copy and retry soon.
        store.set(key, { value: entry.value, expires: Date.now() + 30_000 });
        return entry.value as T;
      }
      store.delete(key);
      throw err;
    });

  store.set(key, { value: entry?.value, expires: entry?.expires ?? 0, pending });
  return entry?.value !== undefined ? Promise.resolve(entry.value as T) : pending;
}
