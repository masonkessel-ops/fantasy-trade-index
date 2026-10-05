"use client";

import { Cloud } from "lucide-react";
import { useAccount } from "@/lib/account";

/** Nudge to sign in so the team is saved to an account (only when Google sign-in is set up). */
export function SaveCallout() {
  const acct = useAccount();
  if (!acct.loaded || !acct.configured || acct.user) return null;
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-volt/30 bg-volt/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2 text-ink/90">
        <Cloud className="size-4 shrink-0 text-volt" />
        Sign in with Google to save your team and open it on any device.
      </span>
      <a href="/api/auth/google/login?next=/my-team" className="shrink-0 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-[#1f1f1f] hover:bg-white/90">
        Sign in with Google
      </a>
    </div>
  );
}
