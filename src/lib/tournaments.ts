import { prisma } from "@/lib/prisma";
import { Tour, Surface, Prisma, type Player } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested; no DB)
// ---------------------------------------------------------------------------

export type AcceptanceStatus = "in" | "borderline" | "out" | "unknown";

export interface GapView {
  status: AcceptanceStatus;
  /// Ranking spots below the cutoff (0 if in). Null when unknown.
  spots: number | null;
  /// Points needed to reach the cutoff (0 if in). Null when not derivable.
  points: number | null;
}

// Deterministic acceptance readout (PRD §6.3.1): compare a player's rank/points
// to an event's cutoff. Lower rank number = better. "unknown" when we can't
// place the player (no ranking, or ranking on a different tour).
export function computeGap(
  playerRank: number | null,
  cutoffRank: number | null,
  playerPoints: number | null,
  cutoffPoints: number | null,
): GapView {
  if (playerRank == null || cutoffRank == null) {
    return { status: "unknown", spots: null, points: null };
  }
  if (playerRank <= cutoffRank) {
    return { status: "in", spots: 0, points: 0 };
  }
  const spots = playerRank - cutoffRank;
  const points =
    cutoffPoints != null && playerPoints != null
      ? Math.max(0, cutoffPoints - playerPoints)
      : null;
  return { status: spots <= 10 ? "borderline" : "out", spots, points };
}

// The rankings list only covers ATP and WTA; Challenger/ITF acceptance rides on
// those lists but the seed doesn't split by gender, so we derive cutoff points
// and the player gap only for ATP/WTA events (graceful degrade otherwise).
export function rankingTourFor(tour: Tour): Tour | null {
  return tour === Tour.ATP || tour === Tour.WTA ? tour : null;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface BrowseFilters {
  q?: string;
  tour?: Tour;
  surface?: Surface;
  from?: string; // ISO date
  to?: string; // ISO date
  country?: string;
}

export interface TournamentView {
  id: string;
  name: string;
  tour: Tour;
  tier: string;
  city: string;
  country: string;
  surface: Surface;
  startDate: Date;
  endDate: Date;
  drawSize: number;
  winnerPoints: number | null;
  winnerPrize: number | null;
  currency: string | null;
  liveCutoff: { rank: number | null; points: number | null };
  historicalCutoff: { rank: number | null; points: number | null };
  gap: GapView;
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

function roundNumber(json: unknown, key: string): number | null {
  if (json && typeof json === "object" && key in (json as Record<string, unknown>)) {
    const v = (json as Record<string, unknown>)[key];
    return typeof v === "number" ? v : null;
  }
  return null;
}

// Distinct filter options actually present in the dataset, so dropdowns never
// offer a value (e.g. a surface) that would return zero results.
export async function getFilterOptions(): Promise<{
  countries: string[];
  surfaces: Surface[];
}> {
  const [countryRows, surfaceRows] = await Promise.all([
    prisma.tournament.findMany({
      select: { country: true },
      distinct: ["country"],
      orderBy: { country: "asc" },
    }),
    prisma.tournament.findMany({
      select: { surface: true },
      distinct: ["surface"],
      orderBy: { surface: "asc" },
    }),
  ]);
  return {
    countries: countryRows.map((r) => r.country),
    surfaces: surfaceRows.map((r) => r.surface),
  };
}

export async function getBrowseData(
  filters: BrowseFilters,
  player: Pick<Player, "ranking" | "rankingTour"> | null,
): Promise<TournamentView[]> {
  const where: Prisma.TournamentWhereInput = {};
  if (filters.tour) where.tour = filters.tour;
  if (filters.surface) where.surface = filters.surface;
  if (filters.country) where.country = filters.country;
  if (filters.from || filters.to) {
    where.startDate = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }
  if (filters.q) {
    const contains = { contains: filters.q, mode: Prisma.QueryMode.insensitive };
    where.OR = [{ name: contains }, { city: contains }, { country: contains }];
  }

  const [tournaments, rankingRows] = await Promise.all([
    prisma.tournament.findMany({
      where,
      include: { category: true, cutoff: true },
      orderBy: [{ startDate: "asc" }, { name: "asc" }],
    }),
    prisma.rankingEntry.findMany({ select: { tour: true, rank: true, points: true } }),
  ]);

  // rank -> points, per tour.
  const pointsByTourRank = new Map<string, number>();
  for (const r of rankingRows) {
    pointsByTourRank.set(`${r.tour}:${r.rank}`, r.points);
  }
  const pointsAt = (tour: Tour, rank: number | null | undefined): number | null =>
    rank == null ? null : pointsByTourRank.get(`${tour}:${rank}`) ?? null;

  return tournaments.map((t) => {
    const rankTour = rankingTourFor(t.tour);
    const liveRank = t.cutoff?.liveCutoffRank ?? null;
    const histRank = t.cutoff?.historicalCutoffRank ?? null;
    const liveCutoffPoints = rankTour ? pointsAt(rankTour, liveRank) : null;

    const playerRank =
      player?.ranking != null && player.rankingTour === t.tour ? player.ranking : null;
    const playerPoints =
      playerRank != null && rankTour ? pointsAt(rankTour, playerRank) : null;

    return {
      id: t.id,
      name: t.name,
      tour: t.tour,
      tier: t.tier,
      city: t.city,
      country: t.country,
      surface: t.surface,
      startDate: t.startDate,
      endDate: t.endDate,
      drawSize: t.drawSize,
      winnerPoints: roundNumber(t.category?.pointsByRound, "W"),
      winnerPrize: roundNumber(t.category?.prizeMoneyByRound, "W"),
      currency: t.category?.currency ?? null,
      liveCutoff: { rank: liveRank, points: liveCutoffPoints },
      historicalCutoff: {
        rank: histRank,
        points: rankTour ? pointsAt(rankTour, histRank) : null,
      },
      gap: computeGap(playerRank, liveRank, playerPoints, liveCutoffPoints),
    };
  });
}
