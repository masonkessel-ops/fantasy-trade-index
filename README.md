# Fantasy Trade Index 📈

A fantasy football trade companion: live 1–100 trade values, a trade analyzer, a trade finder, an instant trade assistant (no AI), a live weekly tracker and a Team of the Week, all with a dark, mobile-friendly UI.

Built with **Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Motion**, using the free [Sleeper API](https://docs.sleeper.com) for players, stats, projections, scores and leagues, plus [FantasyCalc](https://www.fantasycalc.com/) market values and [Tesseract.js](https://github.com/naptha/tesseract.js) to read roster screenshots in the browser. No API keys or AI needed.

## Features

| Page | What it does |
|---|---|
| **Home** | Hot players (last 3 games vs. season), top trade values, live top scorers, value risers and fallers |
| **Trade Values** (`/values`) | Every relevant QB/RB/WR/TE/K/DST on a 1–100 scale. Search, sort, and filter by position and team. Each player has a detail page with a value trend chart, factor breakdown, weekly points vs. projection and a game log |
| **Trade Analyzer** (`/trade`) | Build both sides and get a win / fair / lose verdict on an animated meter, plus suggested players to even out the deal. Trades are shareable by URL |
| **Trade Assistant** (`/assistant`) | Ask about trades, values and lineups in plain English ("Walker for Puka?", "What can I get for McBride?", "Who should I start?"). It can also build trades ("make me a trade with Walker and Rice", "make me a trade for a QB"). Answers instantly from the site's own math, no AI |
| **Live Tracker** (`/live`) | Refreshes every 60s: top scorers by position, booms and busts vs. projection, and a scoreboard with each game's top fantasy performers |
| **Team of the Week** (`/team-of-the-week`) | The highest-scoring possible lineup (QB, 2 RB, 2 WR, TE, FLEX, K, DST) on a football-field graphic, with a week picker |
| **My Team** (`/my-team`) | Starting lineup and bench with this week's points (tap a player for their card and a **Trade away** shortcut). Sign in with Google to save your team. Import from **Sleeper**, **Yahoo** (sign in), **ESPN** (league ID; private leagues via cookies), a **screenshot** of any fantasy app (read in your browser, no AI), **pasted** roster text, or build one by hand. Includes a **Trade finder**: pick players to trade away and see what you could get, or pick a player you want and see what to offer. Shows total value, position grades, strongest/weakest spots, league power rankings, and a **game plan**: start/sit swaps, waiver pickups and trades you should make |

PPR, Half-PPR and Standard scoring are supported everywhere (toggle in the sidebar or header). Importing a Sleeper league switches to that league's format.

## Run it locally

You need **Node.js 20.9 or newer** ([download](https://nodejs.org)).

```bash
npm install
```

```bash
cp .env.example .env.local
```

Every setting in `.env.local` is optional (Yahoo sign-in, Google sign-in, saved teams). The site works without any of them.

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

**Market blend:** each value is `MARKET_WEIGHT` (60%) real trade-market price and 40% the stats model above. Market prices come from [FantasyCalc](https://www.fantasycalc.com/) (redraft, 12 teams, 1 QB, matching PPR/half/standard), which are built from thousands of real fantasy trades; see [`lib/market.ts`](lib/market.ts). If FantasyCalc is unreachable, the site falls back to the stats model alone.

**Value vs. trade weight:** the displayed 1–100 value is compressed (`DISPLAY_CURVE`): good starters are 80+, the top ~150 are about 60+, and ties are common. Trades are judged on **trade weight** ("power"), each player's linear share of the top player's blended price, so stars cost what the market says they cost. A 100 takes about two 90s or three 85s, 80 + 80 + 60 falls about 45% short, and 70 + 30 is nowhere close.

**Trade Finder:** [`lib/tradeFinder.ts`](lib/tradeFinder.ts) powers the `/trade-finder` page ("Trade away" and "Trade for"). Ideas must be fair (`MAX_EDGE`, `MAX_SHOP_DISCOUNT`, `MAX_OVERPAY`), can't leave one of your starting slots empty, and with an imported league must not gut the other team's lineup (`MAX_PARTNER_LOSS`). Cards say when you'd need to drop someone.

**Risk vs reward:** [`lib/risk.ts`](lib/risk.ts) rates each player's risk (injury, age, boom/bust weeks, small sample, falling value). Every trade shows the value edge next to the risk you take on or shed, and the trade finder ranks ideas with risk included.

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

## Accounts: Sign in with Google (optional)

People can sign in with Google to save their team to an account and open it on any device. While signed in, edits save automatically, and the newer copy (this browser's or the account's) wins when you sign in. Code: [`lib/auth.ts`](lib/auth.ts), [`lib/store.ts`](lib/store.ts), [`lib/account.ts`](lib/account.ts), `app/api/auth/*`, `app/api/me/*`.

Setup (two free services):
1. **Database:** in Vercel → your project → **Storage** → **Create Database** → **Upstash for Redis** (free plan) → connect it to the project. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
2. **Google sign-in:** at [console.cloud.google.com](https://console.cloud.google.com), create a project, open **Google Auth Platform** and fill in the app name and support email (Audience: External). Then go to **Clients → Create client → Web application** and add the redirect URI `https://YOUR-SITE.vercel.app/api/auth/google/callback`. Put the Client ID and secret in Vercel as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (`SESSION_SECRET` must also be set). Under **Audience**, click **Publish app** so anyone can sign in. It only asks for name/email/photo, so Google doesn't require a review.
3. Redeploy. A "Sign in with Google" button appears in the sidebar and on My Team.

## Importing from a photo or pasted text

- **Photo** (`readScreenshot` in [`app/my-team/TeamSetup.tsx`](app/my-team/TeamSetup.tsx)): choose a screenshot of your team page from any app. The browser cleans it up (grayscale, flips dark mode, boosts contrast) and reads the text with [Tesseract.js](https://github.com/naptha/tesseract.js); the picture never leaves the device. The text then goes through the same matcher as pasted text, [`lib/rosterMatch.ts`](lib/rosterMatch.ts), which handles abbreviations like "J. Gibbs" and small misreadings like "Kenneth Waiker". No API key needed; the reader (a few MB) downloads from a CDN the first time.
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

## The Trade Assistant

The assistant answers without AI: [`lib/bot/names.ts`](lib/bot/names.ts) finds the players in a question (full names, last names, nicknames like "jsn", small typos) and [`lib/bot/engine.ts`](lib/bot/engine.ts) recognizes the kind of question (trade check, make me a trade, what can I get, what would it take, start/sit, best lineup, value, compare, rankings, risers/fallers, buy low/sell high, team grades) and answers with the trade analyzer, trade finder and lineup math. To teach it a new kind of question, add a rule and an answer function in `engine.ts`.

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
3. Click **Deploy**. No environment variables are required; the optional ones (Yahoo, Google sign-in, saved teams) are covered below. If you add one after the first deploy, redeploy (Deployments → ⋯ → Redeploy) so it takes effect.

The free Hobby plan is plenty for this app. Every push to `main` redeploys automatically.

Or from the command line:

```bash
npx vercel
```

## Project layout

```
app/                 pages + API routes (App Router)
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
  bot/               Trade Assistant: name finder + question engine (no AI)
```

Data © Sleeper. Not affiliated with Sleeper or the NFL.
