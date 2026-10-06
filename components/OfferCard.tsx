"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useAccount } from "@/lib/account";

export interface OfferProps {
  id: string;
  name: string;
  url: string;
  text: string;
  color: string;
}

/**
 * A clearly labeled partner offer (affiliate link) with the required 21+ and
 * responsible-gaming notice. Hidden for Premium members.
 */
export function OfferCard({ offer, title, className = "" }: { offer: OfferProps | null; title: string; className?: string }) {
  const account = useAccount();
  if (!offer || account.premium) return null;
  return (
    <aside className={`card relative overflow-hidden p-4 ${className}`} aria-label={`Partner offer from ${offer.name}`}>
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full blur-3xl" style={{ background: `color-mix(in srgb, ${offer.color} 25%, transparent)` }} />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-faint">
            Partner offer · <span style={{ color: offer.color }}>{offer.name}</span>
          </p>
          <p className="mt-0.5 font-display text-lg font-bold uppercase leading-tight">{title}</p>
          <p className="text-sm text-muted">{offer.text}</p>
        </div>
        <a
          href={offer.url}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-bg transition hover:brightness-110"
          style={{ background: offer.color }}
        >
          Claim offer <ExternalLink className="size-4" />
        </a>
      </div>
      <p className="relative mt-3 text-[10px] leading-relaxed text-faint">
        Ad. We may earn a commission. 21+ (19+ in AL and NE; 18+ in some states). Not available in all states; terms apply. Gambling problem? Call 1-800-GAMBLER.{" "}
        <Link href="/responsible-gaming" className="underline underline-offset-2 hover:text-muted">
          Responsible gaming
        </Link>
      </p>
    </aside>
  );
}
