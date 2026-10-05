# Fantasy Trade Index 📈

A fantasy football trade companion: live 1–100 trade values, a trade analyzer, an AI trade assistant powered by Claude, a live weekly tracker and a Team of the Week, all with a dark, mobile-friendly UI.

Built with **Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Motion**, using the free [Sleeper API](https://docs.sleeper.com) for players, stats, projections, scores and leagues, plus the [Anthropic API](https://docs.claude.com) for the assistant.

## Features

| Page | What it does |
|---|---|
| **Home** | Hot players (last 3 games vs. season), top trade values, live top scorers, value risers and fallers |
| **Trade Values** (`/values`) | Every relevant QB/RB/WR/TE/K/DST on a 1–100 scale. Search, sort, and filter by position and team. Each player has a detail page with a value trend chart, factor breakdown, weekly points vs. projection and a game log |
| **Trade Analyzer** (`/trade`) | Build both sides and get a win / fair / lose verdict on an animated meter, plus suggested players to even out the deal. Trades are shareable by URL |
| **AI Assistant** (`/assistant`) | Chat with Claude about trades. It gets your roster, league scoring and live trade values, streams its answer, and returns 2–3 trade ideas as cards that open in the analyzer |
| **Live Tracker** (`/live`) | Refreshes every 60s: top scorers by position, booms and busts vs. projection, and a scoreboard with each game's top fantasy performers |
| **Team of the Week** (`/team-of-the-week`) | The highest-scoring possible lineup (QB, 2 RB, 2 WR, TE, FLEX, K, DST) on a football-field graphic, with a week picker |
| **My Team** (`/my-team`) | Import your team from **Sleeper**, **Yahoo** (sign in), **ESPN** (league ID; private leagues via cookies), a **screenshot** of any fantasy app (read by Claude), **pasted** roster text, or build one by hand. Includes a **Trade finder**: pick players to trade away and see what you could get, or pick a player you want and see what to offer. Shows total value, position grades, strongest/weakest spots, league power rankings, and a **game plan**: start/sit swaps, waiver pickups and trades you should make |

PPR, Half-PPR and Standard scoring are supported everywhere (toggle in the sidebar or header). Importing a Sleeper league switches to that league's format.

## Run it locally

You need **Node.js 20.9 or newer** ([download](https://nodejs.org)).

```bash
npm install
```

```bash
cp .env.example .env.local
```

Open `.env.local` and paste your Anthropic API key (from [console.anthropic.com](https://console.anthropic.com/)). The key is only needed for the AI Assistant; every other page works without it.

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Other scripts: `npm run build` (production build), `npm start` (serve the build), `npm run lint`.

## Tweaking the trade value formula

Everything lives in **[`lib/tradeValue.ts`](lib/tradeValue.ts)**, with the tunable settings at the top:

- `WEIGHTS`: how much each factor counts (season PPG 30%, last-3 form 15%, rest-of-season projection 25%, positional scarcity 15%, age 10%, bye week 5%)
- `REPLACEMENT_RANK`: the replacement-level player at each position (default: 12-team league)
- `POSITION_SCARCITY`, `STREAMABLE_DISCOUNT` (K/DST), `AGE_CURVE`, `INJURY_MULTIPLIER`, `byeScore()`, `DISPLAY_CURVE` (how compressed the 1–100 scale is)

Production is measured as **points over replacement**, which is what makes an RB1 worth more than a QB1 who scores more raw points. Save the file and the whole site updates (the cache key includes the formula settings).

**Value vs. power:** the displayed 1–100 value is compressed (good starters are 70+, the top ~10 are 90+, and ties are common). Each player also has a linear **power** proportional to production, and the Trade Analyzer, trade finder and AI assistant judge fairness on power. That way a 100 is never "fair" for two 70s.

Related settings:
- Trade verdict thresholds and the multi-player package discount: [`lib/tradeAnalysis.ts`](lib/tradeAnalysis.ts)
- Boom/bust thresholds: [`lib/live.ts`](lib/live.ts)
- Position-strength grades on My Team: [`lib/teamAnalysis.ts`](lib/teamAnalysis.ts)

## Game plan (recommendations)

On **My Team**, [`lib/advice.ts`](lib/advice.ts) builds:

- **Start / sit:** the best lineup for the coming week from Sleeper projections. It zeroes out players who are Out/IR, discounts Doubtful ones, and knows about byes. Swaps are compared against the lineup currently set in your league. Once most of a week's games are done, it plans for the next week.
- **Waiver pickups:** free agents in your league (anyone not on a roster) who would start for you or clearly beat your worst bench player. It never suggests dropping a starter or an injured player you're stashing.
- **Trades you should make:** every 1-for-1, 2-for-1 and 1-for-2 deal with each team in your league that's fair by trade value, raises your starting-lineup value, and doesn't gut theirs. All of this is pure math, so it's free to run.

The thresholds (`MIN_LINEUP_GAIN`, `MAX_PARTNER_LOSS`, `MIN_PICKUP_GAIN`…) are at the top of that file.

## Importing from a photo or pasted text

- **Photo** ([`app/api/roster/photo/route.ts`](app/api/roster/photo/route.ts)): upload a screenshot of your team page from any app. Claude reads the player names (structured output), and [`lib/rosterMatch.ts`](lib/rosterMatch.ts) matches them to our players, including abbreviations like "J. Gibbs". This needs `ANTHROPIC_API_KEY`, and it's limited to 10 uploads per hour per visitor.
- **Paste** ([`app/api/roster/text/route.ts`](app/api/roster/text/route.ts)): copy your whole team page and paste it. Names are matched locally, with no AI, so it's free.

## Importing from Yahoo and ESPN

All imported players are matched to Sleeper player IDs by name, position and NFL team ([`lib/playerMatch.ts`](lib/playerMatch.ts)). A few deep-bench players occasionally don't match; the import tells you how many.

### Yahoo sign-in (optional, needs a free Yahoo developer app)

1. Go to [developer.yahoo.com/apps/create](https://developer.yahoo.com/apps/create/) and create an app:
   - **Application Type:** Web Application
   - **Redirect URI(s):** `https://YOUR-SITE.vercel.app/api/yahoo/callback` (Yahoo requires https, so set this up on your Vercel deployment)
   - **API Permissions:** check **Fantasy Sports - Read**. This has to be checked when you create the app: Yahoo doesn't let you add permissions to an existing app.
2. Copy the **Client ID** and **Client Secret**.
3. In Vercel → Settings → Environment Variables, add `YAHOO_CLIENT_ID`, `YAHOO_CLIENT_SECRET`, and `SESSION_SECRET` (any long random string, e.g. from `openssl rand -base64 32`). Redeploy.

A "Sign in with Yahoo" button then appears in the sidebar and on My Team. Yahoo tokens are kept in an encrypted, httpOnly cookie in the user's own browser. There's no database, and signing out deletes the cookie. Code: [`lib/yahoo.ts`](lib/yahoo.ts), [`lib/yahooParse.ts`](lib/yahooParse.ts), `app/api/yahoo/*`.

### ESPN

ESPN has no official API, so the site uses the same endpoint ESPN's own website does ([`lib/espn.ts`](lib/espn.ts)), which could change without notice.

- **Public leagues:** paste the league ID or league URL.
- **Private leagues:** the user also pastes their `espn_s2` and `SWID` cookies (instructions are shown in the app). These are sent to ESPN once for that import, in the request body (never the URL), and are never stored.

## How data and caching work

- All Sleeper calls go through [`lib/sleeper.ts`](lib/sleeper.ts), server-side only. The stats, projections and scores endpoints are undocumented, so if Sleeper changes them, that's the one file to fix.
- **Two cache layers** keep the site fast and well under Sleeper's rate limit (1,000 calls/minute):
  1. Next.js's fetch cache (persists on Vercel). The current week's stats refresh every 60s and scores every 30s. Past weeks and projections refresh every few hours.
  2. A small in-memory cache ([`lib/memo.ts`](lib/memo.ts)) of parsed, trimmed data, with stale-while-revalidate.
- The ~15 MB player database is too big for the fetch cache, so it's trimmed to about 900 fantasy-relevant players and cached for 24 hours.
- Your team is stored in your browser (localStorage). There are no accounts and no database.

## The AI assistant

- [`app/api/assistant/route.ts`](app/api/assistant/route.ts) calls Claude with the official `@anthropic-ai/sdk` and streams the answer to the browser. **The API key stays on the server** and is never sent to the browser.
- Context sent to Claude: instructions, the top ~260 players' values and stats (prompt-cached, since it only changes every few minutes), your roster, your league's scoring settings, and the other teams' rosters. See [`lib/assistant.ts`](lib/assistant.ts).
- Default model: `claude-opus-5-5`. Set `ANTHROPIC_MODEL=claude-sonnet-5-5` to roughly halve the per-token cost.
- The request enables Anthropic's server-side refusal fallback (`fallbacks: "default"`), which re-runs a request on a fallback model if a safety classifier declines it.
- A simple per-IP rate limit (25 messages per 10 minutes per server instance) guards your credits on a public deploy. For stricter limits, set a monthly spend cap in the Anthropic Console.

## Deploy to Vercel (free)

1. Push this folder to a GitHub repository:

   ```bash
   git add -A
   ```

   ```bash
   git commit -m "Fantasy Trade Index"
   ```

   Then create an empty repo on GitHub and follow its "push an existing repository" instructions.

2. Go to [vercel.com/new](https://vercel.com/new), sign in with GitHub, and **import** the repo. Vercel detects Next.js automatically, so you can keep the default settings.
3. Before (or after) the first deploy, open **Settings → Environment Variables** and add:
   - `ANTHROPIC_API_KEY` = your key
   - (optional) `ANTHROPIC_MODEL`
4. Click **Deploy**. If you added the key after the first deploy, redeploy (Deployments → ⋯ → Redeploy) so it takes effect.

The free Hobby plan is plenty for this app. Every push to `main` redeploys automatically.

Or from the command line:

```bash
npx vercel
```

## Project layout

```
app/                 pages + API routes (App Router)
  api/assistant/     streaming Claude endpoint
  api/sleeper/       Sleeper user/league proxy for team import
  api/values/        trade value board as JSON
components/          shared UI (nav, charts, player badges, search…)
lib/
  sleeper.ts         every Sleeper API call
  tradeValue.ts      ← the trade value formula
  values.ts          builds the value board + weekly value trends
  tradeAnalysis.ts   trade verdicts + "even it out" suggestions
  teamAnalysis.ts    best lineup, position grades
  live.ts / totw.ts  live week + Team of the Week
  assistant.ts       Claude prompt + trade-card parsing
```

Data © Sleeper. Not affiliated with Sleeper or the NFL.
