"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeftRight,
  BarChart3,
  Home,
  ListOrdered,
  Menu,
  MessagesSquare,
  Radio,
  Repeat,
  TrendingUp,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { LogoMark, Wordmark } from "./Logo";
import { ScoringToggle } from "./ScoringToggle";
import { YahooAccount } from "./YahooAccount";
import { AccountButton } from "./AccountButton";
import type { Scoring } from "@/lib/types";

const YAHOO_SIGN_IN = process.env.NEXT_PUBLIC_YAHOO_SIGN_IN === "1";

type NavItem = { href: string; label: string; short: string; icon: LucideIcon };

/** Sidebar sections. */
const GROUPS: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [{ href: "/", label: "Home", short: "Home", icon: Home }] },
  {
    title: "Trade",
    items: [
      { href: "/values", label: "Trade Values", short: "Values", icon: BarChart3 },
      { href: "/trade", label: "Trade Analyzer", short: "Trade", icon: ArrowLeftRight },
      { href: "/trade-finder", label: "Trade Finder", short: "Finder", icon: Repeat },
    ],
  },
  {
    title: "Your team",
    items: [
      { href: "/my-team", label: "My Team", short: "Team", icon: Users },
      { href: "/assistant", label: "Trade Assistant", short: "Ask", icon: MessagesSquare },
    ],
  },
  {
    title: "This week",
    items: [
      { href: "/rankings", label: "Weekly Rankings", short: "Ranks", icon: ListOrdered },
      { href: "/waivers", label: "Waiver Wire", short: "Waivers", icon: TrendingUp },
      { href: "/live", label: "Live Tracker", short: "Live", icon: Radio },
      { href: "/team-of-the-week", label: "Team of the Week", short: "TOTW", icon: Trophy },
    ],
  },
];
export const NAV: NavItem[] = GROUPS.flatMap((g) => g.items);

/** Phone tab bar (everything else is under More). */
const BOTTOM = ["/my-team", "/values", "/trade", "/assistant"];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/values") return pathname.startsWith("/values") || pathname.startsWith("/players");
  if (href === "/trade") return pathname === "/trade";
  return pathname.startsWith(href);
}

export function Nav({ scoring }: { scoring: Scoring }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-bg/80 px-4 py-6 backdrop-blur-xl lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <LogoMark />
          <Wordmark />
        </Link>
        <nav className="no-scrollbar -mx-1 mt-7 flex flex-col gap-4 overflow-y-auto px-1">
          {GROUPS.map((g) => (
            <div key={g.title ?? "top"} className="flex flex-col gap-0.5">
              {g.title && <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-faint">{g.title}</p>}
              {g.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      active ? "text-ink" : "text-muted hover:bg-white/[0.03] hover:text-ink",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-xl border border-rocket/30 bg-gradient-to-r from-brand/25 to-brand-2/5"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                    <item.icon className={clsx("relative size-[18px]", active && "text-rocket")} />
                    <span className="relative">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto space-y-4 px-2">
          <AccountButton />
          {YAHOO_SIGN_IN && <YahooAccount />}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-faint">Scoring</p>
            <ScoringToggle scoring={scoring} />
            <p className="mt-4 text-[11px] leading-relaxed text-faint">Data via Sleeper. Values update every few minutes.</p>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark className="size-7" />
          <Wordmark />
        </Link>
        <ScoringToggle scoring={scoring} compact />
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => BOTTOM.includes(n.href)).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  active ? "text-ink" : "text-muted",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-active"
                    className="absolute top-0 h-0.5 w-10 rounded-full bg-gradient-to-r from-brand to-brand-2"
                  />
                )}
                <item.icon className={clsx("size-5", active && "text-rocket")} />
                {item.short}
              </Link>
            );
          })}
          <button
            onClick={() => setOpen(true)}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted"
          >
            <Menu className="size-5" />
            More
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-line-strong bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 38 }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-display text-lg font-bold uppercase tracking-wide">Menu</span>
                <button onClick={() => setOpen(false)} className="rounded-full p-2 text-muted hover:text-ink" aria-label="Close menu">
                  <X className="size-5" />
                </button>
              </div>
              <div className="mb-3 space-y-2">
                <AccountButton />
                {YAHOO_SIGN_IN && <YahooAccount />}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium",
                      isActive(pathname, item.href)
                        ? "border-rocket/40 bg-rocket/10 text-ink"
                        : "border-line bg-surface-2 text-muted",
                    )}
                  >
                    <item.icon className="size-5" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
