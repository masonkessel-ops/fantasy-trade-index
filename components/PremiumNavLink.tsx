"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import { useAccount } from "@/lib/account";

/** "Go Premium" in the menus once Premium is for sale; a badge for members. */
export function PremiumNavLink({ onClick }: { onClick?: () => void }) {
  const a = useAccount();
  if (!a.loaded || !a.premiumAvailable) return null;
  return a.premium ? (
    <Link href="/premium" onClick={onClick} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rocket hover:bg-white/[0.03]">
      <Crown className="size-4" /> Premium member
    </Link>
  ) : (
    <Link
      href="/premium"
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-2 px-3 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
    >
      <Crown className="size-4" /> Go Premium
    </Link>
  );
}
