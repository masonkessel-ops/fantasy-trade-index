"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { ReportPlayer, WeeklyReport } from "@/lib/report";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Builds this week's issue as simple email HTML, to paste into the newsletter editor (beehiiv). */
function toEmail(r: WeeklyReport, siteUrl: string) {
  const link = (p: ReportPlayer) => `<a href="${siteUrl}/players/${p.id}">${esc(p.name)}</a>`;
  const list = (title: string, ps: ReportPlayer[]) =>
    ps.length ? `<h2>${title}</h2><ul>${ps.map((p) => `<li><b>${link(p)}</b> (${p.position}, ${p.team ?? "FA"}${p.value !== null ? `, value ${p.value}` : ""}): ${esc(p.note)}</li>`).join("")}</ul>` : "";
  const leaders = (["QB", "RB", "WR", "TE"] as const).map((pos) => `<li><b>${pos}:</b> ${r.projected[pos].map((p) => `${link(p)} (${esc(p.note)})`).join(", ")}</li>`).join("");
  return [
    `<h1>The Weekly Trade Report: Week ${r.week}</h1>`,
    `<p>Your two-minute look at the fantasy trade market this week. Check any trade at <a href="${siteUrl}/trade">Fantasy Trade Index</a>.</p>`,
    list("📈 Biggest risers", r.risers),
    list("📉 Biggest fallers", r.fallers),
    list("🛒 Buy low", r.buyLow),
    list("💰 Sell high", r.sellHigh),
    list("🔥 Hottest waiver adds", r.adds),
    `<h2>⭐ Projected leaders</h2><ul>${leaders}</ul>`,
    `<p>Set your best lineup automatically and find fair trades for your roster at <a href="${siteUrl}/my-team">${siteUrl.replace(/^https?:\/\//, "")}</a>.</p>`,
  ].join("\n");
}

export function CopyReport({ report, siteUrl }: { report: WeeklyReport; siteUrl: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const html = toEmail(report, siteUrl);
    const text = html.replace(/<li>/g, "• ").replace(/<\/(h1|h2|p|li)>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
    } catch {
      await navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }
  return (
    <button
      onClick={copy}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold text-muted transition hover:bg-white/5 hover:text-ink"
      title="Copies this week's issue, formatted, to paste into your newsletter editor"
    >
      {copied ? <Check className="size-4 text-up" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy for newsletter"}
    </button>
  );
}
