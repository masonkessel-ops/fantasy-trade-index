"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, ChevronLeft, Download, Hammer, Loader2, Trash2 } from "lucide-react";
import { PlayerSearch } from "@/components/PlayerSearch";
import { PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import { ScoringToggle, setScoringCookie } from "@/components/ScoringToggle";
import { DEFAULT_ROSTER_POSITIONS, scoringFromRec, type SavedLeagueTeam, type SavedTeam } from "@/lib/myTeam";
import { SCORINGS, type PlayerValue, type Scoring } from "@/lib/types";

type LeagueSummary = { leagueId: string; name: string; totalRosters: number; avatar: string | null; scoringRec: number };
type LeagueResponse = {
  league: {
    leagueId: string;
    name: string;
    season: string;
    totalRosters: number;
    avatar: string | null;
    rosterPositions: string[];
    scoringSettings: Record<string, number>;
    teams: SavedLeagueTeam[];
  };
  directory: SavedTeam["directory"];
};

export async function fetchLeague(leagueId: string): Promise<LeagueResponse> {
  const res = await fetch(`/api/sleeper/league/${leagueId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Couldn't load that league.");
  return data;
}

export function teamFromLeague(data: LeagueResponse, rosterId: number, username: string): SavedTeam {
  const { league, directory } = data;
  const mine = league.teams.find((t) => t.rosterId === rosterId)!;
  return {
    source: "sleeper",
    name: mine.teamName,
    avatar: mine.avatar,
    scoring: scoringFromRec(league.scoringSettings.rec),
    playerIds: mine.players,
    rosterPositions: league.rosterPositions,
    league: { ...league, myRosterId: rosterId, username },
    directory,
    updatedAt: Date.now(),
  };
}

export function TeamSetup({
  players,
  scoring,
  onDone,
}: {
  players: PlayerValue[];
  scoring: Scoring;
  onDone: (t: SavedTeam) => void;
}) {
  const [mode, setMode] = useState<"sleeper" | "manual">("sleeper");
  return (
    <div className="card animate-rise overflow-hidden [animation-delay:80ms]">
      <div className="grid grid-cols-2 border-b border-line p-1.5">
        {(
          [
            { id: "sleeper", label: "Import from Sleeper", icon: Download },
            { id: "manual", label: "Build manually", icon: Hammer },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={clsx(
              "relative flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors",
              mode === t.id ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {mode === t.id && (
              <motion.span layoutId="setup-tab" className="absolute inset-0 rounded-xl bg-surface-3" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
            )}
            <t.icon className="relative size-4" />
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="p-5 sm:p-7">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === "manual" ? 16 : -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {mode === "sleeper" ? (
              <SleeperImport onDone={onDone} />
            ) : (
              <ManualBuilder players={players} scoring={scoring} onDone={onDone} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function SleeperImport({ onDone }: { onDone: (t: SavedTeam) => void }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ userId: string; displayName: string; username: string } | null>(null);
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [picking, setPicking] = useState<LeagueResponse | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const name = username.trim();
    if (!name) return;
    setBusy("user");
    setError(null);
    try {
      const res = await fetch(`/api/sleeper/user/${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUser(data.user);
      setLeagues(data.leagues);
      if (!data.leagues.length) setError(`${data.user.displayName} isn't in any ${data.season} NFL leagues.`);
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function finish(data: LeagueResponse, rosterId: number) {
    const team = teamFromLeague(data, rosterId, user!.username);
    setScoringCookie(team.scoring);
    onDone(team);
    router.refresh();
  }

  async function chooseLeague(l: LeagueSummary) {
    setBusy(l.leagueId);
    setError(null);
    try {
      const data = await fetchLeague(l.leagueId);
      const mine = data.league.teams.find((t) => t.ownerId === user!.userId);
      if (mine) finish(data, mine.rosterId);
      else setPicking(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (picking) {
    return (
      <div>
        <button onClick={() => setPicking(null)} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Leagues
        </button>
        <h3 className="font-display text-2xl font-bold uppercase">Which team is yours?</h3>
        <p className="mb-4 text-sm text-muted">We couldn&apos;t match your account to a roster in {picking.league.name}.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {picking.league.teams.map((t) => (
            <button
              key={t.rosterId}
              onClick={() => finish(picking, t.rosterId)}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left transition hover:border-rocket/40"
            >
              <Avatar src={t.avatar} label={t.teamName} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{t.teamName}</span>
                <span className="text-xs text-muted">
                  {t.displayName} · {t.wins}-{t.losses}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-display text-2xl font-bold uppercase">Import your Sleeper league</h3>
      <p className="mb-4 text-sm text-muted">Enter your Sleeper username. We only read public league data, no login needed.</p>
      <form onSubmit={lookup} className="flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Sleeper username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-4 text-sm outline-none transition placeholder:text-faint focus:border-rocket/50 focus:ring-4 focus:ring-rocket/10"
        />
        <button
          disabled={!username.trim() || busy === "user"}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-rocket to-flame px-5 text-sm font-bold text-bg transition hover:brightness-110 disabled:opacity-50"
        >
          {busy === "user" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Find
        </button>
      </form>
      {error && <p className="mt-3 rounded-xl bg-down/10 px-3 py-2 text-sm text-down">{error}</p>}
      {leagues.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{user?.displayName}&apos;s leagues</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {leagues.map((l, i) => (
              <motion.button
                key={l.leagueId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => chooseLeague(l)}
                disabled={!!busy}
                className="group flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left transition hover:border-rocket/40 disabled:opacity-60"
              >
                <Avatar src={l.avatar} label={l.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{l.name}</span>
                  <span className="text-xs text-muted">
                    {l.totalRosters} teams · {SCORINGS.find((s) => s.id === scoringFromRec(l.scoringRec))!.label}
                  </span>
                </span>
                {busy === l.leagueId ? (
                  <Loader2 className="size-4 animate-spin text-rocket" />
                ) : (
                  <ArrowRight className="size-4 text-faint transition group-hover:translate-x-0.5 group-hover:text-rocket" />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ManualBuilder({
  players,
  scoring,
  onDone,
}: {
  players: PlayerValue[];
  scoring: Scoring;
  onDone: (t: SavedTeam) => void;
}) {
  const [name, setName] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const byId = new Map(players.map((p) => [p.id, p]));
  const roster = ids.map((id) => byId.get(id)).filter((p): p is PlayerValue => !!p);
  const total = roster.reduce((s, p) => s + p.value, 0);

  return (
    <div>
      <h3 className="font-display text-2xl font-bold uppercase">Build your roster</h3>
      <p className="mb-4 text-sm text-muted">Search and add each player on your team.</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Team name (optional)"
          className="h-11 rounded-xl border border-line bg-surface-2 px-4 text-sm outline-none placeholder:text-faint focus:border-rocket/50"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-faint">Scoring</span>
          <ScoringToggle scoring={scoring} compact />
        </div>
      </div>
      <div className="mt-3">
        <PlayerSearch players={players} exclude={roster.map((p) => p.id)} onSelect={(p) => setIds((r) => [...r, p.id])} />
      </div>
      <ul className="mt-4 space-y-1.5">
        <AnimatePresence initial={false}>
          {roster.map((p) => (
            <motion.li
              key={p.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2">
                <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <PosBadge pos={p.position} /> {p.team}
                  </span>
                </span>
                <ValueBadge value={p.value} size="sm" />
                <button
                  onClick={() => setIds((r) => r.filter((x) => x !== p.id))}
                  className="rounded-lg p-1.5 text-faint transition hover:bg-down/10 hover:text-down"
                  aria-label={`Remove ${p.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {roster.length === 0 ? (
        <p className="mt-6 text-center text-sm text-faint">No players yet. Start typing a name above.</p>
      ) : (
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-sm text-muted">
            {roster.length} players · <span className="font-semibold text-ink">{total}</span> total value
          </span>
          <button
            onClick={() =>
              onDone({
                source: "manual",
                name: name.trim() || "My Team",
                avatar: null,
                scoring,
                playerIds: roster.map((p) => p.id),
                rosterPositions: DEFAULT_ROSTER_POSITIONS,
                directory: {},
                updatedAt: Date.now(),
              })
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-rocket to-flame px-5 text-sm font-bold text-bg transition hover:brightness-110"
          >
            Save team <ArrowRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function Avatar({ src, label, size = 40 }: { src: string | null; label: string; size?: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-3 text-sm font-bold text-muted ring-1 ring-line-strong"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- Sleeper CDN avatar
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        label.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
