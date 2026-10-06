import Link from "next/link";
import { Crown } from "lucide-react";

/** Shown where Premium-only results would continue. */
export function PremiumLock({ hidden, what = "trade ideas" }: { hidden: number; what?: string }) {
  return (
    <Link
      href="/premium"
      className="card group flex flex-col items-center justify-center gap-2 border-rocket/40 bg-gradient-to-b from-brand/15 to-transparent p-6 text-center transition hover:border-rocket/70"
    >
      <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white">
        <Crown className="size-5" />
      </span>
      <span className="font-display text-xl font-bold uppercase">
        {hidden > 0 ? `${hidden} more ${what}` : `Unlock ${what}`}
      </span>
      <span className="max-w-xs text-sm text-muted">Premium shows every fair trade we find, plus Package deals.</span>
      <span className="mt-1 text-sm font-semibold text-rocket group-hover:underline">See Premium →</span>
    </Link>
  );
}
