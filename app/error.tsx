"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rocket">Fumble</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold uppercase italic">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted">A data source may be slow right now. Try again in a moment.</p>
      <div className="mt-6 flex gap-2">
        <button
          onClick={() => retry()}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-2 px-5 text-sm font-bold text-bg transition hover:brightness-110"
        >
          <RotateCcw className="size-4" /> Try again
        </button>
        <Link href="/" className="inline-flex h-10 items-center rounded-full border border-line-strong px-5 text-sm font-semibold text-muted hover:text-ink">
          Home
        </Link>
      </div>
    </div>
  );
}
