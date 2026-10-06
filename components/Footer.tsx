import Link from "next/link";
import { LogoMark } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line pt-8 pb-4 text-xs text-faint">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <LogoMark className="size-6" /> Fantasy Trade Index
          </div>
          <p className="mt-2 leading-relaxed">
            Free fantasy football trade values, trade analyzer, trade finder and lineup help. Player data from{" "}
            <a href="https://sleeper.com" className="underline decoration-white/20 underline-offset-2 hover:text-muted">
              Sleeper
            </a>
            ; market values from{" "}
            <a href="https://www.fantasycalc.com" className="underline decoration-white/20 underline-offset-2 hover:text-muted">
              FantasyCalc
            </a>
            .
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
          <Link href="/about" className="hover:text-muted">
            How it works
          </Link>
          <Link href="/values" className="hover:text-muted">
            Trade values
          </Link>
          <Link href="/trade" className="hover:text-muted">
            Trade analyzer
          </Link>
          <Link href="/privacy" className="hover:text-muted">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-muted">
            Terms
          </Link>
          <Link href="/about#faq" className="hover:text-muted">
            FAQ
          </Link>
        </nav>
      </div>
      <p className="mt-6">
        © {new Date().getFullYear()} Fantasy Trade Index. Not affiliated with the NFL, Yahoo, ESPN, Sleeper or FantasyCalc. For entertainment and informational use.
      </p>
    </footer>
  );
}
