import type { PrismaClient } from "@/generated/prisma/client";
import type { DataSource } from "./types";
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

// Loads a DataSource into the database using upserts on natural keys, so it is
// safe to run repeatedly (idempotent). Both the seed and the scraper reuse this.
export async function loadIntoDatabase(
  prisma: PrismaClient,
  source: DataSource,
): Promise<LoadResult> {
  const [categories, tournaments, rankings] = await Promise.all([
    source.categories(),
    source.tournaments(),
    source.rankings(),
  ]);

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
      `[loadIntoDatabase] ${source.name}: no TournamentCategory matched for ` +
        `${missingCategories.size} tier/season key(s); those events have no ` +
        `points/prize: ${[...missingCategories].join(", ")}`,
    );
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
