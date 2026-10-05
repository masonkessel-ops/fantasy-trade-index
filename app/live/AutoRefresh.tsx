"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import clsx from "clsx";

const INTERVAL = 60_000;

/** Re-fetches the server-rendered page every 60s while the tab is visible. */
export function AutoRefresh({ updatedAt, live }: { updatedAt: number; live: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [now, setNow] = useState(updatedAt);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => {
      if (document.visibilityState === "visible") start(() => router.refresh());
    }, INTERVAL);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - updatedAt > INTERVAL) start(() => router.refresh());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, updatedAt]);

  const ago = Math.max(0, Math.round((now - updatedAt) / 1000));
  const next = Math.max(0, Math.round((INTERVAL - (now - updatedAt)) / 1000));

  return (
    <button
      onClick={() => start(() => router.refresh())}
      className="inline-flex items-center gap-2 self-start rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted transition hover:text-ink lg:self-end"
    >
      <RefreshCw className={clsx("size-3.5", pending && "animate-spin text-rocket")} />
      {pending ? "Updating…" : `Updated ${ago}s ago`}
      <span className="text-faint">· {live ? `next in ${next}s` : "auto-refresh on"}</span>
    </button>
  );
}

export function LocalKickoff({ iso }: { iso: string }) {
  const d = new Date(iso);
  const text = isNaN(d.getTime())
    ? "Scheduled"
    : d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  return (
    <span className="text-muted" suppressHydrationWarning>
      {text}
    </span>
  );
}
