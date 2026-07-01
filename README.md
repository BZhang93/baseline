# Baseline

Tour logistics for professional tennis players — minimize travel time and cost,
maximize ranking points and prize money, and surface accommodation/food options.

This repo is the **web app** (Next.js). The data scraper is a separate Python
service (a later ticket). See the PRD in Linear for the full product spec.

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
