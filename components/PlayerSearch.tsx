"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Search } from "lucide-react";
import clsx from "clsx";
import { PlayerAvatar, PosBadge, ValueBadge } from "./PlayerBits";
import type { PlayerValue } from "@/lib/types";

/** Type-ahead search over the trade value board. */
export function PlayerSearch({
  players,
  exclude = [],
  onSelect,
  placeholder = "Search players to add…",
  autoFocus = false,
}: {
  players: PlayerValue[];
  exclude?: string[];
  onSelect: (p: PlayerValue) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const ex = new Set(exclude);
    return players
      .filter((p) => !ex.has(p.id) && (p.name.toLowerCase().includes(term) || p.team?.toLowerCase() === term))
      .sort((a, b) => {
        const as = a.name.toLowerCase().startsWith(term) || a.name.toLowerCase().includes(` ${term}`) ? 0 : 1;
        const bs = b.name.toLowerCase().startsWith(term) || b.name.toLowerCase().includes(` ${term}`) ? 0 : 1;
        return as - bs || b.value - a.value;
      })
      .slice(0, 8);
  }, [q, players, exclude]);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function choose(p: PlayerValue) {
    onSelect(p);
    setQ("");
    setActive(0);
  }

  return (
    <div ref={wrap} className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-3 text-sm outline-none transition placeholder:text-faint focus:border-rocket/50 focus:ring-4 focus:ring-rocket/10"
      />
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-line-strong bg-surface-2 py-1 shadow-2xl shadow-black/60"
          >
            {results.map((p, i) => (
              <li key={p.id} role="option" aria-selected={i === active}>
                <button
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(p)}
                  className={clsx("flex w-full items-center gap-3 px-3 py-2 text-left", i === active && "bg-white/[0.05]")}
                >
                  <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <PosBadge pos={p.position} /> {p.team}
                    </span>
                  </span>
                  <ValueBadge value={p.value} size="sm" />
                  <Plus className="size-4 text-faint" />
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
