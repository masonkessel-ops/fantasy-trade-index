"use client";

import { PageHeader } from "@/components/PageHeader";
import { useMyTeam } from "@/lib/myTeam";
import type { PlayerValue, Scoring } from "@/lib/types";
import { TeamDashboard } from "./TeamDashboard";
import { TeamSetup } from "./TeamSetup";

export function MyTeam({ players, scoring }: { players: PlayerValue[]; scoring: Scoring }) {
  const [team, setTeam, hydrated] = useMyTeam();

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
          subtitle="Import your roster from Sleeper or build one by hand. We'll total its trade value and show where you're strong and where you need help."
        />
        <TeamSetup players={players} scoring={scoring} onDone={setTeam} />
      </>
    );
  }

  return <TeamDashboard team={team} players={players} scoring={scoring} onChange={setTeam} />;
}
