# Data model (BRA-34)

The source of truth is `prisma/schema.prisma`. This is the narrative overview.

## Entities

**Reference / tour data**
- **TournamentCategory** — standardized points & prize money per tier per season
  (e.g. `ATP_250` in 2026). Ground truth the scraper later validates against;
  the seed populates it now. Unique on `(tour, tier, season)`.
- **Tournament** — a specific event edition. Links to its `TournamentCategory`
  for points/prize. Unique on `(name, edition)` so loads are idempotent.
- **RankingEntry** — a row of an official ranking list at a point in time
  (`tour`, `rank`, `points`, `asOfDate`). Powers the cutoff gap math.
- **Cutoff** — per-tournament entry cutoff, both **live** and **historical**
  views (PRD §6.3.1). One-to-one with Tournament.

**Player & planning**
- **Player** — an app user's profile, linked to the Supabase auth user via
  `userId`. Holds ranking, home base, budget/surface/diet/lodging preferences.
- **Schedule** ("leg") — the core object the UI is built around: a planned
  stretch with constraints (window, budget, max events, rest days), the
  objective **weighting** (points/money vs. travel), and cached blended scores.
- **ScheduleItem** — a tournament in a schedule, in play order.
- **TravelLeg** — a travel hop (flight/ground) between consecutive events, with
  duration/cost estimates.

**On-the-ground (Phase 2 stubs)**
- **Accommodation**, **DiningInfo** — keyed to a tournament; populated later.

## Relationships

```
TournamentCategory 1──* Tournament 1──1 Cutoff
                                   1──* ScheduleItem *──1 Schedule *──1 Player
                                   1──* Accommodation
                                   1──1 DiningInfo
Schedule 1──* TravelLeg
RankingEntry (standalone list rows)
```

## Loading data

Anything that supplies data implements the **`DataSource`** contract
(`src/lib/data/types.ts`): `categories()`, `tournaments()`, `rankings()`.
`loadIntoDatabase()` (`src/lib/data/load.ts`) upserts a `DataSource` into the
tables on natural keys, so it's **idempotent**. The curated seed (BRA-40) and
the scraper output (BRA-36/37) both implement this same contract — which is how
we swap seed data for live data without touching the app.

## Migrations

Single initial migration: `prisma/migrations/*_init_data_model`. Create new
migrations with `pnpm db:migrate`; apply in CI/prod with `pnpm db:deploy`.
