import Link from "next/link";
import { LogoMark } from "./Logo";
import { NewsletterSignup } from "./NewsletterSignup";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line pt-8 pb-4 text-xs text-faint">
      <div className="grid gap-8 md:grid-cols-2">
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
        <div className="w-full max-w-sm md:justify-self-end">
          <p className="mb-2 text-sm font-semibold text-ink">
            The Weekly Trade Report <span className="font-normal text-faint">· free, every week</span>
          </p>
          <NewsletterSignup source="footer" compact />
        </div>
        <nav className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3 md:col-span-2 md:flex md:flex-wrap md:gap-x-6">
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
          <Link href="/newsletter" className="hover:text-muted">
            Weekly report
          </Link>
          <Link href="/responsible-gaming" className="hover:text-muted">
            Responsible gaming
          </Link>
        </nav>
      </div>
      <p className="mt-6">
        © {new Date().getFullYear()} Fantasy Trade Index. Not affiliated with the NFL, Yahoo, ESPN, Sleeper or FantasyCalc. For entertainment and informational use.
      </p>
    </footer>
  );
}
