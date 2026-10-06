import type { Metadata } from "next";
import Link from "next/link";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { PageHeader } from "@/components/PageHeader";
import { PlayerAvatar, PosBadge, ValueBadge } from "@/components/PlayerBits";
import { getScoring } from "@/lib/prefs";
import { getWeeklyReport, type ReportPlayer } from "@/lib/report";
import { SITE_URL } from "@/lib/site";
import { CopyReport } from "./CopyReport";

export const metadata: Metadata = {
  title: "Weekly Trade Report",
  description: "This week's fantasy football trade value risers and fallers, buy-low and sell-high targets, top waiver adds and projected leaders.",
};

export default async function NewsletterPage() {
  const scoring = await getScoring();
  const r = await getWeeklyReport(scoring);
  return (
    <>
      <PageHeader
        eyebrow={`${r.season} · Week ${r.week}`}
        title={
          <>
            Weekly Trade <span className="text-gradient">Report</span>
          </>
        }
        subtitle="The week in fantasy trade values, built from live market prices and stats. Get it in your inbox every week."
        right={<CopyReport report={r} siteUrl={SITE_URL} />}
      />
      <div className="space-y-5">
        <NewsletterSignup source="report-page" />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
          <Section title="Biggest risers" emoji="📈" players={r.risers} />
          <Section title="Biggest fallers" emoji="📉" players={r.fallers} />
          <Section title="Buy low" emoji="🛒" players={r.buyLow} empty="No clear buy-low targets this week." />
          <Section title="Sell high" emoji="💰" players={r.sellHigh} empty="No clear sell-high candidates this week." />
          <Section title="Hottest waiver adds" emoji="🔥" players={r.adds} link={{ href: "/waivers", label: "Full waiver wire" }} />
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold uppercase tracking-wide">⭐ Projected leaders</h2>
              <Link href="/rankings" className="text-xs font-semibold text-rocket hover:underline">
                All rankings
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {(["QB", "RB", "WR", "TE"] as const).map((pos) => (
                <div key={pos}>
                  <PosBadge pos={pos} />
                  <ol className="mt-1.5 space-y-1 text-sm">
                    {r.projected[pos].map((p) => (
                      <li key={p.id} className="flex justify-between gap-2">
                        <Link href={`/players/${p.id}`} className="truncate hover:underline">
                          {p.name}
                        </Link>
                        <span className="shrink-0 text-xs text-muted">{p.note.split(" ")[0]}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Section({ title, emoji, players, empty, link }: { title: string; emoji: string; players: ReportPlayer[]; empty?: string; link?: { href: string; label: string } }) {
  return (
    <section className="card p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">
          {emoji} {title}
        </h2>
        {link && (
          <Link href={link.href} className="text-xs font-semibold text-rocket hover:underline">
            {link.label}
          </Link>
        )}
      </div>
      {players.length === 0 ? (
        <p className="py-4 text-sm text-faint">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {players.map((p) => (
            <li key={p.id}>
              <Link href={`/players/${p.id}`} className="flex items-center gap-3 py-2.5 transition hover:opacity-80">
                <PlayerAvatar id={p.id} position={p.position} team={p.team} name={p.name} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{p.name}</span>
                    <PosBadge pos={p.position} />
                  </span>
                  <span className="block truncate text-xs text-muted">{p.note}</span>
                </span>
                {p.value !== null && <ValueBadge value={p.value} size="sm" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
