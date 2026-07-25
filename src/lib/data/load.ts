import type { PrismaClient } from "@/generated/prisma/client";
import type { DataSource, LoadedData } from "./types";
import { circuitForTournament } from "@/lib/circuit";

export interface LoadResult {
  categories: number;
  tournaments: number;
  cutoffs: number;
  rankings: number;
}

// Key for matching a tournament to its points/prize category.
function categoryKey(tour: string, tier: string, season: number): string {
  return `${tour}:${tier}:${season}`;
}

// Fetches all of a DataSource's data into memory so it can be validated as a
// unit before any of it is promoted to the live tables (BRA-36 gate).
export async function fetchDataSource(source: DataSource): Promise<LoadedData> {
  const [categories, tournaments, rankings] = await Promise.all([
    source.categories(),
    source.tournaments(),
    source.rankings(),
  ]);
  return { categories, tournaments, rankings };
}

// Loads a DataSource into the database using upserts on natural keys, so it is
// safe to run repeatedly (idempotent). Both the seed and the scraper reuse this.
// Prefer `promoteIfValid` (ingest.ts) when the data is untrusted — it validates
// before calling this.
export async function loadIntoDatabase(
  prisma: PrismaClient,
  source: DataSource,
): Promise<LoadResult> {
  return loadData(prisma, await fetchDataSource(source), source.name);
}

// Writes already-fetched data to the live tables. Split from the fetch so the
// validate→promote gate can check the data first without fetching twice.
//
// `prune` (default true) deletes events removed from the source (BRA-113). It
// assumes `data` is the COMPLETE set for the editions it covers, so a partial
// load (e.g. a single-tour ingest) MUST pass `prune: false` — otherwise it would
// delete the editions' other events that just aren't in this partial source.
export async function loadData(
  prisma: PrismaClient,
  data: LoadedData,
  sourceName: string,
  { prune = true }: { prune?: boolean } = {},
): Promise<LoadResult> {
  const { categories, tournaments, rankings } = data;

  // 1. Categories (ground-truth points/prize per tier/season).
  for (const c of categories) {
    const data = {
      pointsByRound: c.pointsByRound,
      prizeMoneyByRound: c.prizeMoneyByRound,
      currency: c.currency ?? "USD",
      source: c.source ?? null,
    };
    await prisma.tournamentCategory.upsert({
      where: { tour_tier_season: { tour: c.tour, tier: c.tier, season: c.season } },
      create: { tour: c.tour, tier: c.tier, season: c.season, ...data },
      update: data,
    });
  }

  // Map category natural key -> id, so tournaments can link to their category.
  const categoryRows = await prisma.tournamentCategory.findMany({
    select: { id: true, tour: true, tier: true, season: true },
  });
  const categoryIdByKey = new Map(
    categoryRows.map((r) => [categoryKey(r.tour, r.tier, r.season), r.id]),
  );

  // 2. Tournaments (+ their cutoff, if provided).
  let cutoffs = 0;
  const missingCategories = new Set<string>();
  for (const t of tournaments) {
    const key = categoryKey(t.tour, t.tier, t.edition);
    const categoryId = categoryIdByKey.get(key) ?? null;
    if (categoryId === null) {
      // No matching category → this event will have no points/prize. Surface it
      // so seed/scraper authors notice instead of silently shipping blank data.
      missingCategories.add(key);
    }

    const data = {
      tour: t.tour,
      circuit: circuitForTournament(t.tour, t.tier),
      tier: t.tier,
      city: t.city,
      country: t.country,
      countryCode: t.countryCode ?? null,
      lat: t.lat ?? null,
      long: t.long ?? null,
      surface: t.surface,
      startDate: t.startDate,
      endDate: t.endDate,
      drawSize: t.drawSize,
      entryDeadline: t.entryDeadline ?? null,
      categoryId,
    };

    const tournament = await prisma.tournament.upsert({
      where: { name_edition: { name: t.name, edition: t.edition } },
      create: { name: t.name, edition: t.edition, ...data },
      update: data,
    });

    if (t.cutoff) {
      const cutoff = {
        liveCutoffRank: t.cutoff.liveCutoffRank ?? null,
        liveCutoffPoints: t.cutoff.liveCutoffPoints ?? null,
        historicalCutoffRank: t.cutoff.historicalCutoffRank ?? null,
        historicalCutoffPoints: t.cutoff.historicalCutoffPoints ?? null,
        source: t.cutoff.source ?? null,
        asOfDate: t.cutoff.asOfDate ?? null,
      };
      await prisma.cutoff.upsert({
        where: { tournamentId: tournament.id },
        create: { tournamentId: tournament.id, ...cutoff },
        update: cutoff,
      });
      cutoffs++;
    }
  }

  if (missingCategories.size > 0) {
    console.warn(
      `[loadIntoDatabase] ${sourceName}: no TournamentCategory matched for ` +
        `${missingCategories.size} tier/season key(s); those events have no ` +
        `points/prize: ${[...missingCategories].join(", ")}`,
    );
  }

  // 2b. Prune tournaments removed from the source (BRA-113). For each edition the
  // source covers, delete DB events of that edition no longer in the source — but
  // only if no user schedule references them (ScheduleItem has no cascade, and we
  // never want to silently drop an event out of someone's saved plan). Cutoff /
  // accommodation / dining rows cascade with the tournament.
  const editions = [...new Set(tournaments.map((t) => t.edition))];
  if (prune && editions.length > 0) {
    const sourceKeys = new Set(tournaments.map((t) => `${t.name}::${t.edition}`));
    const existing = await prisma.tournament.findMany({
      where: { edition: { in: editions } },
      select: { id: true, name: true, edition: true, _count: { select: { scheduleItems: true } } },
    });
    const stale = existing.filter(
      (t) => !sourceKeys.has(`${t.name}::${t.edition}`) && t._count.scheduleItems === 0,
    );
    if (stale.length > 0) {
      await prisma.tournament.deleteMany({ where: { id: { in: stale.map((t) => t.id) } } });
      console.warn(
        `[loadIntoDatabase] ${sourceName}: pruned ${stale.length} stale tournament(s): ` +
          stale.map((t) => t.name).join(", "),
      );
    }
  }

  // 3. Rankings.
  for (const r of rankings) {
    const data = { playerName: r.playerName, points: r.points };
    await prisma.rankingEntry.upsert({
      where: {
        tour_rank_asOfDate: { tour: r.tour, rank: r.rank, asOfDate: r.asOfDate },
      },
      create: { tour: r.tour, rank: r.rank, asOfDate: r.asOfDate, ...data },
      update: data,
    });
  }

  return {
    categories: categories.length,
    tournaments: tournaments.length,
    cutoffs,
    rankings: rankings.length,
  };
}
