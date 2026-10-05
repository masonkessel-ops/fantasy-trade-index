"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowLeftRight, Check, Link2, Plus, RotateCcw, Scale, Users, X } from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { PlayerSearch } from "@/components/PlayerSearch";
import { InjuryTag, PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import { useMyTeam } from "@/lib/myTeam";
import { TradeFinder } from "../my-team/TradeFinder";
import { edgeLabel, evaluateTrade, suggestBalancers, type TradeResult } from "@/lib/tradeAnalysis";
import { tradeRiskReward } from "@/lib/risk";
import { RiskRewardPanel, RiskTag } from "@/components/RiskReward";
import type { PlayerValue } from "@/lib/types";

type Side = "give" | "get";

export function TradeAnalyzer({
  players,
  initialGive,
  initialGet,
  initialPartner,
}: {
  players: PlayerValue[];
  initialGive: string[];
  initialGet: string[];
  initialPartner: number | null;
}) {
  const board = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const [give, setGive] = useState<string[]>(initialGive);
  const [get, setGet] = useState<string[]>(initialGet);
  const [partner, setPartner] = useState<number | null>(initialPartner);
  const [copied, setCopied] = useState(false);
  const [team] = useMyTeam();

  // Keep the URL shareable (and openable from AI suggestions).
  useEffect(() => {
    const url = new URL(window.location.href);
    const set = (k: string, v: string) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
    set("give", give.join(","));
    set("get", get.join(","));
    set("partner", partner ? String(partner) : "");
    window.history.replaceState(null, "", url);
  }, [give, get, partner]);

  const resolve = (ids: string[]) => ids.map((id) => board.get(id)).filter((p): p is PlayerValue => !!p);
  const giveP = resolve(give);
  const getP = resolve(get);
  const result = evaluateTrade(giveP, getP);

  const myRoster = team ? resolve(team.playerIds) : [];
  const partnerTeam = team?.league?.teams.find((t) => t.rosterId === partner) ?? null;
  const partnerRoster = partnerTeam ? resolve(partnerTeam.players) : [];
  const otherTeams = team?.league?.teams.filter((t) => t.rosterId !== team.league!.myRosterId) ?? [];

  // Prefer players from the actual rosters involved; fall back to anyone.
  const rosterBalancers = suggestBalancers(giveP, getP, {
    give: myRoster.length ? myRoster : players,
    get: partnerRoster.length ? partnerRoster : players,
  });
  const fromRosters = rosterBalancers.length > 0;
  const balancers = fromRosters ? rosterBalancers : suggestBalancers(giveP, getP, { give: players, get: players });

  const add = (side: Side, id: string) => (side === "give" ? setGive : setGet)((ids) => (ids.includes(id) ? ids : [...ids, id]));
  const remove = (side: Side, id: string) => (side === "give" ? setGive : setGet)((ids) => ids.filter((x) => x !== id));
  const inTrade = [...give, ...get];

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      {/* Partner picker (only with an imported league) */}
      {otherTeams.length > 0 && (
        <div className="card flex animate-rise flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-rocket" /> Trading with
          </span>
          <select
            value={partner ?? ""}
            onChange={(e) => setPartner(e.target.value ? Number(e.target.value) : null)}
            className="h-10 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-rocket/50"
          >
            <option value="">Anyone (all players)</option>
            {otherTeams.map((t) => (
              <option key={t.rosterId} value={t.rosterId}>
                {t.teamName} ({t.displayName})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <SidePanel
          title="You give"
          subtitle={team ? `From ${team.name}` : "Players you send away"}
          accent="var(--color-rocket)"
          players={giveP}
          adjusted={result.rawGive}
          searchPool={players}
          quickPicks={myRoster}
          exclude={inTrade}
          onAdd={(id) => add("give", id)}
          onRemove={(id) => remove("give", id)}
          delay={60}
        />
        <div className="hidden items-center justify-center xl:flex">
          <span className="grid size-12 place-items-center rounded-full border border-line-strong bg-surface text-muted">
            <ArrowLeftRight className="size-5" />
          </span>
        </div>
        <SidePanel
          title="You get"
          subtitle={partnerTeam ? `From ${partnerTeam.teamName}` : "Players you receive"}
          accent="var(--color-volt)"
          players={getP}
          adjusted={result.rawGet}
          searchPool={players}
          quickPicks={partnerRoster}
          exclude={inTrade}
          onAdd={(id) => add("get", id)}
          onRemove={(id) => remove("get", id)}
          delay={120}
        />
      </div>

      <VerdictCard result={result} rr={tradeRiskReward(giveP, getP)} />

      <AnimatePresence>
        {balancers.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="card p-5"
          >
            <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
              <Scale className="size-5 text-flame" /> Even it out
            </h2>
            <p className="mb-4 text-sm text-muted">
              {balancers[0].side === "give"
                ? `You're getting the better end. Add one of these to what you give${fromRosters && myRoster.length ? " (from your roster)" : ""}:`
                : `You're overpaying. Ask for one of these too${fromRosters && partnerRoster.length ? ` from ${partnerTeam!.teamName}` : ""}:`}
            </p>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))]">
              {balancers.map((b) => (
                <button
                  key={b.player.id}
                  onClick={() => add(b.side, b.player.id)}
                  className="group flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left transition hover:border-flame/40"
                >
                  <PlayerAvatar id={b.player.id} position={b.player.position} team={b.player.team} name={b.player.name} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{b.player.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {b.player.position} · {b.player.team} · {Math.abs(b.newBalance) < 0.1 ? "makes it fair" : `leaves ${Math.round(Math.abs(b.newBalance) * 100)}% ${b.newBalance > 0 ? "your way" : "their way"}`}
                    </span>
                  </span>
                  <ValueBadge value={b.player.value} size="sm" />
                  <Plus className="size-4 text-faint transition group-hover:text-flame" />
                </button>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            });
          }}
          disabled={!give.length && !get.length}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-muted transition hover:text-ink disabled:opacity-40"
        >
          {copied ? <Check className="size-4 text-up" /> : <Link2 className="size-4" />} {copied ? "Link copied" : "Share trade"}
        </button>
        <button
          onClick={() => {
            setGive([]);
            setGet([]);
          }}
          disabled={!give.length && !get.length}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-muted transition hover:text-ink disabled:opacity-40"
        >
          <RotateCcw className="size-4" /> Clear
        </button>
        {!team && (
          <Link href="/my-team" className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-rocket hover:underline">
            Import your team for roster-aware suggestions →
          </Link>
        )}
      </div>

      {team ? (
        <TradeFinder team={team} players={players} />
      ) : (
        <div className="card flex flex-col gap-2 p-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            <b className="text-ink">Trade finder:</b> add your team to type in who you want (or who you&apos;d trade away) and get fair trades from your roster.
          </span>
          <Link href="/my-team" className="shrink-0 font-semibold text-rocket hover:underline">
            Add your team →
          </Link>
        </div>
      )}

      {/* Mobile sticky verdict */}
      <AnimatePresence>
        {result.verdict !== "empty" && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 lg:hidden"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-line-strong bg-surface-2/95 px-4 py-2.5 shadow-2xl backdrop-blur-xl">
              <VerdictLabel result={result} small />
              <MiniMeter balance={result.balance} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidePanel({
  title,
  subtitle,
  accent,
  players,
  adjusted,
  searchPool,
  quickPicks,
  exclude,
  onAdd,
  onRemove,
  delay,
}: {
  title: string;
  subtitle: string;
  accent: string;
  players: PlayerValue[];
  adjusted: number;
  searchPool: PlayerValue[];
  quickPicks: PlayerValue[];
  exclude: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  delay: number;
}) {
  const picks = quickPicks.filter((p) => !exclude.includes(p.id)).sort((a, b) => b.value - a.value);
  return (
    <section className="card relative animate-rise p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-[1.25rem]" style={{ background: accent }} />
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide" style={{ color: accent }}>
            {title}
          </h2>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">Total value</div>
          <CountUp value={adjusted} className="font-display text-3xl font-bold tabular" />
        </div>
      </div>
      <PlayerSearch players={searchPool} exclude={exclude} onSelect={(p) => onAdd(p.id)} placeholder="Add a player…" />
      {picks.length > 0 && (
        <div className="no-scrollbar -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5">
          {picks.slice(0, 20).map((p) => (
            <button
              key={p.id}
              onClick={() => onAdd(p.id)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-2.5 text-xs font-medium text-muted transition hover:border-line-strong hover:text-ink"
            >
              <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={22} />
              {p.name.split(" ").slice(-1)[0]}
              <span className="text-faint">{p.value}</span>
            </button>
          ))}
        </div>
      )}
      <ul className="mt-4 min-h-24 space-y-1.5">
        <AnimatePresence initial={false}>
          {players.map((p) => (
            <motion.li
              key={p.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2"
            >
              <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={34} />
              <Link href={`/players/${p.id}`} className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{p.name}</span>
                  <InjuryTag status={p.injuryStatus} />
                  <RiskTag p={p} />
                </span>
                <span className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted">
                  <PosBadge pos={p.position} /> {p.team} · {p.ppg} ppg
                </span>
              </Link>
              <ValueBadge value={p.value} size="sm" />
              <button onClick={() => onRemove(p.id)} className="rounded-lg p-1 text-faint transition hover:text-down" aria-label={`Remove ${p.name}`}>
                <X className="size-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
        {players.length === 0 && (
          <li className="grid h-24 place-items-center rounded-xl border border-dashed border-line text-sm text-faint">No players yet</li>
        )}
      </ul>
    </section>
  );
}

const VERDICT_STYLE = {
  win: { label: "You win", color: "var(--color-up)" },
  lose: { label: "You lose", color: "var(--color-down)" },
  fair: { label: "Fair trade", color: "var(--color-volt)" },
  empty: { label: "Add players", color: "var(--color-muted)" },
} as const;

function VerdictLabel({ result, small }: { result: TradeResult; small?: boolean }) {
  const s = VERDICT_STYLE[result.verdict];
  return (
    <div className={clsx(small && "min-w-24")}>
      <div className={clsx("font-display font-extrabold uppercase italic leading-none", small ? "text-xl" : "text-5xl sm:text-6xl")} style={{ color: s.color }}>
        {s.label}
      </div>
      {result.verdict !== "empty" && (
        <div className={clsx("text-muted", small ? "text-[11px]" : "mt-2 text-sm")}>
          {edgeLabel(result)}
        </div>
      )}
    </div>
  );
}

function VerdictCard({ result, rr }: { result: TradeResult; rr: ReturnType<typeof tradeRiskReward> }) {
  return (
    <section className="card relative animate-rise overflow-hidden p-5 [animation-delay:180ms] sm:p-7">
      <motion.div
        className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full blur-3xl"
        animate={{ background: VERDICT_STYLE[result.verdict].color, opacity: result.verdict === "empty" ? 0.04 : 0.16 }}
        transition={{ duration: 0.6 }}
      />
      <div className="relative grid items-center gap-6 md:grid-cols-[auto_1fr]">
        <AnimatePresence mode="wait">
          <motion.div
            key={result.verdict}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <VerdictLabel result={result} />
          </motion.div>
        </AnimatePresence>
        <div>
          <Meter balance={result.balance} active={result.verdict !== "empty"} />
          <div className="mt-3 flex justify-between text-xs text-muted">
            <span>
              You give <b className="text-ink">{result.rawGive}</b> <span className="text-faint">value</span>
            </span>
            <span>
              You get <b className="text-ink">{result.rawGet}</b> <span className="text-faint">value</span>
            </span>
          </div>
        </div>
      </div>
      {rr && (
        <div className="relative mt-5">
          <RiskRewardPanel rr={rr} />
        </div>
      )}
    </section>
  );
}

function Meter({ balance, active }: { balance: number; active: boolean }) {
  const pos = 50 + balance * 50;
  return (
    <div className="relative pt-7">
      <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-widest text-faint">
        <span>You lose</span>
        <span>Fair</span>
        <span>You win</span>
      </div>
      <div className="relative h-4 overflow-hidden rounded-full bg-gradient-to-r from-down via-volt to-up opacity-90">
        <div className="absolute inset-y-0 left-1/2 w-[16%] -translate-x-1/2 bg-white/20" />
      </div>
      <motion.div
        className="absolute bottom-[-6px] top-5 w-1.5 -translate-x-1/2 rounded-full bg-ink shadow-[0_0_14px_rgba(255,255,255,0.7)]"
        initial={false}
        animate={{ left: `${active ? pos : 50}%`, opacity: active ? 1 : 0.3 }}
        transition={{ type: "spring", stiffness: 120, damping: 14 }}
      />
    </div>
  );
}

function MiniMeter({ balance }: { balance: number }) {
  return (
    <div className="relative h-2.5 flex-1 rounded-full bg-gradient-to-r from-down via-volt to-up">
      <motion.span
        className="absolute -top-1 h-4.5 w-1 -translate-x-1/2 rounded-full bg-ink"
        animate={{ left: `${50 + balance * 50}%` }}
        transition={{ type: "spring", stiffness: 140, damping: 16 }}
      />
    </div>
  );
}
