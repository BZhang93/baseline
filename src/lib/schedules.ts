import { prisma } from "@/lib/prisma";
import type { Tour, Surface, Player } from "@/generated/prisma/client";
import {
  loadRankingLookup,
  buildCutoffAndGap,
  type CutoffAndGap,
} from "@/lib/tournaments";
import { roundValue } from "@/lib/round-values";

// The winner ("W") value of a points/prize-by-round blob, treated as 0 when
// absent so it can be summed across a schedule's events.
const winnerPoints = (json: unknown): number => roundValue(json, "W") ?? 0;

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

// Parses a comma-separated `events` query param into a de-duplicated list of
// ids, keeping only those present in `validIds` (ignores unknown/invalid ids).
export function parseEventIdsParam(
  param: string | undefined,
  validIds: Iterable<string>,
): string[] {
  if (!param) return [];
  const valid = new Set(validIds);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of param.split(",")) {
    const id = raw.trim();
    if (id && valid.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

// The event fields needed to build legs + score totals.
export interface LegEvent {
  city: string;
  country: string;
  lat: number | null;
  long: number | null;
  startDate: Date;
  category: { pointsByRound: unknown; prizeMoneyByRound: unknown } | null;
}

export interface LegInput {
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
}

export interface LegsAndScores {
  legs: LegInput[];
  scorePoints: number;
  scorePrizeMoney: number;
  scoreTravelTimeMin: number;
  scoreTravelCost: number;
}

// Builds estimated travel legs between consecutive events and the cached score
// totals. `events` must already be ordered chronologically. Shared by create
// and edit so both stay consistent.
export function buildLegsAndScores(events: LegEvent[]): LegsAndScores {
  const legs: LegInput[] = [];
  let travelTimeMin = 0;
  let travelCost = 0;

  for (let i = 1; i < events.length; i++) {
    const from = events[i - 1];
    const to = events[i];
    let durationMinutes: number | null = null;
    let costEstimate: number | null = null;
    if (from.lat != null && from.long != null && to.lat != null && to.long != null) {
      const est = estimateTravel(
        haversineKm({ lat: from.lat, long: from.long }, { lat: to.lat, long: to.long }),
      );
      durationMinutes = est.durationMinutes;
      costEstimate = est.costEstimate;
      travelTimeMin += durationMinutes;
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

  return {
    legs,
    scorePoints: events.reduce((s, t) => s + winnerPoints(t.category?.pointsByRound), 0),
    scorePrizeMoney: events.reduce((s, t) => s + winnerPoints(t.category?.prizeMoneyByRound), 0),
    scoreTravelTimeMin: travelTimeMin,
    scoreTravelCost: travelCost,
  };
}

function byStartDate<T extends { startDate: Date }>(a: T, b: T): number {
  return a.startDate.getTime() - b.startDate.getTime();
}

// Creates a schedule with its events (ordered by start date) and estimated
// travel legs. Returns the new schedule id.
export async function createSchedule(
  playerId: string,
  input: CreateScheduleInput,
): Promise<string> {
  const selected = await prisma.tournament.findMany({
    where: { id: { in: input.tournamentIds } },
    include: { category: true },
  });
  const events = [...selected].sort(byStartDate);
  const built = buildLegsAndScores(events);

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
      scorePoints: built.scorePoints,
      scorePrizeMoney: built.scorePrizeMoney,
      scoreTravelTimeMin: built.scoreTravelTimeMin,
      scoreTravelCost: built.scoreTravelCost,
      items: { create: events.map((t, i) => ({ tournamentId: t.id, order: i })) },
      travelLegs: { create: built.legs },
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

// ---------------------------------------------------------------------------
// Detail + editing
// ---------------------------------------------------------------------------

export interface ScheduleEventView {
  tournamentId: string;
  name: string;
  tour: Tour;
  tier: string;
  surface: Surface;
  city: string;
  country: string;
  startDate: Date;
  endDate: Date;
  winnerPoints: number | null;
  winnerPrize: number | null;
  currency: string | null;
  cutoff: CutoffAndGap;
}

export interface TravelLegView {
  fromLabel: string;
  toLabel: string;
  durationMinutes: number | null;
  costEstimate: number | null;
}

export interface ScheduleDetail {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  budgetCap: number | null;
  maxEvents: number | null;
  minRestDays: number | null;
  events: ScheduleEventView[];
  legs: TravelLegView[];
  totals: {
    points: number | null;
    prize: number | null;
    travelTimeMin: number | null;
    travelCost: number | null;
  };
}

export async function getScheduleDetail(
  playerId: string,
  id: string,
  player: Pick<Player, "ranking" | "rankingTour"> | null,
): Promise<ScheduleDetail | null> {
  const schedule = await prisma.schedule.findFirst({
    where: { id, playerId },
    include: {
      items: { include: { tournament: { include: { category: true, cutoff: true } } } },
      travelLegs: { orderBy: { order: "asc" } },
    },
  });
  if (!schedule) return null;

  const pointsAt = await loadRankingLookup();
  const events: ScheduleEventView[] = schedule.items
    .map((i) => i.tournament)
    .sort(byStartDate)
    .map((t) => ({
      tournamentId: t.id,
      name: t.name,
      tour: t.tour,
      tier: t.tier,
      surface: t.surface,
      city: t.city,
      country: t.country,
      startDate: t.startDate,
      endDate: t.endDate,
      winnerPoints: roundValue(t.category?.pointsByRound, "W"),
      winnerPrize: roundValue(t.category?.prizeMoneyByRound, "W"),
      currency: t.category?.currency ?? null,
      cutoff: buildCutoffAndGap(t.tour, t.cutoff, pointsAt, player),
    }));

  return {
    id: schedule.id,
    name: schedule.name,
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    budgetCap: schedule.budgetCap,
    maxEvents: schedule.maxEvents,
    minRestDays: schedule.minRestDays,
    events,
    legs: schedule.travelLegs.map((l) => ({
      fromLabel: l.fromLabel,
      toLabel: l.toLabel,
      durationMinutes: l.durationMinutes,
      costEstimate: l.costEstimate,
    })),
    totals: {
      points: schedule.scorePoints,
      prize: schedule.scorePrizeMoney,
      travelTimeMin: schedule.scoreTravelTimeMin,
      travelCost: schedule.scoreTravelCost,
    },
  };
}

// Rebuilds the travel legs + cached scores from the schedule's current events.
export async function recomputeScheduleTotals(scheduleId: string): Promise<void> {
  const items = await prisma.scheduleItem.findMany({
    where: { scheduleId },
    include: { tournament: { include: { category: true } } },
  });
  const events = items.map((i) => i.tournament).sort(byStartDate);
  const built = buildLegsAndScores(events);

  await prisma.$transaction([
    prisma.travelLeg.deleteMany({ where: { scheduleId } }),
    prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        scorePoints: built.scorePoints,
        scorePrizeMoney: built.scorePrizeMoney,
        scoreTravelTimeMin: built.scoreTravelTimeMin,
        scoreTravelCost: built.scoreTravelCost,
        travelLegs: { create: built.legs },
      },
    }),
  ]);
}

// Edit operations — all scoped to the owning player (return false if not owned).

export async function renameSchedule(
  playerId: string,
  id: string,
  name: string,
): Promise<boolean> {
  const res = await prisma.schedule.updateMany({
    where: { id, playerId },
    data: { name },
  });
  return res.count > 0;
}

export async function removeEventFromSchedule(
  playerId: string,
  id: string,
  tournamentId: string,
): Promise<boolean> {
  const owned = await prisma.schedule.findFirst({
    where: { id, playerId },
    select: { id: true },
  });
  if (!owned) return false;
  await prisma.scheduleItem.deleteMany({ where: { scheduleId: id, tournamentId } });
  await recomputeScheduleTotals(id);
  return true;
}

export async function deleteSchedule(playerId: string, id: string): Promise<boolean> {
  const res = await prisma.schedule.deleteMany({ where: { id, playerId } });
  return res.count > 0;
}
