/**
 * Finds the players mentioned in a typed question, with no AI:
 * full names, last names ("mcbride"), distinctive first names ("bijan"),
 * common nicknames ("jsn", "cmc"), team defenses ("seahawks"), and small typos.
 * Pure module, runs in the browser.
 */
import { normalizeName } from "../playerMatch";
import type { PlayerValue } from "../types";

/** Nickname -> full name (both normalized). Only used when that player is on the chart. */
const NICKNAMES: Record<string, string> = {
  jsn: "jaxon smith njigba",
  cmc: "christian mccaffrey",
  arsb: "amon ra st brown",
  "amon ra": "amon ra st brown",
  "st brown": "amon ra st brown",
  jj: "justin jefferson",
  jet: "justin jefferson",
  mhj: "marvin harrison",
  btj: "brian thomas",
  tmac: "tetairoa mcmillan",
  jt: "jonathan taylor",
  dk: "dk metcalf",
  ajb: "aj brown",
  "aj brown": "aj brown",
  hollywood: "marquise brown",
  "k9": "kenneth walker",
  "kw3": "kenneth walker",
  "the bijan": "bijan robinson",
  lamar: "lamar jackson",
  mahomes: "patrick mahomes",
  josh: "josh allen",
  burrow: "joe burrow",
  "sauce": "breece hall",
  ceedee: "ceedee lamb",
  deebo: "deebo samuel",
  tyreek: "tyreek hill",
  kelce: "travis kelce",
  ekeler: "austin ekeler",
  "puka nacua": "puka nacua",
  "ja marr": "jamarr chase",
  jamarr: "jamarr chase",
};

/** Words that are also player names but mean something else in a question. */
const STOPWORDS = new Set(
  `a an i me my mine the for and or to of is it its in on at be do does did get got give gave trade trades trading start starting sit sitting bench flex play
  playing who whos what whats how hows much many worth value values best top good bad better worse will would should could can cant love young hot cold
  high low buy sell week weeks season team teams points point proj projection players player rb rbs wr wrs qb qbs te tes k dst def defense defenses kicker
  him he his them they their about think now really need needs want wants than this that next last rest ros dynasty keeper fair deal deals offer offers
  ok okay yes no yeah nah hi hey hello thanks thank please pls plz you your yours we our us vs versus or over under more less up down right left any
  some all every each both either one two three four five ten be been being was were are am if then so but because just only also too very lol bro
  trade away for from with without into onto off out in rank ranks ranking rankings list show tell me info stats stat news injury injured hurt status
  set lineup lineups line roster rosters grade grades weak weakest strong strongest upgrade improve help jarvis man guy guys dude chase hill hall cook
  price mason power strong white pierce moore jones davis smith johnson williams brown allen young love will`
    .split(/\s+/)
    .filter(Boolean),
);
// These are real surnames people type alone; allow them even though they're common words.
for (const w of ["chase", "hill", "hall", "cook", "moore", "jones", "davis", "smith", "johnson", "williams", "brown", "allen", "pierce", "white", "price"]) STOPWORDS.delete(w);

export interface NameMatch {
  player: PlayerValue;
  /** other players the words could mean (e.g. "williams") */
  alts: PlayerValue[];
  /** token positions in the normalized question */
  start: number;
  end: number;
}

export interface NameIndex {
  find(text: string, prefer?: Set<string>): NameMatch[];
  tokens(text: string): string[];
}

function lev(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const add = (m: Map<string, PlayerValue[]>, k: string, p: PlayerValue) => {
  const list = m.get(k);
  if (!list) m.set(k, [p]);
  else if (!list.includes(p)) list.push(p);
};

export function buildNameIndex(players: PlayerValue[]): NameIndex {
  const full = new Map<string, PlayerValue[]>();
  const last = new Map<string, PlayerValue[]>();
  const first = new Map<string, PlayerValue[]>();
  const fuzzyPool: { key: string; p: PlayerValue }[] = [];
  const byValue = [...players].sort((a, b) => b.value - a.value);

  for (const p of byValue) {
    const n = normalizeName(p.name);
    const t = n.split(" ");
    add(full, n, p);
    if (p.position === "DST") {
      // "Seattle Seahawks": "seahawks", "seattle", "sea", plus "... defense/dst/d"
      const nick = t[t.length - 1];
      const city = t.slice(0, -1).join(" ");
      for (const k of [nick, city, (p.team ?? "").toLowerCase()]) {
        if (!k) continue;
        for (const suffix of ["defense", "dst", "d", "def", "d st"]) add(full, `${k} ${suffix}`, p);
      }
      add(last, nick, p);
      continue;
    }
    if (t.length >= 2) {
      add(last, t[t.length - 1], p);
      if (t.length >= 3) add(full, t.slice(1).join(" "), p); // multi-word surnames: "smith njigba", "st brown"
      add(first, t[0], p);
      add(full, `${t[0][0]} ${t.slice(1).join(" ")}`, p); // "j gibbs"
      add(full, `${t[0][0]}${t.slice(1).join(" ")}`, p); // "jgibbs"
    }
    if (fuzzyPool.length < 350) {
      fuzzyPool.push({ key: n, p });
      if (t.length >= 2) fuzzyPool.push({ key: t[t.length - 1], p });
    }
  }
  for (const [nick, name] of Object.entries(NICKNAMES)) {
    const ps = full.get(name);
    if (ps) for (const p of ps) add(full, nick, p);
  }

  const tokens = (text: string) =>
    normalizeName(text.replace(/[?!,;:()"]/g, " ").replace(/\+/g, " and ").replace(/&/g, " and ").replace(/\//g, " "))
      .split(" ")
      .filter(Boolean);

  function rank(list: PlayerValue[], prefer?: Set<string>) {
    return [...list].sort((a, b) => Number(prefer?.has(b.id) ?? 0) - Number(prefer?.has(a.id) ?? 0) || b.value - a.value);
  }

  function lookup(phrase: string, n: number): PlayerValue[] | null {
    const exact = full.get(phrase);
    if (exact) return exact;
    if (n !== 1) return null;
    if (phrase.length < 3 || STOPWORDS.has(phrase)) return null;
    const l = last.get(phrase) ?? (phrase.endsWith("s") ? last.get(phrase.slice(0, -1)) : undefined);
    if (l) return l;
    const f = first.get(phrase);
    if (f && f.length === 1 && phrase.length >= 4) return f;
    return null;
  }

  function fuzzy(phrase: string, n: number): PlayerValue[] | null {
    if (phrase.replace(/ /g, "").length < 5 || (n === 1 && STOPWORDS.has(phrase))) return null;
    const max = phrase.length >= 8 ? 2 : 1;
    let best: { d: number; ps: PlayerValue[] } | null = null;
    for (const { key, p } of fuzzyPool) {
      if ((n === 1) !== !key.includes(" ")) continue;
      const d = lev(phrase, key, max);
      if (d > max) continue;
      if (!best || d < best.d) best = { d, ps: [p] };
      else if (d === best.d && !best.ps.includes(p)) best.ps.push(p);
    }
    return best?.ps ?? null;
  }

  function find(text: string, prefer?: Set<string>): NameMatch[] {
    const t = tokens(text);
    const out: NameMatch[] = [];
    let i = 0;
    while (i < t.length) {
      let hit: NameMatch | null = null;
      for (const pass of ["exact", "fuzzy"] as const) {
        for (let n = Math.min(4, t.length - i); n >= 1 && !hit; n--) {
          const phrase = t.slice(i, i + n).join(" ");
          const ps = pass === "exact" ? lookup(phrase, n) : n <= 2 ? fuzzy(phrase, n) : null;
          if (ps?.length) {
            const [player, ...alts] = rank(ps, prefer);
            hit = { player, alts: alts.slice(0, 3), start: i, end: i + n };
          }
        }
        if (hit) break;
      }
      if (hit) {
        if (!out.some((m) => m.player.id === hit!.player.id)) out.push(hit);
        i = hit.end;
      } else i++;
    }
    return out;
  }

  return { find, tokens };
}
