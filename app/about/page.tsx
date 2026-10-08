import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Prose } from "@/components/Prose";
import { FAIR_PERCENT } from "@/lib/tradeAnalysis";
import { MARKET_WEIGHT, MARKET_WEIGHT_MIN } from "@/lib/tradeValue";

export const metadata: Metadata = {
  title: "How It Works",
  description: "How Fantasy Trade Index values players, judges trades, finds fair offers and sets your best lineup.",
};

const FAQ: [string, React.ReactNode][] = [
  ["Is it free?", "Yes. No account, no ads, no paywall. Signing in with Google is optional and only saves your team so it follows you to other devices."],
  [
    "Why is a 97 worth so much more than a 74?",
    <>
      The 1–100 scale is compressed so good starters all land in the 70s–90s. Trades are judged on <b>trade weight</b>, which follows real trade prices: an elite
      player is worth several mid-level starters. A 100 takes about two 90s, while 97 + 74 or three 85s still fall short.
    </>,
  ],
  ["Which formats do the values fit?", "Redraft, 12-team, one-QB leagues, in PPR, half-PPR or standard scoring (pick it in the sidebar). Dynasty and superflex values aren't supported yet."],
  ["How often do values update?", "Stats and projections refresh every few minutes during the week; market prices refresh every few hours."],
  ["Can it set my real Yahoo, ESPN or Sleeper lineup?", "No, those apps don't allow it. The auto lineup shows the best lineup here and lists the exact moves to make in your league app."],
  ["Does the Trade Assistant use AI?", "No. It recognizes your question and answers it with the same math as the rest of the site, instantly."],
  ["Is my screenshot uploaded?", "No. Photo import reads the picture inside your browser. Only the text it finds is sent to match player names."],
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="Methodology"
        title={
          <>
            How it <span className="text-gradient">works</span>
          </>
        }
        subtitle="Everything on the site comes from the same values and the same rules, so a trade card, the analyzer and the assistant always agree."
      />
      <Prose>
        <h2>Player values (1–100)</h2>
        <p>
          Each value blends <b>the real trade market</b> (FantasyCalc, built from thousands of real fantasy trades) with <b>our stats model</b>. The market leads early in
          the season ({Math.round(MARKET_WEIGHT * 100)}% in week 1) and hands over to this season&apos;s results week by week, down to{" "}
          {Math.round(MARKET_WEIGHT_MIN * 100)}% by week 11, so values keep moving as players prove themselves. The model scores everything as points over a
          replacement-level starter:
        </p>
        <ul>
          <li>
            <b>Projections</b> for the rest of the season, averaging Sleeper&apos;s and ESPN&apos;s (two projection systems beat one)
          </li>
          <li>
            <b>Production</b>: season points per game and the last three games
          </li>
          <li>
            <b>Opportunity</b>: what his targets, carries and pass attempts usually score, so a starter getting the ball is credited even before the points show up
          </li>
          <li>
            <b>Role</b>: his depth chart spot, share of snaps, and how many ESPN managers start him
          </li>
          <li>
            <b>Injuries and news</b>: designations refresh through the day from ESPN and Sleeper, and trim both the model and the market price
          </li>
          <li>
            <b>Scarcity, age and bye weeks</b>
          </li>
        </ul>
        <p>That&apos;s what makes an RB1 worth more than a QB who scores more raw points, and a backup worth less than his name.
        </p>
        <p>
          Values are grouped into tiers: <b>Elite</b> (93+), <b>Star</b> (85+), <b>Starter</b> (76+), <b>Flex</b> (65+) and <b>Depth</b>. See them on the{" "}
          <Link href="/values">trade value chart</Link>.
        </p>

        <h2>Judging a trade</h2>
        <p>
          Trades are weighed on <b>trade weight</b>: each player&apos;s share of the top player&apos;s market price, trimmed for injuries. Packages count for less than
          their sum: each side&apos;s best player counts in full, and every other player only fills a lineup spot you could fill from your bench, so he counts for his
          weight minus a bench player&apos;s (more when a star is in the deal). That&apos;s why two good players don&apos;t buy a great one, and why a 2-for-1 or 3-for-1
          has to give more than it looks like. A trade is <b>fair</b> when the two sides are within {Math.round(FAIR_PERCENT * 100)}%. Every trade also gets a letter
          grade, a risk-vs-reward rating (injuries, age, boom-or-bust weeks) and, with your team imported, the change to your starting lineup in projected points a week.
        </p>

        <h2>Finding trades</h2>
        <p>
          The <Link href="/trade-finder">trade finder</Link> only suggests deals that are close to even, keep every one of your starting spots filled, and, in an imported
          league, don&apos;t weaken the other team&apos;s lineup, so the other manager has a reason to say yes. Deals that make both lineups better (marked{" "}
          <b>Win-win</b>) come first. Cards tell you when you&apos;d need to drop someone.
        </p>

        <h2>Auto lineup</h2>
        <p>
          My Team starts the players projected to score the most this week, using Sleeper&apos;s projections. Players on bye or ruled out never start, and it updates as
          injuries change. Move a player by hand any time; tap Auto lineup to switch back.
        </p>

        <h2 id="faq" className="scroll-mt-20">
          FAQ
        </h2>
        <div className="space-y-4">
          {FAQ.map(([q, a]) => (
            <div key={q}>
              <h3>{q}</h3>
              <p className="mt-1">{a}</p>
            </div>
          ))}
        </div>

        <h2>Credits</h2>
        <p>
          Player data, stats, projections and leagues from the free <a href="https://docs.sleeper.com">Sleeper API</a>. Trade-market values from{" "}
          <a href="https://www.fantasycalc.com">FantasyCalc</a>. Screenshot reading by <a href="https://github.com/naptha/tesseract.js">Tesseract.js</a>. Not
          affiliated with the NFL or any fantasy platform.
        </p>
      </Prose>
    </>
  );
}
