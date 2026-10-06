"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Loader2, Mail } from "lucide-react";

/** Email signup for the free weekly trade report. */
export function NewsletterSignup({ source, compact = false, className }: { source: string; compact?: boolean; className?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const company = new FormData(e.currentTarget).get("company");
    setState("busy");
    const res = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, source, company }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok) {
      setState("done");
      setMessage("You're in. Check your inbox.");
    } else {
      setState("error");
      setMessage(data?.error ?? "Couldn't sign you up right now.");
    }
  }

  const form =
    state === "done" ? (
      <p className="flex items-center gap-2 text-sm font-semibold text-up">
        <Check className="size-4" /> {message}
      </p>
    ) : (
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          aria-label="Email address"
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-4 text-sm outline-none placeholder:text-faint focus:border-rocket/50"
        />
        <button
          disabled={state === "busy"}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-2 px-5 text-sm font-bold text-bg transition hover:brightness-110 disabled:opacity-60"
        >
          {state === "busy" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Get it free
        </button>
      </form>
    );

  if (compact)
    return (
      <div className={className}>
        {form}
        {state === "error" && <p className="mt-1.5 text-xs text-down">{message}</p>}
      </div>
    );

  return (
    <section className={clsx("card relative overflow-hidden p-5 sm:p-6", className)}>
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-brand/25 blur-3xl" />
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rocket">Free weekly email</p>
        <h2 className="mt-1 font-display text-2xl font-bold uppercase leading-tight">The Weekly Trade Report</h2>
        <p className="mb-4 mt-1 max-w-xl text-sm text-muted">
          Every week: the biggest value risers and fallers, buy-low and sell-high targets, and the waiver adds everyone&apos;s making. Two minutes, free, unsubscribe anytime.
        </p>
        {form}
        {state === "error" && <p className="mt-2 text-xs text-down">{message}</p>}
      </div>
    </section>
  );
}
