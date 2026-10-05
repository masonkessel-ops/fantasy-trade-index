"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

type Me = { configured: boolean; signedIn: boolean; name: string | null };

/** Sign-in status in the nav. Hidden entirely until the site owner sets up Yahoo keys. */
export function YahooAccount() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    fetch("/api/yahoo/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe(null));
  }, []);
  if (!me?.configured) return null;

  if (!me.signedIn)
    return (
      <a
        href="/api/yahoo/login"
        className="flex items-center gap-2.5 rounded-xl bg-[#6001d2] px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
      >
        <span className="grid size-6 place-items-center rounded-md bg-white font-display text-sm font-extrabold text-[#6001d2]">Y!</span>
        Sign in with Yahoo
      </a>
    );

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[#6001d2] font-display text-sm font-extrabold text-white">Y!</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{me.name ?? "Yahoo user"}</span>
        <span className="text-[11px] text-muted">Signed in with Yahoo</span>
      </span>
      <button
        onClick={async () => {
          await fetch("/api/yahoo/logout", { method: "POST" });
          setMe({ ...me, signedIn: false, name: null });
        }}
        className="rounded-lg p-1.5 text-faint transition hover:text-ink"
        aria-label="Sign out of Yahoo"
        title="Sign out"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
