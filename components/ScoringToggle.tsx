"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { SCORINGS, SCORING_COOKIE, type Scoring } from "@/lib/types";

export function setScoringCookie(s: Scoring) {
  document.cookie = `${SCORING_COOKIE}=${s}; path=/; max-age=31536000; samesite=lax`;
}

export function ScoringToggle({ scoring, compact = false }: { scoring: Scoring; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div
      className={clsx(
        "relative inline-flex rounded-full border border-line bg-surface-2 p-1 transition-opacity",
        pending && "opacity-60",
        !compact && "w-full",
      )}
      role="radiogroup"
      aria-label="Scoring format"
    >
      {SCORINGS.map((s) => {
        const active = s.id === scoring;
        return (
          <button
            key={s.id}
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (active) return;
              setScoringCookie(s.id);
              start(() => router.refresh());
            }}
            className={clsx(
              "relative flex-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              active ? "text-bg" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={compact ? "scoring-pill-m" : "scoring-pill"}
                className="absolute inset-0 rounded-full bg-gradient-to-r from-rocket to-flame"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative whitespace-nowrap">{s.short}</span>
          </button>
        );
      })}
    </div>
  );
}
