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

export function MyTeam({ players, scoring, yahooStatus }: { players: PlayerValue[]; scoring: Scoring; yahooStatus: string | null }) {
  const [team, setTeam, hydrated] = useMyTeam();
  const [notice, setNotice] = useState(yahooStatus ? YAHOO_MESSAGES[yahooStatus] : undefined);

  const banner = notice && (
    <div className={clsx("mb-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm", notice.ok ? "bg-up/10 text-up" : "bg-flame/10 text-flame")}>
      <span>
        {notice.text}
        {notice.ok && team && " To switch to it, click Reset on your current team first."}
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
      <TeamDashboard team={team} players={players} scoring={scoring} onChange={setTeam} />
    </>
  );
}
