"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, ChevronDown, ChevronLeft, Hammer, Loader2, LogOut, Trash2 } from "lucide-react";
import { PlayerSearch } from "@/components/PlayerSearch";
import { PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import { ScoringToggle, setScoringCookie } from "@/components/ScoringToggle";
import { DEFAULT_ROSTER_POSITIONS, scoringFromRec, type SavedTeam } from "@/lib/myTeam";
import { SCORINGS, type PlayerValue, type Scoring } from "@/lib/types";
import { LeagueError, fetchEspnLeague, fetchSleeperLeague, fetchYahooLeague, teamFromLeague, type LeagueResponse } from "./leagueClient";

type Mode = "sleeper" | "yahoo" | "espn" | "manual";

const TABS: { id: Mode; label: string; short: string }[] = [
  { id: "sleeper", label: "Sleeper", short: "Sleeper" },
  { id: "yahoo", label: "Yahoo", short: "Yahoo" },
  { id: "espn", label: "ESPN", short: "ESPN" },
  { id: "manual", label: "Build manually", short: "Manual" },
];

const inputCls =
  "h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-4 text-sm outline-none transition placeholder:text-faint focus:border-rocket/50 focus:ring-4 focus:ring-rocket/10";
const primaryBtn =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rocket to-flame px-5 text-sm font-bold text-bg transition hover:brightness-110 disabled:opacity-50";

export function TeamSetup({
  players,
  scoring,
  onDone,
  initialMode = "sleeper",
}: {
  players: PlayerValue[];
  scoring: Scoring;
  onDone: (t: SavedTeam) => void;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const router = useRouter();
  const finish = (data: LeagueResponse, rosterId: number, username?: string) => {
    const team = teamFromLeague(data, rosterId, username);
    setScoringCookie(team.scoring);
    onDone(team);
    router.refresh();
  };

  return (
    <div className="card animate-rise overflow-hidden [animation-delay:80ms]">
      <div className="grid grid-cols-4 border-b border-line p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={clsx(
              "relative flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition-colors",
              mode === t.id ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {mode === t.id && (
              <motion.span layoutId="setup-tab" className="absolute inset-0 rounded-xl bg-surface-3" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
            )}
            {t.id === "manual" && <Hammer className="relative size-4" />}
            <span className="relative hidden sm:inline">{t.label}</span>
            <span className="relative sm:hidden">{t.short}</span>
          </button>
        ))}
      </div>
      <div className="p-5 sm:p-7">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {mode === "sleeper" && <SleeperImport onFinish={finish} />}
            {mode === "yahoo" && <YahooImport onFinish={finish} />}
            {mode === "espn" && <EspnImport onFinish={finish} />}
            {mode === "manual" && <ManualBuilder players={players} scoring={scoring} onDone={onDone} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

type Finish = (data: LeagueResponse, rosterId: number, username?: string) => void;

/** "Which team is yours?" when the platform didn't tell us. */
function TeamPicker({
  data,
  onPick,
  onBack,
  reason,
  suggested,
}: {
  data: LeagueResponse;
  onPick: (rosterId: number) => void;
  onBack: () => void;
  reason: string;
  suggested?: number | null;
}) {
  const teams = [...data.league.teams].sort((a, b) => (a.rosterId === suggested ? -1 : b.rosterId === suggested ? 1 : 0));
  return (
    <div>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Back
      </button>
      <h3 className="font-display text-2xl font-bold uppercase">Which team is yours?</h3>
      <p className="mb-1 text-sm text-muted">{reason}</p>
      <p className="mb-4 text-xs text-faint">
        {data.league.name} · {data.league.teams.length} teams
      </p>
      <UnmatchedNote data={data} />
      <div className="grid gap-2 sm:grid-cols-2">
        {teams.map((t) => (
          <button
            key={t.rosterId}
            onClick={() => onPick(t.rosterId)}
            className={clsx(
              "relative flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-rocket/40",
              t.rosterId === suggested ? "border-rocket/50 bg-rocket/10" : "border-line bg-surface-2",
            )}
          >
            {t.rosterId === suggested && (
              <span className="absolute -top-2 right-3 rounded-full bg-rocket px-2 py-0.5 text-[10px] font-bold text-bg">Looks like you</span>
            )}
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

function UnmatchedNote({ data }: { data: LeagueResponse }) {
  if (!data.league.unmatched) return null;
  return (
    <p className="mb-3 rounded-xl bg-flame/10 px-3 py-2 text-xs text-flame">
      {data.league.unmatched} rostered player{data.league.unmatched > 1 ? "s" : ""} (mostly deep bench or free agents) couldn&apos;t be matched and
      will be left out.
    </p>
  );
}

function LeagueButton({ name, sub, avatar, busy, disabled, onClick, i }: { name: string; sub: string; avatar: string | null; busy: boolean; disabled: boolean; onClick: () => void; i: number }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      onClick={onClick}
      disabled={disabled}
      className="group flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left transition hover:border-rocket/40 disabled:opacity-60"
    >
      <Avatar src={avatar} label={name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="text-xs text-muted">{sub}</span>
      </span>
      {busy ? <Loader2 className="size-4 animate-spin text-rocket" /> : <ArrowRight className="size-4 text-faint transition group-hover:translate-x-0.5 group-hover:text-rocket" />}
    </motion.button>
  );
}

const ErrorNote = ({ error }: { error: string | null }) => (error ? <p className="mt-3 rounded-xl bg-down/10 px-3 py-2 text-sm text-down">{error}</p> : null);

/* --------------------------------------------------------------- Sleeper */

type SleeperLeague = { leagueId: string; name: string; totalRosters: number; avatar: string | null; scoringRec: number };

function SleeperImport({ onFinish }: { onFinish: Finish }) {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ userId: string; displayName: string; username: string } | null>(null);
  const [leagues, setLeagues] = useState<SleeperLeague[]>([]);
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

  async function chooseLeague(l: SleeperLeague) {
    setBusy(l.leagueId);
    setError(null);
    try {
      const data = await fetchSleeperLeague(l.leagueId);
      const mine = data.league.teams.find((t) => t.ownerId === user!.userId);
      setPicking({ ...data, league: { ...data.league, myRosterId: mine?.rosterId ?? null } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (picking)
    return (
      <TeamPicker
        data={picking}
        onBack={() => setPicking(null)}
        onPick={(id) => onFinish(picking, id, user!.username)}
        suggested={picking.league.myRosterId}
        reason="Pick your team so we know which players are yours."
      />
    );

  return (
    <div>
      <h3 className="font-display text-2xl font-bold uppercase">Import from Sleeper</h3>
      <p className="mb-4 text-sm text-muted">Enter your Sleeper username. Sleeper leagues are readable without logging in.</p>
      <form onSubmit={lookup} className="flex gap-2">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Sleeper username" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={inputCls} />
        <button disabled={!username.trim() || busy === "user"} className={primaryBtn}>
          {busy === "user" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Find
        </button>
      </form>
      <ErrorNote error={error} />
      {leagues.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{user?.displayName}&apos;s leagues</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {leagues.map((l, i) => (
              <LeagueButton
                key={l.leagueId}
                i={i}
                name={l.name}
                avatar={l.avatar}
                sub={`${l.totalRosters} teams · ${SCORINGS.find((s) => s.id === scoringFromRec(l.scoringRec))!.label}`}
                busy={busy === l.leagueId}
                disabled={!!busy}
                onClick={() => chooseLeague(l)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- Yahoo */

type YahooLeague = { leagueKey: string; name: string; numTeams: number; season: string; logo: string | null };

function YahooImport({ onFinish }: { onFinish: Finish }) {
  const [status, setStatus] = useState<{ configured: boolean; signedIn: boolean; name: string | null } | null>(null);
  const [leagues, setLeagues] = useState<YahooLeague[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<LeagueResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetch("/api/yahoo/me").then((r) => r.json()).catch(() => ({ configured: false, signedIn: false, name: null }));
      if (cancelled) return;
      setStatus(me);
      if (!me.signedIn) return;
      const res = await fetch("/api/yahoo/leagues");
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (res.ok) setLeagues(data.leagues);
      else {
        if (data.signedOut) setStatus({ ...me, signedIn: false });
        setError(data.error ?? "Couldn't load your Yahoo leagues.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function chooseLeague(l: YahooLeague) {
    setBusy(l.leagueKey);
    setError(null);
    try {
      setPicking(await fetchYahooLeague(l.leagueKey));
    } catch (err) {
      if (err instanceof LeagueError && err.signedOut) setStatus((s) => (s ? { ...s, signedIn: false } : s));
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (picking)
    return (
      <TeamPicker
        data={picking}
        onBack={() => setPicking(null)}
        onPick={(id) => onFinish(picking, id)}
        suggested={picking.league.myRosterId}
        reason="Pick your team so we know which players are yours."
      />
    );

  if (!status) return <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Checking Yahoo…</p>;

  if (!status.configured)
    return (
      <div>
        <h3 className="font-display text-2xl font-bold uppercase">Import from Yahoo</h3>
        <p className="mt-2 text-sm text-muted">
          Yahoo sign-in isn&apos;t switched on for this site yet. The site owner needs to add Yahoo API keys (see the README&apos;s &quot;Yahoo sign-in&quot;
          section). Until then, you can rebuild your Yahoo roster with <b className="text-ink">Build manually</b>.
        </p>
      </div>
    );

  if (!status.signedIn)
    return (
      <div>
        <h3 className="font-display text-2xl font-bold uppercase">Sign in with Yahoo</h3>
        <p className="mb-5 mt-1 text-sm text-muted">
          Sign in to pull in your Yahoo leagues, including private ones. We only ask Yahoo for read access to your fantasy data, and you can disconnect anytime.
        </p>
        <a href="/api/yahoo/login" className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-[#6001d2] px-5 text-sm font-bold text-white transition hover:brightness-110">
          <span className="grid size-6 place-items-center rounded-md bg-white font-display text-base font-extrabold text-[#6001d2]">Y!</span>
          Sign in with Yahoo
        </a>
        <ErrorNote error={error} />
      </div>
    );

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-bold uppercase">Your Yahoo leagues</h3>
          <p className="text-sm text-muted">Signed in{status.name ? ` as ${status.name}` : ""}.</p>
        </div>
        <SignOutYahoo onDone={() => setStatus({ ...status, signedIn: false })} />
      </div>
      {!leagues ? (
        error ? null : <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Loading leagues…</p>
      ) : leagues.length === 0 ? (
        <p className="text-sm text-muted">No Yahoo NFL leagues found on this Yahoo account. Make sure you signed in with the account that owns your fantasy team.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {leagues.map((l, i) => (
            <LeagueButton key={l.leagueKey} i={i} name={l.name} avatar={l.logo} sub={`${l.numTeams} teams · ${l.season}`} busy={busy === l.leagueKey} disabled={!!busy} onClick={() => chooseLeague(l)} />
          ))}
        </div>
      )}
      <ErrorNote error={error} />
    </div>
  );
}

export function SignOutYahoo({ onDone }: { onDone: () => void }) {
  return (
    <button
      onClick={async () => {
        await fetch("/api/yahoo/logout", { method: "POST" });
        onDone();
      }}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-muted transition hover:text-ink"
    >
      <LogOut className="size-3.5" /> Sign out
    </button>
  );
}

/* ------------------------------------------------------------------ ESPN */

function EspnImport({ onFinish }: { onFinish: Finish }) {
  const [leagueId, setLeagueId] = useState("");
  const [showPrivate, setShowPrivate] = useState(false);
  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<LeagueResponse | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Accept a full league URL too: …?leagueId=123456
    const id = (leagueId.match(/leagueId=(\d+)/)?.[1] ?? leagueId).trim();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const cookies = showPrivate && espnS2.trim() && swid.trim() ? { espnS2: espnS2.trim(), swid: swid.trim() } : undefined;
      setPicking(await fetchEspnLeague(id, cookies));
    } catch (err) {
      if (err instanceof LeagueError && err.needsCookies) setShowPrivate(true);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (picking)
    return (
      <TeamPicker
        data={picking}
        onBack={() => setPicking(null)}
        onPick={(id) => onFinish(picking, id)}
        suggested={picking.league.myRosterId}
        reason="Pick your team so we know which players are yours."
      />
    );

  return (
    <form onSubmit={submit}>
      <h3 className="font-display text-2xl font-bold uppercase">Import from ESPN</h3>
      <p className="mb-4 text-sm text-muted">
        Paste your league ID, or the whole league URL. On ESPN, open your league and look for <code className="text-ink">leagueId=…</code> in the address bar.
      </p>
      <div className="flex gap-2">
        <input value={leagueId} onChange={(e) => setLeagueId(e.target.value)} placeholder="League ID or URL" inputMode="url" autoCapitalize="none" className={inputCls} />
        <button disabled={!leagueId.trim() || busy} className={primaryBtn}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Import
        </button>
      </div>

      <button type="button" onClick={() => setShowPrivate((v) => !v)} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronDown className={clsx("size-4 transition", showPrivate && "rotate-180")} /> Private league?
      </button>
      <AnimatePresence initial={false}>
        {showPrivate && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 space-y-3 rounded-2xl border border-line bg-surface-2 p-4">
              <p className="text-xs leading-relaxed text-muted">
                Private ESPN leagues need two cookies from your browser. On a computer, log in at espn.com, open DevTools (F12) → <b>Application</b> →{" "}
                <b>Cookies</b> → <code>https://www.espn.com</code>, and copy the values of <code>espn_s2</code> and <code>SWID</code>. They&apos;re sent to ESPN once
                for this import and are never saved. Treat them like a password and don&apos;t share them.
              </p>
              <input value={espnS2} onChange={(e) => setEspnS2(e.target.value)} placeholder="espn_s2" autoComplete="off" spellCheck={false} className={clsx(inputCls, "w-full font-mono text-xs")} />
              <input value={swid} onChange={(e) => setSwid(e.target.value)} placeholder="SWID  {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}" autoComplete="off" spellCheck={false} className={clsx(inputCls, "w-full font-mono text-xs")} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ErrorNote error={error} />
    </form>
  );
}

/* ---------------------------------------------------------------- Manual */

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
