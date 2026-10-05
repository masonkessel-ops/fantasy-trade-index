"use client";

import { useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { PageHeader } from "@/components/PageHeader";
import { useMyTeam } from "@/lib/myTeam";
import type { PlayerValue, Scoring } from "@/lib/types";
import { TeamDashboard } from "./TeamDashboard";
import { TeamSetup } from "./TeamSetup";

const YAHOO_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "Connected to Yahoo. Pick a league below to import it.", ok: true },
  denied: { text: "Yahoo sign-in was cancelled.", ok: false },
  error: { text: "Yahoo sign-in didn't work. Please try again.", ok: false },
  not_configured: { text: "Yahoo sign-in isn't set up on this site yet.", ok: false },
};

const DETAIL_HELP: Record<string, string> = {
  invalid_client: "Yahoo rejected the app keys. Check that YAHOO_CLIENT_ID is the Consumer Key and YAHOO_CLIENT_SECRET is the Consumer Secret in Vercel, then redeploy.",
  invalid_grant: "Yahoo rejected the sign-in code. Try once more; if it repeats, check that your Yahoo app's Redirect URI is exactly https://fantasy-trade-index.vercel.app/api/yahoo/callback.",
  redirect_uri_mismatch: "In your Yahoo app, the Redirect URI must be exactly https://fantasy-trade-index.vercel.app/api/yahoo/callback.",
  invalid_scope:
    "Yahoo says your app isn't allowed Fantasy Sports access. At developer.yahoo.com/apps → your app, turn on API Permissions → Fantasy Sports → Read, save, then try again.",
  state_cookie_missing: "Your browser blocked the sign-in cookie. Try again, and make sure cookies are allowed for this site.",
  state_mismatch: "The sign-in took too long or was started twice. Please try again.",
};

export function MyTeam({
  players,
  scoring,
  yahooStatus,
  yahooDetail = null,
  finderPreset = null,
}: {
  players: PlayerValue[];
  scoring: Scoring;
  yahooStatus: string | null;
  yahooDetail?: string | null;
  finderPreset?: { mode: "away" | "for"; ids: string[] } | null;
}) {
  const [team, setTeam, hydrated] = useMyTeam();
  const [notice, setNotice] = useState(yahooStatus ? YAHOO_MESSAGES[yahooStatus] : undefined);

  const banner = notice && (
    <div className={clsx("mb-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm", notice.ok ? "bg-up/10 text-up" : "bg-flame/10 text-flame")}>
      <span>
        {notice.text}
        {notice.ok && team && " To switch to it, click Reset on your current team first."}
        {!notice.ok && yahooDetail && (
          <span className="mt-1 block text-xs opacity-90">
            {DETAIL_HELP[yahooDetail] ?? "Yahoo said:"} <code className="opacity-70">({yahooDetail})</code>
          </span>
        )}
      </span>
      <button onClick={() => setNotice(undefined)} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
        <X className="size-4" />
      </button>
    </div>
  );

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-12 w-64" />
        <div className="skeleton h-64 w-full rounded-[1.25rem]" />
      </div>
    );
  }

  if (!team) {
    return (
      <>
        <PageHeader
          eyebrow="Your roster"
          title={
            <>
              My <span className="text-gradient">Team</span>
            </>
          }
          subtitle="Import your team from Sleeper, Yahoo or ESPN, or build one by hand. You'll get its trade value, start/sit advice, waiver pickups and trades you should make."
        />
        {banner}
        <TeamSetup players={players} scoring={scoring} onDone={setTeam} initialMode={yahooStatus === "connected" ? "yahoo" : "sleeper"} />
      </>
    );
  }

  return (
    <>
      {banner}
      <TeamDashboard team={team} players={players} scoring={scoring} onChange={setTeam} finderPreset={finderPreset} />
    </>
  );
}
