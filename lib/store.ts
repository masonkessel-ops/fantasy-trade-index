import "server-only";

/**
 * Tiny key-value store for saved teams: Upstash Redis over its REST API
 * (free tier; add it in Vercel → Storage → Upstash for Redis). Works with
 * either the KV_* or UPSTASH_REDIS_REST_* variables Vercel injects.
 */
const url = () => (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim();
const token = () => (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

export const storeConfigured = () => !!(url() && token());

async function command<T>(cmd: string[]): Promise<T> {
  const res = await fetch(url(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!res.ok || data.error) throw new Error(data.error || `store_${res.status}`);
  return data.result as T;
}

const teamKey = (sub: string) => `team:${sub}`;

export async function loadTeam(sub: string): Promise<unknown | null> {
  const raw = await command<string | null>(["GET", teamKey(sub)]);
  return raw ? JSON.parse(raw) : null;
}

export async function saveTeam(sub: string, team: unknown) {
  await command(["SET", teamKey(sub), JSON.stringify(team)]);
}

export async function deleteTeam(sub: string) {
  await command(["DEL", teamKey(sub)]);
}
