/** Players within this many spots of each other (by trade value) can share a Keep · Trade · Cut round. */
const WINDOW = 9;

/** Three players of about the same value, from different teams. */
export function newRound<T extends { id: string; team: string | null }>(pool: T[], last: string[]): T[] {
  for (let tries = 0; tries < 50; tries++) {
    const i = Math.floor(Math.random() * pool.length);
    const lo = Math.max(0, i - WINDOW);
    const near = pool.slice(lo, Math.min(pool.length, i + WINDOW + 1)).filter((p) => p.id !== pool[i].id);
    const picks = [pool[i]];
    while (picks.length < 3 && near.length) picks.push(near.splice(Math.floor(Math.random() * near.length), 1)[0]);
    const teams = new Set(picks.map((p) => p.team));
    if (picks.length === 3 && teams.size === 3 && !picks.every((p) => last.includes(p.id))) return picks.sort(() => Math.random() - 0.5);
  }
  return pool.slice(0, 3);
}
