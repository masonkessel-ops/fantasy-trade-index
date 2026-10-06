/**
 * The Trade Assistant's brain, with no AI: recognizes what kind of question
 * was asked (rules + the player names in it) and answers it with the site's
 * own math — trade values, the trade analyzer, the trade finder, lineups and
 * this week's projections. Pure module; runs in the browser.
 *
 * Returns null when it doesn't understand, so the caller can fall back to the
 * AI assistant (when an API key is set) or show example questions.
 */
import { playerRisk, tradeRiskReward } from "../risk";
import { SLOT_LABEL, analyzeTeam, bestLineup, type PositionStrength } from "../teamAnalysis";
import { FAIR_PERCENT, evaluateTrade, suggestBalancers } from "../tradeAnalysis";
import { findOffers, shopPlayers, type FinderIdea, type FinderPool } from "../tradeFinder";
import type { SavedTeam } from "../myTeam";
import type { PlayerValue, Position } from "../types";
import type { NameIndex, NameMatch } from "./names";

/* ================================ TYPES ================================== */

export interface WeekPts {
  actual: number | null;
  projected: number | null;
  state: "pre" | "live" | "final" | "bye";
  opponent: string | null;
}
export interface WeekData {
  week: number | null;
  points: Record<string, WeekPts>;
  plan: { week: number; points: Record<string, WeekPts> } | null;
}

export interface TradeCardData {
  title: string;
  subtitle?: string;
  give: string[];
  get: string[];
  partnerRosterId?: number | null;
  note?: string;
}

export type Block =
  | { kind: "player"; id: string }
  | { kind: "players"; ids: string[]; show: "value" | "change" }
  | { kind: "trades"; cards: TradeCardData[] }
  | { kind: "compare"; ids: string[]; week: number | null; proj: Record<string, number | null> | null }
  | { kind: "lineup"; week: number | null; slots: { slot: string; id: string | null; proj: number | null }[]; apply: string[] | null; gain: number }
  | { kind: "grades"; strengths: PositionStrength[] }
  | { kind: "link"; href: string; label: string };

export interface BotReply {
  text: string;
  blocks: Block[];
  suggestions: string[];
  /** players this answer was about, so "what about him?" works next */
  focus: string[];
}

export interface BotEnv {
  players: PlayerValue[];
  team: SavedTeam | null;
  names: NameIndex;
  loadWeek: (ids: string[]) => Promise<WeekData>;
}

/* =============================== HELPERS ================================= */

const DEFAULT_ROSTER = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"];
const OUT = new Set(["Out", "IR", "PUP", "Sus", "NA"]);
const POS_WORDS: Record<string, Position> = {
  qb: "QB", qbs: "QB", quarterback: "QB", quarterbacks: "QB",
  rb: "RB", rbs: "RB", running: "RB", runningbacks: "RB",
  wr: "WR", wrs: "WR", receiver: "WR", receivers: "WR", wideouts: "WR",
  te: "TE", tes: "TE", tight: "TE",
  k: "K", kicker: "K", kickers: "K",
  dst: "DST", def: "DST", defense: "DST", defenses: "DST", dsts: "DST",
};
const POS_PLURAL: Record<Position, string> = { QB: "QBs", RB: "RBs", WR: "WRs", TE: "TEs", K: "kickers", DST: "defenses" };

const r1 = (n: number) => Math.round(n * 10) / 10;
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;
const join = (xs: string[], word = "and") => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${word} ${xs[xs.length - 1]}`);
const names = (ps: PlayerValue[]) => join(ps.map((p) => p.name));
const bold = (ps: PlayerValue[]) => join(ps.map((p) => `**${p.name}**`));
const last = (p: PlayerValue) => (p.position === "DST" ? p.name : p.name.split(" ").slice(-1)[0]);

function lineupValue(roster: PlayerValue[], rp: string[]) {
  const s = bestLineup(roster, rp).starters;
  return { value: s.reduce((t, x) => t + (x.player?.value ?? 0), 0), empty: s.filter((x) => !x.player).map((x) => SLOT_LABEL[x.slot] ?? x.slot) };
}

/* ================================ ENGINE ================================= */

export async function answer(question: string, env: BotEnv, focus: string[]): Promise<BotReply | null> {
  const { players, team, names: index } = env;
  const board = new Map(players.map((p) => [p.id, p]));
  const resolve = (ids: string[]) => ids.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p);
  const mine = team ? resolve(team.playerIds).sort((a, b) => b.value - a.value) : [];
  const mineIds = new Set(team?.playerIds ?? []);
  const rp = team?.rosterPositions?.length ? team.rosterPositions : DEFAULT_ROSTER;
  const league = team?.league;
  const pools: FinderPool[] = league
    ? league.teams.filter((t) => t.rosterId !== league.myRosterId).map((t) => ({ rosterId: t.rosterId, teamName: t.teamName, roster: resolve(t.players) }))
    : [{ rosterId: null, teamName: "Any team", roster: players.filter((p) => !mineIds.has(p.id)) }];
  const ownerOf = (id: string) => pools.find((p) => p.rosterId !== null && p.roster.some((x) => x.id === id)) ?? null;

  const tokens = index.tokens(question);
  const low = ` ${tokens.join(" ")} `;
  const has = (re: RegExp) => re.test(low);

  let matches: NameMatch[] = index.find(question, mineIds);
  if (!matches.length && has(/ (him|he|his|hes|them|they|that guy|this guy|same guy|those guys) /) && focus.length) {
    matches = resolve(focus).map((player) => ({ player, alts: [], start: -1, end: -1 }));
  }
  const ps = matches.map((m) => m.player);

  // "Assumed Kyren Williams — did you mean …?"
  const ambiguity = matches
    .filter((m) => m.alts.length)
    .map((m) => `_I went with **${m.player.name}**. Did you mean ${join(m.alts.map((a) => a.name), "or")}?_`)
    .join("\n");
  const finish = (r: BotReply): BotReply => {
    if (ambiguity) {
      r.text += `\n\n${ambiguity}`;
      for (const m of matches) for (const a of m.alts.slice(0, 2)) r.suggestions.push(`What's ${a.name} worth?`);
    }
    r.suggestions = [...new Set(r.suggestions)].slice(0, 4);
    return r;
  };

  const needTeam = (what: string): BotReply => ({
    text: `To ${what}, I need your roster. Add your team on **My Team** (Sleeper, ESPN, Yahoo, a photo, paste, or by hand) and ask again.`,
    blocks: [{ kind: "link", href: "/my-team", label: "Add your team" }],
    suggestions: ["Top 10 RBs", "Who's rising?"],
    focus: ps.map((p) => p.id),
  });

  /* ----------------------------- help ------------------------------------ */
  if (!ps.length && has(/^ (hi|hey|hello|yo|sup|help|menu|commands|what can you do|how does this work|how do you work|what do you do) /)) {
    return helpReply(mine, players);
  }

  /* ------------------------ trade evaluation ----------------------------- */
  // "Walker for Puka", "should I trade A and B for C", "is A worth B"
  const sep = tokens.findIndex((w, i) => (w === "for" || w === "worth") && matches.some((m) => m.start >= 0 && m.end <= i) && matches.some((m) => m.start > i));
  if (sep >= 0) {
    let give = matches.filter((m) => m.end <= sep).map((m) => m.player);
    let get = matches.filter((m) => m.start > sep).map((m) => m.player);
    const firstName = matches[0].start;
    const before = ` ${tokens.slice(0, firstName).join(" ")} `;
    const flipVerb = /\b(get|acquire|buy|receive|land)\b/.test(before) && !/\b(give|trade|send|offer|deal|move)\b/.test(before);
    const flipRoster = !!team && give.every((p) => !mineIds.has(p.id)) && get.every((p) => mineIds.has(p.id));
    if (flipVerb || flipRoster) [give, get] = [get, give];
    return finish(tradeReply(give, get, tokens[sep] === "worth"));
  }

  /* ------------------------ "make me a trade" ---------------------------- */
  // "make me a trade with Walker and McBride", "build a trade for a QB", "give me trade ideas"
  const wantedPos = (tokens.join(" ").match(/\bfor (?:a |an |another |some |better |good |new )?(qbs?|rbs?|wrs?|tes?|kickers?|k|dst|def|defense|quarterback|running|receivers?|tight)\b/)?.[1] ?? null) as string | null;
  const pos = wantedPos ? POS_WORDS[wantedPos] : null;
  const makeTrade = has(/ (make|build|create|find|give|show|suggest|come up with|cook up|set up|need|want) (me )?(a |an |some |any |good |fair |better |new )*trades? /) || has(/ trade (ideas?|suggestions?) /);
  if (makeTrade || (pos && has(/ trade /))) {
    if (!team && !ps.length) return needTeam("build you a trade");
    if (!ps.length) return finish(targetReply(pos));
    const ours = ps.filter((p) => mineIds.has(p.id));
    const theirs = ps.filter((p) => !mineIds.has(p.id));
    if (team && ours.length && theirs.length) return finish(tradeReply(ours, theirs));
    if (team && !ours.length) return finish(acquireReply(theirs));
    return finish(shopReply(ps, pos));
  }

  /* --------------------- shop a player / get a player --------------------- */
  const acquireWords = / (trade for|what would it take|what will it take|what does it take|what it takes|how (do|can|could|would) i (get|land|acquire|trade for)|acquire|buy|go after|target|pry|should i offer|what (do|should) i offer|how much (for|to get)|i want|cost to get|get him) /;
  const shopWords = / (what (can|could|would|will|do) i get|get for|trade away|sell|shop|shopping|get rid of|dump|move|market for|what offers|any offers|trade value|whats he worth in a trade|deal) /;
  if (ps.length && has(acquireWords)) return finish(acquireReply(ps));
  if (ps.length && has(shopWords)) return finish(team && ps.every((p) => !mineIds.has(p.id)) && has(/ (get|trade for) /) ? acquireReply(ps) : shopReply(ps, pos));
  if (ps.length && has(/ (trade|trading|offer|deal) /) && !has(/ (worth|value) /)) {
    return finish(team && ps.every((p) => mineIds.has(p.id)) ? shopReply(ps, pos) : team ? acquireReply(ps) : shopReply(ps, pos));
  }

  /* ------------------------------ start / sit ----------------------------- */
  const startWords = / (start|starting|sit|sitting|play|playing|flex|bench|lineup|line up|who should i (start|play)|sit or start|start or sit) /;
  const bothMineOr = ps.length >= 2 && has(/ or /) && !!team && ps.every((p) => mineIds.has(p.id)) && !has(/ (worth|value|better in trades|dynasty|keep) /);
  if (has(startWords) || bothMineOr) {
    if (ps.length >= 2) return finish(await startSitReply(ps));
    if (ps.length === 1) return finish(await startOneReply(ps[0]));
    if (!team) return needTeam("set your best lineup");
    return finish(await lineupReply());
  }

  /* ------------------------------- compare -------------------------------- */
  if (ps.length >= 2) return finish(compareReply(ps));

  /* ------------------------------ rankings -------------------------------- */
  if (!ps.length && has(/ (riser|risers|rising|hot|heating up|trending up|on the rise|breakout|breakouts|up the most) /)) return finish(moversReply("up"));
  if (!ps.length && has(/ (faller|fallers|falling|cold|dropping|trending down|slumping|down the most|tanking) /)) return finish(moversReply("down"));
  if (!ps.length && has(/ buy low /)) return finish(buyLowReply());
  if (!ps.length && has(/ sell high /)) return finish(sellHighReply());
  if (!ps.length && has(/ (top|best|rank|ranks|ranking|rankings|leaders|highest|most valuable|list) /)) return finish(rankingsReply());

  /* -------------------------------- my team ------------------------------- */
  if (!ps.length && has(/ (who|what) should i (sell|trade away|get rid of|move) /)) return finish(sellHighReply());
  if (!ps.length && has(/ (who|what) (should|can) i (trade for|target|buy|get|go after) /)) {
    if (!team) return needTeam("find you a target");
    return finish(teamReply());
  }
  if (!ps.length && has(/ (my team|my roster|grade|grades|weak|weakest|weakness|strong|strongest|strength|need|needs|improve|upgrade|holes?|rate my|how good is my|how s my|hows my) /)) {
    if (!team) return needTeam("grade your team");
    return finish(teamReply());
  }

  /* ------------------------------ one player ------------------------------ */
  if (ps.length === 1) return finish(playerReply(ps[0]));

  return null;

  /* ================================ ANSWERS ================================ */

  function tradeReply(give: PlayerValue[], get: PlayerValue[], asWorth = false): BotReply {
    const r = evaluateTrade(give, get);
    const rr = tradeRiskReward(give, get);
    const pct = Math.round(Math.abs(r.balance) * 100);
    const w = `${Math.round(r.adjGive)} trade weight out, ${Math.round(r.adjGet)} in`;
    let text: string;
    // "Is A worth B?" reads as a yes/no question about value.
    if (asWorth && r.verdict === "fair") text = `**Yes, they're about even** (${Math.round(r.adjGive)} vs ${Math.round(r.adjGet)} trade weight).`;
    else if (asWorth && r.verdict === "win") text = `**No.** ${names(give)} ${give.length > 1 ? "are" : "is"} worth about ${pct}% less than ${names(get)} in trades (${Math.round(r.adjGive)} vs ${Math.round(r.adjGet)} trade weight).`;
    else if (asWorth) text = `**Yes, and then some.** ${names(get)} ${get.length > 1 ? "are" : "is"} worth about ${pct}% less than ${names(give)} in trades (${Math.round(r.adjGet)} vs ${Math.round(r.adjGive)} trade weight).`;
    else if (r.verdict === "fair") text = pct < 3 ? `**Fair trade, dead even** (${w}).` : `**Fair trade**, ${pct}% ${r.balance > 0 ? "in your favor" : "in their favor"} (${w}). Close enough that both sides could say yes.`;
    else if (r.verdict === "win") text = `**You win this one by ${pct}%** (${w}). The other team will probably say no as it stands.`;
    else text = `**You'd be overpaying by ${pct}%** (${w}).`;
    if (r.verdict === "win" && get.length === 1 && give.length >= 2) text += ` Stars cost a premium: ${give.length} mid-level players don't add up to ${get[0].name}.`;
    if (r.verdict === "lose" && give.length === 1 && get.length >= 2) text += ` You're giving the best player in the deal, which is worth more than the sum of the parts.`;
    if (rr) text += `\n\nRisk vs reward: **${rr.rating}** (${rr.summary}).`;

    if (team && give.every((p) => mineIds.has(p.id))) {
      const before = lineupValue(mine, rp);
      const afterRoster = [...mine.filter((p) => !give.includes(p)), ...get];
      const after = lineupValue(afterRoster, rp);
      text += `\n\nYour starting lineup: **${signed(Math.round(after.value - before.value))}** value.`;
      const newHole = after.empty.find((x) => !before.empty.includes(x));
      if (after.empty.length > before.empty.length) text += ` Careful: it leaves your **${newHole ?? after.empty[0]}** spot empty.`;
      if (get.length > give.length) text += ` You'd have to drop ${get.length - give.length} bench player${get.length - give.length > 1 ? "s" : ""}.`;
    }

    const cards: TradeCardData[] = [{ title: "This trade", subtitle: pct < 3 ? "Dead even" : `${pct}% ${r.balance > 0 ? "your way" : "their way"}`, give: give.map((p) => p.id), get: get.map((p) => p.id), partnerRosterId: ownerOf(get[0].id)?.rosterId }];
    if (r.verdict !== "fair") {
      const partner = ownerOf(get[0].id);
      const bal = suggestBalancers(give, get, { give: mine.length ? mine : players, get: partner ? partner.roster : players }, 2);
      if (bal.length) {
        const b = bal[0];
        text += `\n\nTo make it fair, ${b.side === "give" ? `add **${b.player.name}** (${b.player.value}) to your side` : `ask for **${b.player.name}** (${b.player.value}) too`}.`;
        for (const x of bal) {
          const g = x.side === "give" ? [...give, x.player] : give;
          const t = x.side === "get" ? [...get, x.player] : get;
          cards.push({ title: "Make it fair", subtitle: `${x.side === "give" ? "Add" : "Ask for"} ${x.player.name}`, give: g.map((p) => p.id), get: t.map((p) => p.id), partnerRosterId: partner?.rosterId });
        }
      }
    }
    return {
      text,
      blocks: [{ kind: "trades", cards }],
      suggestions: [`What can I get for ${give[0].name}?`, `What would it take to get ${get[0].name}?`, `${give[0].name} vs ${get[0].name}`],
      focus: [...give, ...get].map((p) => p.id),
    };
  }

  function ideaCard(i: FinderIdea, fallback: string): TradeCardData {
    const pct = Math.round(Math.abs(i.balance) * 100);
    const notes = [`${signed(i.lineupGain)} to your starting lineup${i.theirGain !== null ? `, ${signed(i.theirGain)} to theirs` : ""}.`];
    if (i.rosterChange > 0) notes.push(`You'd drop ${i.rosterChange} bench player${i.rosterChange > 1 ? "s" : ""}.`);
    if (i.theirConcern) notes.push(i.theirConcern);
    return {
      title: i.partner?.teamName ?? fallback,
      subtitle: pct < 3 ? "Dead-even value" : i.balance > 0 ? `${pct}% in your favor` : `You pay ${pct}% extra`,
      give: i.give,
      get: i.get,
      partnerRosterId: i.partner?.rosterId,
      note: notes.join(" "),
    };
  }

  function shopReply(xs: PlayerValue[], wantPos: Position | null = null): BotReply {
    const notMine = team ? xs.filter((p) => !mineIds.has(p.id)) : [];
    const myRoster = team ? [...mine, ...notMine] : xs;
    // "trade Walker for a WR": only look at that position on the other side.
    const usePools = pools.map((p) => ({ ...p, roster: p.roster.filter((x) => !xs.includes(x) && (!wantPos || x.position === wantPos)) }));
    const ideas = shopPlayers(xs, myRoster, usePools, rp, 6);
    const weight = Math.round(evaluateTrade(xs, xs).adjGive);
    const forPos = wantPos ? ` for a ${wantPos === "DST" ? "defense" : wantPos}` : "";
    let text = ideas.length
      ? `Fair trades for ${bold(xs)}${forPos} (${weight} trade weight)${league ? ` with teams in ${league.name}` : ""}, best fits first:`
      : `I couldn't find a fair deal for ${bold(xs)}${forPos} that keeps both lineups full. Try adding another player, or ask what a specific player would cost.`;
    if (notMine.length) text = `${bold(notMine)} ${notMine.length > 1 ? "aren't" : "isn't"} on your team, but here's what ${notMine.length > 1 ? "they'd" : "he'd"} fetch:\n\n${text}`;
    return {
      text,
      blocks: [
        ...(ideas.length ? [{ kind: "trades" as const, cards: ideas.map((i) => ideaCard(i, "Trade idea")) }] : []),
        { kind: "link", href: `/trade-finder?away=${xs.map((p) => p.id).join(",")}`, label: "Open in Trade Finder" },
      ],
      suggestions: [`What's ${xs[0].name} worth?`, ...(team ? ["Grade my team"] : []), `Top 10 ${POS_PLURAL[xs[0].position]}`],
      focus: xs.map((p) => p.id),
    };
  }

  /** "Make me a trade" with no players named: fair offers for realistic upgrades at a position (your weakest by default). */
  function targetReply(wantPos: Position | null): BotReply {
    const teams = league?.totalRosters ?? 12;
    const target = wantPos ?? analyzeTeam(mine, players, rp, teams).weakest?.position ?? "RB";
    const myBest = mine.find((p) => p.position === target);
    const cands = pools
      .flatMap((p) => p.roster)
      .filter((p) => p.position === target && p.value >= (myBest?.value ?? 0) + 5)
      .sort((a, b) => a.value - b.value)
      .slice(0, 10);
    const seen = new Set<string>();
    const ideas = cands
      .flatMap((c) => findOffers([c], mine, rp, ownerOf(c.id), 2))
      .sort((a, b) => b.lineupGain - a.lineupGain || b.balance - a.balance)
      .filter((i) => {
        const k = i.get.join();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 6);
    const label = target === "DST" ? "defense" : target;
    const why = wantPos ? "" : ` That's your weakest spot right now.`;
    const text = ideas.length
      ? `Here are fair trades that upgrade your **${label}**${myBest ? ` (now ${myBest.name}, ${myBest.value})` : ""}, biggest lineup boost first.${why}`
      : `I couldn't find a fair trade that upgrades your ${label} without leaving a hole in your lineup. Try naming players you'd give up, like "make me a trade with Walker and Rice".`;
    return {
      text,
      blocks: ideas.length ? [{ kind: "trades", cards: ideas.map((i) => ideaCard(i, "Trade idea")) }] : [],
      suggestions: [...(mine[0] ? [`Make me a trade with ${mine[0].name}`] : []), ...(["QB", "RB", "WR", "TE"] as Position[]).filter((p) => p !== target).slice(0, 2).map((p) => `Make me a trade for a ${p}`)],
      focus: ideas.flatMap((i) => i.get).slice(0, 1),
    };
  }

  function acquireReply(xs: PlayerValue[]): BotReply {
    const targets = xs.filter((p) => !mineIds.has(p.id));
    if (team && !targets.length) {
      return { ...shopReply(xs), text: `${bold(xs)} ${xs.length > 1 ? "are" : "is"} already on your team. Here's what ${xs.length > 1 ? "they'd" : "he'd"} fetch instead:\n\n${shopReply(xs).text}` };
    }
    if (!team) {
      const x = xs[0];
      const similar = players
        .filter((p) => p.id !== x.id && Math.abs(p.power - x.power) <= Math.max(1.5, x.power * FAIR_PERCENT))
        .sort((a, b) => Math.abs(a.power - x.power) - Math.abs(b.power - x.power))
        .slice(0, 6);
      return {
        text: `Add your team and I'll build offers for ${bold(xs)} from your actual roster. For reference, these players are worth about the same as ${last(x)} one-for-one:`,
        blocks: [{ kind: "players", ids: similar.map((p) => p.id), show: "value" }, { kind: "link", href: "/my-team", label: "Add your team" }],
        suggestions: [`What's ${x.name} worth?`, `Top 10 ${POS_PLURAL[x.position]}`],
        focus: xs.map((p) => p.id),
      };
    }
    const owner = ownerOf(targets[0].id);
    const ideas = findOffers(targets, mine, rp, owner, 5);
    const text = ideas.length
      ? `To get ${bold(targets)}${owner ? ` from **${owner.teamName}**` : ""}, these offers are fair and keep your lineup full:`
      : `Nothing on your roster makes a fair offer for ${bold(targets)} without leaving a hole in your lineup. Try a cheaper target, or ask what your best players can get.`;
    return {
      text,
      blocks: [
        ...(ideas.length ? [{ kind: "trades" as const, cards: ideas.map((i) => ideaCard(i, "Offer")) }] : []),
        { kind: "link", href: `/trade-finder?want=${targets.map((p) => p.id).join(",")}`, label: "Open in Trade Finder" },
      ],
      suggestions: [`What's ${targets[0].name} worth?`, ...(mine[0] ? [`What can I get for ${mine[0].name}?`] : [])],
      focus: targets.map((p) => p.id),
    };
  }

  async function planPoints(ids: string[]) {
    const wk = await env.loadWeek(ids);
    const plan = wk.plan ?? { week: wk.week ?? 0, points: wk.points };
    const proj = (p: PlayerValue) => {
      const w = plan.points[p.id];
      if (!w || w.state === "bye" || (p.injuryStatus && OUT.has(p.injuryStatus))) return 0;
      return w.projected ?? 0;
    };
    return { week: plan.week || null, points: plan.points, proj };
  }

  async function startSitReply(xs: PlayerValue[]): Promise<BotReply> {
    const { week, points, proj } = await planPoints(xs.map((p) => p.id));
    const rows = xs.map((p) => ({ p, v: proj(p), w: points[p.id] })).sort((a, b) => b.v - a.v || b.p.rosPpg - a.p.rosPpg);
    const [a, b] = rows;
    const why = (x: (typeof rows)[number]) =>
      x.w?.state === "bye" ? "on bye" : x.p.injuryStatus && OUT.has(x.p.injuryStatus) ? `listed ${x.p.injuryStatus}` : `${r1(x.v)} projected${x.w?.opponent ? ` ${x.w.opponent}` : ""}`;
    let text = `**Start ${a.p.name}** (${why(a)}) over ${b.p.name} (${why(b)})${week ? ` in week ${week}` : ""}.`;
    if (rows.length > 2) text += ` Then ${join(rows.slice(2).map((x) => `${x.p.name} (${why(x)})`))}.`;
    if (a.v - b.v < 1 && a.w?.state !== "bye" && b.w?.state !== "bye") text += ` It's close, so the tiebreaker is rest-of-season form: ${a.p.name} averages ${a.p.rosPpg} projected PPG to ${b.p.name}'s ${b.p.rosPpg}.`;
    const injured = rows.filter((x) => x.p.injuryStatus && !OUT.has(x.p.injuryStatus));
    if (injured.length) text += ` Keep an eye on ${join(injured.map((x) => `${x.p.name} (${x.p.injuryStatus})`))}.`;
    return {
      text,
      blocks: [{ kind: "compare", ids: rows.map((x) => x.p.id), week, proj: Object.fromEntries(rows.map((x) => [x.p.id, r1(x.v)])) }],
      suggestions: team ? ["Who should I start this week?", `What can I get for ${b.p.name}?`] : [`${a.p.name} vs ${b.p.name}`],
      focus: rows.map((x) => x.p.id),
    };
  }

  async function startOneReply(p: PlayerValue): Promise<BotReply> {
    if (!team || !mineIds.has(p.id)) {
      const { week, points, proj } = await planPoints([p.id]);
      const w = points[p.id];
      return {
        text:
          w?.state === "bye"
            ? `${p.name} is **on bye**${week ? ` in week ${week}` : ""}.`
            : `${p.name} is projected **${r1(proj(p))} points**${week ? ` in week ${week}` : ""}${w?.opponent ? ` (${w.opponent})` : ""}.${team ? " He isn't on your team, though." : ""}`,
        blocks: [{ kind: "player", id: p.id }],
        suggestions: [`What's ${p.name} worth?`],
        focus: [p.id],
      };
    }
    const { week, points, proj } = await planPoints(team.playerIds);
    const best = bestLineup(mine, rp, (x) => proj(x) + x.value / 1000).starters;
    const starts = best.some((s) => s.player?.id === p.id);
    const w = points[p.id];
    let text: string;
    if (w?.state === "bye") text = `**Sit ${p.name}**: he's on bye${week ? ` in week ${week}` : ""}.`;
    else if (p.injuryStatus && OUT.has(p.injuryStatus)) text = `**Sit ${p.name}**: he's listed ${p.injuryStatus}.`;
    else if (starts) text = `**Yes, start ${p.name}.** He's projected ${r1(proj(p))}${w?.opponent ? ` ${w.opponent}` : ""}${week ? ` in week ${week}` : ""}, which earns him a spot in your best lineup.`;
    else {
      const rivals = best.filter((s) => s.player && s.player.position === p.position).map((s) => s.player!);
      text = `**Sit ${p.name}** this week (${r1(proj(p))} projected). Your best lineup starts ${rivals.length ? join(rivals.map((x) => `${x.name} (${r1(proj(x))})`)) : "others"} ahead of him.`;
    }
    return {
      text,
      blocks: [],
      suggestions: ["Who should I start this week?", `What can I get for ${p.name}?`],
      focus: [p.id],
    };
  }

  async function lineupReply(): Promise<BotReply> {
    const { week, proj } = await planPoints(team!.playerIds);
    const score = (x: PlayerValue) => proj(x) + x.value / 1000;
    const best = bestLineup(mine, rp, score).starters;
    const bestIds = best.map((s) => s.player?.id).filter((id): id is string => !!id);
    const record = league?.teams.find((t) => t.rosterId === league.myRosterId);
    const auto = team!.autoLineup !== false;
    const current = auto ? bestIds : (team!.starters ?? (record?.starters?.length ? record.starters : bestLineup(mine, rp).starters.map((s) => s.player?.id).filter((id): id is string => !!id)));
    const total = (ids: string[]) => r1(resolve(ids).reduce((s, x) => s + proj(x), 0));
    const gain = r1(total(bestIds) - total(current));
    const ins = resolve(bestIds.filter((id) => !current.includes(id)));
    const outs = resolve(current.filter((id) => !bestIds.includes(id)));
    const same = !ins.length && !outs.length;
    const text = same
      ? `${auto ? "Auto lineup is on, so your" : "Your"} lineup is already the best one${week ? ` for week ${week}` : ""}: **${total(bestIds)} projected points**.`
      : `Your best lineup${week ? ` for week ${week}` : ""} projects **${total(bestIds)} points**, ${gain > 0 ? `${gain} more than` : "the same as"} your current one. Start ${bold(ins)}; sit ${bold(outs)}.`;
    return {
      text,
      blocks: [{ kind: "lineup", week, slots: best.map((s) => ({ slot: s.slot, id: s.player?.id ?? null, proj: s.player ? r1(proj(s.player)) : null })), apply: same ? null : bestIds, gain }],
      suggestions: ["Grade my team", ...(mine[0] ? [`What can I get for ${mine[0].name}?`] : [])],
      focus: [],
    };
  }

  function compareReply(xs: PlayerValue[]): BotReply {
    const sorted = [...xs].sort((a, b) => b.power - a.power);
    const [a, b] = sorted;
    const gap = Math.round((a.power / Math.max(0.1, b.power) - 1) * 100);
    let text =
      gap <= FAIR_PERCENT * 100
        ? `**${a.name}** (${a.value}) and **${b.name}** (${b.value}) are about even in trade value.`
        : `**${a.name}** (${a.value}, ${a.position}${a.posRank}) is worth about **${gap}% more** in trades than **${b.name}** (${b.value}, ${b.position}${b.posRank}).`;
    const ros = [...xs].sort((x, y) => y.rosPpg - x.rosPpg);
    if (ros[0].id !== a.id) text += ` But for points the rest of the season, **${ros[0].name}** projects higher (${ros[0].rosPpg} vs ${ros[1].rosPpg} per game).`;
    else text += ` ${a.name} also projects more points the rest of the way (${a.rosPpg} vs ${ros[1].rosPpg} per game).`;
    return {
      text,
      blocks: [{ kind: "compare", ids: sorted.map((p) => p.id), week: null, proj: null }],
      suggestions: [`${b.name} for ${a.name}?`, `What's ${a.name} worth?`],
      focus: sorted.map((p) => p.id),
    };
  }

  function rankingsReply(): BotReply {
    const pos = tokens.map((t) => POS_WORDS[t]).find(Boolean) ?? null;
    const n = Math.min(25, Math.max(3, Number(tokens.find((t) => /^\d{1,2}$/.test(t)) ?? 10)));
    const list = players.filter((p) => !pos || p.position === pos).slice().sort((a, b) => b.value - a.value).slice(0, n);
    return {
      text: `Top ${n} ${pos ? POS_PLURAL[pos] : "players"} by trade value:`,
      blocks: [{ kind: "players", ids: list.map((p) => p.id), show: "value" }],
      suggestions: [`${list[0].name} vs ${list[1].name}`, "Who's rising?", "Buy low candidates"],
      focus: list.slice(0, 2).map((p) => p.id),
    };
  }

  function moversReply(dir: "up" | "down"): BotReply {
    const list = players
      .filter((p) => p.change !== null && (dir === "up" ? p.change > 0 : p.change < 0) && p.value >= 50)
      .sort((a, b) => (dir === "up" ? b.change! - a.change! : a.change! - b.change!))
      .slice(0, 8);
    return {
      text: list.length ? `Biggest value ${dir === "up" ? "risers" : "fallers"} this week:` : "No big movers yet this week.",
      blocks: list.length ? [{ kind: "players", ids: list.map((p) => p.id), show: "change" }] : [],
      suggestions: [dir === "up" ? "Sell high candidates" : "Buy low candidates", dir === "up" ? "Who's falling?" : "Who's rising?"],
      focus: list.slice(0, 1).map((p) => p.id),
    };
  }

  function buyLowReply(): BotReply {
    const list = players
      .filter((p) => p.change !== null && p.change <= -2 && p.value >= 65 && p.rosPpg >= p.ppg * 0.95 && !mineIds.has(p.id))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    return {
      text: list.length
        ? "**Buy low:** their trade value dropped lately, but their rest-of-season projections still hold up. Good time to make an offer."
        : "No clear buy-low targets right now.",
      blocks: list.length ? [{ kind: "players", ids: list.map((p) => p.id), show: "change" }] : [],
      suggestions: [...(list[0] ? [`What would it take to get ${list[0].name}?`] : []), "Sell high candidates"],
      focus: list.slice(0, 1).map((p) => p.id),
    };
  }

  function sellHighReply(): BotReply {
    const hot = (p: PlayerValue) => p.change !== null && p.change >= 1 && p.recentPpg !== null && p.recentPpg > p.rosPpg * 1.15 && p.value >= 55;
    const pool = team ? mine.filter(hot) : [];
    const list = (pool.length ? pool : players.filter(hot)).sort((a, b) => b.change! - a.change!).slice(0, 8);
    return {
      text: list.length
        ? `**Sell high${pool.length ? " (on your team)" : ""}:** they've been hot lately, but projections expect them to cool off. Their value may never be higher.`
        : "No clear sell-high candidates right now.",
      blocks: list.length ? [{ kind: "players", ids: list.map((p) => p.id), show: "change" }] : [],
      suggestions: [...(list[0] ? [`What can I get for ${list[0].name}?`] : []), "Buy low candidates"],
      focus: list.slice(0, 1).map((p) => p.id),
    };
  }

  function teamReply(): BotReply {
    const teams = league?.totalRosters ?? 12;
    const a = analyzeTeam(mine, players, rp, teams);
    const weak = a.weakest;
    const strong = a.strongest;
    let text = `Here's your team by position, compared with an average starter in a ${teams}-team league.`;
    const sugg: string[] = [];
    if (weak) {
      text += ` **Biggest need: ${weak.position}** (${weak.grade}, ${Math.round(weak.ratio * 100)}% of average).`;
      const myBest = mine.find((p) => p.position === weak.position)?.value ?? 0;
      const target = pools
        .flatMap((p) => p.roster)
        .filter((p) => p.position === weak.position && p.value >= myBest + 8)
        .sort((x, y) => x.value - y.value)[0];
      if (target) sugg.push(`What would it take to get ${target.name}?`);
    }
    if (strong && strong !== weak) {
      text += ` **Strength: ${strong.position}** (${strong.grade}). That's where to trade from.`;
      const depth = mine.filter((p) => p.position === strong.position);
      const chip = depth[1] ?? depth[0];
      if (chip) sugg.push(`What can I get for ${chip.name}?`);
    }
    sugg.push("Who should I start this week?");
    return { text, blocks: [{ kind: "grades", strengths: a.strengths }], suggestions: sugg, focus: [] };
  }

  function playerReply(p: PlayerValue): BotReply {
    const risk = playerRisk(p);
    const dst = p.position === "DST";
    const [he, his] = dst ? ["They're", "Their"] : ["He's", "His"];
    let text = "";
    if (has(/ (injur|injury|injured|hurt|healthy|health|status|questionable|doubtful|ruled out) /)) {
      text = p.injuryStatus ? `**${p.name} is listed ${p.injuryStatus}.** ` : `**${p.name} has no injury designation** right now. `;
    }
    text += `**${p.name}** (${p.position} · ${p.team ?? "FA"}) has a trade value of **${p.value}**: ${p.position}${p.posRank}, #${p.overallRank} overall${p.marketRank ? `, #${p.marketRank} in the trade market` : ""}.`;
    text += ` ${he} averaging ${p.ppg} PPG${p.recentPpg !== null ? ` (${p.recentPpg} over the last 3)` : ""} and projected for ${p.rosPpg} per game the rest of the way.`;
    if (p.change) text += ` ${his} value is ${p.change > 0 ? "up" : "down"} ${Math.abs(p.change)} this week.`;
    if (p.injuryStatus && !text.startsWith(`**${p.name} is listed`)) text += ` Injury: **${p.injuryStatus}**.`;
    if (risk.level !== "Low") text += ` Risk: ${risk.level.toLowerCase()} (${risk.reasons.join(", ")}).`;
    const isMine = mineIds.has(p.id);
    return {
      text,
      blocks: [{ kind: "player", id: p.id }],
      suggestions: isMine ? [`What can I get for ${p.name}?`, `Should I start ${p.name}?`] : [`What would it take to get ${p.name}?`, `Top 10 ${POS_PLURAL[p.position]}`],
      focus: [p.id],
    };
  }
}

/* ================================= HELP ================================== */

export function helpReply(mine: PlayerValue[], players: PlayerValue[]): BotReply {
  const star = mine[0] ?? players[3];
  const target = players.find((p) => !mine.includes(p) && p.position === "WR") ?? players[0];
  const other = players.find((p) => p.position === star.position && p.id !== star.id && p.value <= star.value) ?? players[5];
  return {
    text: "I answer instantly from live trade values" + (mine.length ? " and your roster" : "") + ". No AI needed. Ask me things like:",
    blocks: [],
    suggestions: [`${star.name} for ${target.name}?`, `What can I get for ${star.name}?`, `What would it take to get ${target.name}?`, mine.length ? "Who should I start this week?" : `${star.name} vs ${other.name}`],
    focus: [],
  };
}

/** "What can I ask?" */
export const HELP_TEXT = `Type any fantasy question and I'll answer from the numbers. I can:
- **Check a trade:** "Walker for Puka?", "Is Watson worth JSN?"
- **Make you a trade:** "Make me a trade with Walker and Rice", "Make me a trade for a QB", "Trade Walker for a WR"
- **Shop a player or find a price:** "What can I get for McBride?", "What would it take to get Gibbs?"
- **Set your lineup:** "Who should I start?", "Start Diggs or McConkey?", "Should I start Stafford?"
- **Value and compare players:** "What's Bijan worth?", "Bijan vs Gibbs", "Is McBride hurt?"
- **Rankings and trends:** "Top 10 WRs", "Who's rising?", "Buy low", "Sell high"
- **Your team:** "Grade my team", "What's my weakest spot?"`;

export const EXAMPLES = [
  "Make me a trade",
  "Make me a trade with Walker and Rice",
  "Walker for Puka?",
  "What can I get for McBride?",
  "What would it take to get Gibbs?",
  "Start Diggs or McConkey?",
  "Who should I start this week?",
  "What's Bijan worth?",
  "Top 10 WRs",
  "Grade my team",
  "Who's rising?",
  "Buy low candidates",
];
