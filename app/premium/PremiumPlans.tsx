"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, Crown, Loader2, Sparkles } from "lucide-react";
import { useAccount } from "@/lib/account";

type Plan = "monthly" | "season";

export function PremiumPlans({
  prices,
  offered,
  perks,
  free,
  welcome,
}: {
  prices: { monthly: string | null; season: string | null };
  offered: { monthly: boolean; season: boolean };
  perks: { title: string; text: string }[];
  free: string[];
  welcome: boolean;
}) {
  const account = useAccount();
  const [busy, setBusy] = useState<Plan | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);

  // Right after checkout, Stripe's confirmation can take a few seconds to arrive.
  useEffect(() => {
    if (!welcome || account.premium || polls > 6) return;
    const t = setTimeout(() => {
      fetch("/api/me")
        .then((r) => r.json())
        .then((d) => {
          if (d.premium) window.location.replace("/premium");
          else setPolls((n) => n + 1);
        });
    }, 2500);
    return () => clearTimeout(t);
  }, [welcome, account.premium, polls]);

  async function go(url: string, body: object | null, key: Plan | "portal") {
    setBusy(key);
    setError(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok && data?.url) {
      window.location.assign(data.url);
      return;
    }
    setBusy(null);
    // Google sign-in is a server redirect (an API route), so it needs a full page load.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (data?.error === "sign_in") window.location.assign(`${window.location.origin}/api/auth/google/login?next=/premium`);
    else setError(data?.error ?? "Something went wrong. Please try again.");
  }

  const plans: { id: Plan; name: string; price: string | null; note: string; best?: boolean }[] = [
    { id: "season", name: "Season pass", price: prices.season, note: "One payment, Premium through the fantasy playoffs (Feb 15). No auto-renew.", best: true },
    { id: "monthly", name: "Monthly", price: prices.monthly, note: "Renews monthly. Cancel anytime in one click." },
  ];

  return (
    <div className="space-y-5">
      {welcome && (
        <div className="flex items-center gap-2 rounded-2xl border border-up/30 bg-up/10 px-4 py-3 text-sm text-up">
          <Sparkles className="size-4" /> {account.premium ? "Welcome to Premium! Everything is unlocked." : "Payment received. Unlocking Premium…"}
        </div>
      )}

      {account.premium ? (
        <section className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white">
              <Crown className="size-6" />
            </span>
            <div>
              <div className="font-display text-2xl font-bold uppercase">You&apos;re Premium</div>
              <p className="text-sm text-muted">
                {account.premium.plan === "season" ? "Season pass" : "Monthly"} · {account.premium.cancelsAtPeriodEnd || account.premium.plan === "season" ? "ends" : "renews"}{" "}
                {new Date(account.premium.until).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
          {account.premium.canManage && (
            <button
              onClick={() => go("/api/premium/portal", null, "portal")}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-5 text-sm font-semibold transition hover:bg-white/5"
            >
              {busy === "portal" && <Loader2 className="size-4 animate-spin" />} Manage billing
            </button>
          )}
        </section>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          {plans
            .filter((p) => offered[p.id])
            .map((p) => (
              <section key={p.id} className={clsx("card relative flex flex-col p-6", p.best && "border-rocket/50")}>
                {p.best && <span className="absolute -top-2.5 right-5 rounded-full bg-gradient-to-r from-brand to-brand-2 px-3 py-0.5 text-[11px] font-bold text-white">Best value</span>}
                <div className="font-display text-xl font-bold uppercase">{p.name}</div>
                <div className="mt-1 font-display text-4xl font-extrabold">{p.price ?? <span className="text-xl text-muted">Price shown at checkout</span>}</div>
                <p className="mt-1 text-sm text-muted">{p.note}</p>
                <button
                  onClick={() => go("/api/premium/checkout", { plan: p.id }, p.id)}
                  disabled={!!busy}
                  className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {busy === p.id ? <Loader2 className="size-4 animate-spin" /> : <Crown className="size-4" />}
                  {account.user ? `Get ${p.name}` : "Sign in with Google to upgrade"}
                </button>
              </section>
            ))}
        </div>
      )}
      {error && <p className="rounded-xl bg-down/10 px-3 py-2 text-sm text-down">{error}</p>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase">
            <Crown className="size-5 text-rocket" /> Premium adds
          </h2>
          <ul className="space-y-3">
            {perks.map((p) => (
              <li key={p.title} className="flex gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-up" />
                <span>
                  <b>{p.title}.</b> <span className="text-muted">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-6">
          <h2 className="mb-3 font-display text-xl font-bold uppercase">Always free</h2>
          <ul className="space-y-2">
            {free.map((f) => (
              <li key={f} className="flex gap-2.5 text-sm text-muted">
                <Check className="mt-0.5 size-4 shrink-0 text-faint" /> {f}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="text-xs text-faint">Payments are handled securely by Stripe. We never see your card. Questions about a charge? Use Manage billing, or see our Terms.</p>
    </div>
  );
}
