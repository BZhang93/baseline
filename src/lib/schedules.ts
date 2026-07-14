import { prisma } from "@/lib/prisma";
import type { Tour, Surface } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested; no DB)
// ---------------------------------------------------------------------------

export interface Coord {
  lat: number;
  long: number;
}

// Great-circle distance in km.
export function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLong = toRad(b.long - a.long);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLong / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Rough v1 flight estimate from distance (real APIs land in Phase 1). ~800 km/h
// plus ~2h airport overhead; ~$0.15/km. Clearly an estimate, not a quote.
export function estimateTravel(distanceKm: number): {
  durationMinutes: number;
  costEstimate: number;
} {
  return {
    durationMinutes: Math.round((distanceKm / 800) * 60 + 120),
    costEstimate: Math.round(distanceKm * 0.15),
  };
}

function winnerValue(json: unknown): number {
  if (json && typeof json === "object" && "W" in (json as Record<string, unknown>)) {
    const v = (json as Record<string, unknown>).W;
    return typeof v === "number" ? v : 0;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

export interface CreateScheduleInput {
  name: string;
  startDate?: string;
  endDate?: string;
  budgetCap?: number;
  maxEvents?: number;
  minRestDays?: number;
  weightPoints: number;
  weightMoney: number;
  weightTravelTime: number;
  weightTravelCost: number;
  tournamentIds: string[];
}

// Creates a schedule with its events (ordered by start date) and estimated
// travel legs between consecutive events, caching the potential-score totals.
// Returns the new schedule id.
export async function createSchedule(
  playerId: string,
  input: CreateScheduleInput,
): Promise<string> {
  const selected = await prisma.tournament.findMany({
    where: { id: { in: input.tournamentIds } },
    include: { category: true },
  });

  // Preserve real events only, ordered chronologically.
  const events = selected.sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime(),
  );

  const legs: {
    order: number;
    fromLabel: string;
    toLabel: string;
    fromLat: number | null;
    fromLong: number | null;
    toLat: number | null;
    toLong: number | null;
    durationMinutes: number | null;
    costEstimate: number | null;
    date: Date;
  }[] = [];

  let travelTime = 0;
  let travelCost = 0;
  for (let i = 1; i < events.length; i++) {
    const from = events[i - 1];
    const to = events[i];
    let durationMinutes: number | null = null;
    let costEstimate: number | null = null;
    if (from.lat != null && from.long != null && to.lat != null && to.long != null) {
      const est = estimateTravel(
        haversineKm(
          { lat: from.lat, long: from.long },
          { lat: to.lat, long: to.long },
        ),
      );
      durationMinutes = est.durationMinutes;
      costEstimate = est.costEstimate;
      travelTime += durationMinutes;
      travelCost += costEstimate;
    }
    legs.push({
      order: i - 1,
      fromLabel: `${from.city}, ${from.country}`,
      toLabel: `${to.city}, ${to.country}`,
      fromLat: from.lat,
      fromLong: from.long,
      toLat: to.lat,
      toLong: to.long,
      durationMinutes,
      costEstimate,
      date: to.startDate,
    });
  }

  const potentialPoints = events.reduce(
    (sum, t) => sum + winnerValue(t.category?.pointsByRound),
    0,
  );
  const potentialPrize = events.reduce(
    (sum, t) => sum + winnerValue(t.category?.prizeMoneyByRound),
    0,
  );

  const created = await prisma.schedule.create({
    data: {
      playerId,
      name: input.name,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      budgetCap: input.budgetCap ?? null,
      maxEvents: input.maxEvents ?? null,
      minRestDays: input.minRestDays ?? null,
      weightPoints: input.weightPoints,
      weightMoney: input.weightMoney,
      weightTravelTime: input.weightTravelTime,
      weightTravelCost: input.weightTravelCost,
      scorePoints: potentialPoints,
      scorePrizeMoney: potentialPrize,
      scoreTravelTimeMin: travelTime,
      scoreTravelCost: travelCost,
      items: {
        create: events.map((t, i) => ({ tournamentId: t.id, order: i })),
      },
      travelLegs: { create: legs },
    },
  });

  return created.id;
}

export interface ScheduleSummary {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  eventCount: number;
  potentialPoints: number | null;
  potentialPrize: number | null;
  travelTimeMin: number | null;
  travelCost: number | null;
}

export interface PickerTournament {
  id: string;
  name: string;
  tour: Tour;
  tier: string;
  surface: Surface;
  city: string;
  country: string;
  startDate: Date;
  endDate: Date;
}

// Minimal tournament list for the create-schedule event picker.
export async function getTournamentsForPicker(): Promise<PickerTournament[]> {
  return prisma.tournament.findMany({
    select: {
      id: true,
      name: true,
      tour: true,
      tier: true,
      surface: true,
      city: true,
      country: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: "asc" },
  });
}

export async function getPlayerSchedules(
  playerId: string,
): Promise<ScheduleSummary[]> {
  const rows = await prisma.schedule.findMany({
    where: { playerId },
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    startDate: s.startDate,
    endDate: s.endDate,
    eventCount: s._count.items,
    potentialPoints: s.scorePoints,
    potentialPrize: s.scorePrizeMoney,
    travelTimeMin: s.scoreTravelTimeMin,
    travelCost: s.scoreTravelCost,
  }));
}
