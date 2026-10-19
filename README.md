# Baseline

**Schedule planning for aspiring pro tennis players trying to break through to the ATP tour.**

The climb from the ITF and Challenger circuits to the main tour is a logistics
problem as much as a tennis one. A player has a limited budget, a limited number
of weeks, a body that needs recovery, and a calendar of hundreds of events across
the world, each with its own entry cutoff, surface, prize money, and travel cost.
Most players plan this by gut feel and spreadsheets. Baseline replaces that with
a planner that weighs all of it at once.

## What it does

- **Optimizes a season schedule.** Given a player's ranking, budget, home base,
  and goals, it picks the set of events that best balances ranking points and
  prize money against travel cost and time.
- **Respects physical limits.** A "protect my body" dial thins the schedule by
  capping event frequency and penalizing long hauls and big time-zone changes.
- **Trades points against money.** A priority dial lets a player lean toward
  ranking points (to climb) or prize money (to stay funded).
- **Knows what you can actually get into.** Compares a player's rank against each
  event's entry cutoff, including qualifying, so the plan is about events the
  player can realistically play.
- **Forecasts results per event.** Estimates how deep a player is likely to go
  (for example "Likely QF, 30% SF+") and the expected points and prize money.
- **Counts the real cost.** Travel, lodging, and entry costs against expected
  prize money, with currencies converted, to show net after costs.
- **Plans in plain language.** "Plan with AI" turns a request like "clay swing in
  Europe, keep it light" into validated optimizer inputs. The AI never picks
  events itself: the deterministic optimizer does, and the AI only explains the
  picks.
- **Browse and compare.** Filter the calendar by region, tour, and surface,
  surface events reachable within budget, and compare events side by side.
- **Booking links.** Deep links for travel and lodging, and links to each
  event's official site.

## Who it is for

Players in the ranking range where scheduling decisions are hard and expensive:
roughly the ITF and Challenger levels, competing for entry into ATP and WTA
events. Men's and women's tours are both supported.

## Status

Working prototype running on a curated calendar of real events. Win forecasts
currently use a rank-based placeholder; the plan is to replace it with ratings
built from match results and real draws once a paid data feed is connected.

## Tech stack

- **Next.js 16 + TypeScript** (App Router) — the app + API. Deployed on **Vercel**.
- **Supabase** — managed Postgres database + authentication (login/signup).
- **Prisma** — the ORM (how our code talks to the database) + migrations.
- **Tailwind CSS** — styling.
- **Vitest** — tests.

Clean split: **Supabase = auth + hosted database; Prisma = data model + queries.**

---

## First-time setup (do this once)

You'll need three free accounts. Create them, then fill in `.env` (step 4).

### 1. Supabase (database + auth)
1. Go to [supabase.com](https://supabase.com) and sign up.
2. Create a new **project**. Pick a strong database password and **save it**.
3. Once it's ready, you'll collect four values in step 4.

### 2. GitHub (stores the code)
1. Create a repo (private is fine), e.g. `baseline`.
2. Push this project to it (a maintainer/AI can do this for you).

### 3. Vercel (hosting + deploys)
1. Go to [vercel.com](https://vercel.com) and sign up **with GitHub**.
2. **Import** the `baseline` repo. Vercel auto-detects Next.js.
3. Add the same environment variables from `.env` (step 4) in Vercel’s
   **Project Settings → Environment Variables**.
4. Deploy. From then on, every push to `main` deploys automatically, and every
   pull request gets its own **preview** URL.

### 4. Environment variables
Copy the example file and fill in your Supabase values:

```bash
cp .env.example .env
```

In your Supabase project:
- **Project Settings → Data API**: copy the **Project URL** and the **anon public** key.
- **Project Settings → Database → Connection string**: copy the **pooled**
  (Transaction, port 6543) and **direct** (Session, port 5432) strings.

Fill them into `.env`:

| Variable                        | Where it comes from                          |
| ------------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Data API → Project URL                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Data API → anon public key                   |
| `DATABASE_URL`                  | Database → pooled connection (port 6543)     |
| `DIRECT_URL`                    | Database → direct connection (port 5432)     |
| `AI_API_KEY`                    | Optional. Enables "Plan with AI" (OpenAI-compatible API key) |

> Never commit `.env`. Only `.env.example` is tracked in git.

---

## Running locally

```bash
pnpm install       # install dependencies (also generates the Prisma client)
pnpm db:migrate    # create the database tables (once your .env points at Supabase)
pnpm dev           # start the app at http://localhost:3000
```

Check it's healthy: open [http://localhost:3000/api/health](http://localhost:3000/api/health)
— it should return `{ "status": "ok", "db": "up" }`.

## Scripts

| Command             | What it does                                             |
| ------------------- | -------------------------------------------------------- |
| `pnpm dev`          | Run the app locally with hot reload                      |
| `pnpm build`        | Production build (generates Prisma client, then builds)  |
| `pnpm start`        | Run the production build locally                         |
| `pnpm lint`         | Lint the code                                            |
| `pnpm typecheck`    | Check TypeScript types                                   |
| `pnpm test`         | Run tests once                                           |
| `pnpm test:watch`   | Run tests in watch mode                                  |
| `pnpm db:migrate`   | Create/apply a database migration (development)          |
| `pnpm db:deploy`    | Apply migrations (production/CI)                         |
| `pnpm db:studio`    | Open Prisma Studio (a visual DB browser)                 |

## How the code is organized

```
src/
  app/
    page.tsx              landing page
    login/                signup + login (Supabase Auth)
    dashboard/            example protected page
    api/health/route.ts   health check (app + DB)
  lib/
    prisma.ts             database client (Prisma)
    supabase/             Supabase auth clients (browser + server)
    health.ts             pure health helper (unit-tested)
  proxy.ts                runs before requests: refreshes session, guards routes
prisma/
  schema.prisma           database schema (models land in ticket BRA-34)
```

> **Note (Next.js 16):** what older guides call "middleware" is now `proxy.ts`.

## Branching & deploys

Two long-lived branches:

- **`master`** — production. This is what deploys to the live site on Vercel.
  Only merge into `master` when a change is tested and ready to ship.
- **`develop`** — integration/testing. Run and test changes here locally
  (`pnpm dev`). Vercel also gives `develop` (and every PR) its own preview URL.

Day-to-day flow:

```
feature/bra-XX-...   ->  PR into develop  ->  test locally / preview  ->
merge to develop     ->  when ready, PR develop -> master  ->  auto-deploys
```

In Vercel, set the **Production Branch** to `master` (Project Settings → Git).

## Quality gates (CI)

Every push to `master`/`develop` and every pull request runs
**lint → typecheck → test → build** via GitHub Actions
(`.github/workflows/ci.yml`), and Vercel posts a preview deployment. Merge only
when CI is green and the change has been developed and tested with AI assistance.
