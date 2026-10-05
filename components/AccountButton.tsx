"use client";

import { usePathname } from "next/navigation";
import { Cloud, LogOut } from "lucide-react";
import { signOut, useAccount } from "@/lib/account";

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Sign in with Google / signed-in chip. Hidden until Google sign-in is set up. */
export function AccountButton() {
  const acct = useAccount();
  const path = usePathname();
  if (!acct.loaded || !acct.configured) return null;
  if (!acct.user)
    return (
      <a
        href={`/api/auth/google/login?next=${encodeURIComponent(path || "/my-team")}`}
        className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-[#1f1f1f] transition hover:bg-white/90"
      >
        <GoogleG /> Sign in with Google
      </a>
    );
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2">
      {acct.user.picture ? (
        // eslint-disable-next-line @next/next/no-img-element -- Google profile photo
        <img src={acct.user.picture} alt="" className="size-7 shrink-0 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-bold">{acct.user.name.slice(0, 1)}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{acct.user.name}</span>
        <span className="flex items-center gap-1 text-[11px] text-muted">
          <Cloud className="size-3" /> {acct.lastSyncError ? <span className="text-flame">{acct.lastSyncError}</span> : acct.syncing ? "Saving…" : "Team saved to account"}
        </span>
      </span>
      <button onClick={() => signOut()} className="rounded-lg p-1.5 text-faint transition hover:text-ink" aria-label="Sign out" title="Sign out">
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
