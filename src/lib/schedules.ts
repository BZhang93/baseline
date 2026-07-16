import { prisma } from "@/lib/prisma";
import type { Tour, Surface, Player } from "@/generated/prisma/client";
import {
  loadRankingLookup,
  buildCutoffAndGap,
  rankingTourFor,
  computeGap,
  type CutoffAndGap,
  type AcceptanceStatus,
} from "@/lib/tournaments";
import { roundValue } from "@/lib/round-values";
import { resolvePlayedPath } from "@/lib/schedule-path";
import { haversineKm, estimateTravel, type Coord } from "@/lib/travel";

// Re-exported for existing importers; the implementations live in travel.ts so
// they can also be used client-side and by the optimizer.
export { haversineKm, estimateTravel, type Coord };

// The winner ("W") value of a points/prize-by-round blob, treated as 0 when
// absent so it can be summed across a schedule's events.
const winnerPoints = (json: unknown): number => roundValue(json, "W") ?? 0;

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
  endDate: Date;
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
  // Events dropped because they collide with an earlier event the same week —
  // a player can only play one at a time (player-feedback P0-1).
  conflictCount: number;
}

// Builds estimated travel legs + score totals over the *played path* — the
// chronological, non-overlapping subset of the events (same-week collisions are
// dropped, never summed). Accepts events in any order. Shared by create + edit.
export function buildLegsAndScores(events: LegEvent[]): LegsAndScores {
  const { path, conflicts } = resolvePlayedPath(events);
  const legs: LegInput[] = [];
  let travelTimeMin = 0;
  let travelCost = 0;

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
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
    scorePoints: path.reduce((s, t) => s + winnerPoints(t.category?.pointsByRound), 0),
    scorePrizeMoney: path.reduce((s, t) => s + winnerPoints(t.category?.prizeMoneyByRound), 0),
    scoreTravelTimeMin: travelTimeMin,
    scoreTravelCost: travelCost,
    conflictCount: conflicts.length,
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

// A picker tournament enriched with the fields the optimizer needs, so the
// create-schedule form can both display events and run optimizeSchedule /
// scheduleTotals client-side (its shape is a superset of CandidateEvent).
export interface PickerCandidate extends PickerTournament {
  lat: number | null;
  long: number | null;
  pointsByRound: unknown;
  prizeMoneyByRound: unknown;
  fieldRefRank: number | null; // live cutoff rank (field-strength proxy)
  playerRankForEvent: number | null; // player's applicable rank, else null
  acceptance: AcceptanceStatus;
}

// Candidate events for the create-schedule picker + optimizer. Scoped to the
// player's circuit (a men's player can't add women's events), with per-event
// acceptance and the inputs the optimizer's round-reached proxy needs.
export async function getScheduleCandidates(
  player: Pick<Player, "ranking" | "rankingTour" | "circuit">,
): Promise<PickerCandidate[]> {
  const rows = await prisma.tournament.findMany({
    where: player.circuit ? { circuit: player.circuit } : undefined,
    include: { category: true, cutoff: true },
    orderBy: { startDate: "asc" },
  });
  return rows.map((t) => {
    // The player's rank only applies to ATP/WTA events on their ranking tour.
    // rankingTourFor is null for Challenger/ITF, so require a non-null match to
    // avoid a null===null coincidence applying the rank to the wrong events.
    const eventRankingTour = rankingTourFor(t.tour);
    const rank =
      eventRankingTour != null && eventRankingTour === player.rankingTour
        ? player.ranking
        : null;
    const cutoffRank = t.cutoff?.liveCutoffRank ?? null;
    return {
      id: t.id,
      name: t.name,
      tour: t.tour,
      tier: t.tier,
      surface: t.surface,
      city: t.city,
      country: t.country,
      startDate: t.startDate,
      endDate: t.endDate,
      lat: t.lat,
      long: t.long,
      pointsByRound: t.category?.pointsByRound ?? {},
      prizeMoneyByRound: t.category?.prizeMoneyByRound ?? {},
      fieldRefRank: cutoffRank,
      playerRankForEvent: rank,
      acceptance: computeGap(rank, cutoffRank, null, null).status,
    };
  });
}

export async function getPlayerSchedules(
  playerId: string,
): Promise<ScheduleSummary[]> {
  const rows = await prisma.schedule.findMany({
    where: { playerId },
    include: { items: { include: { tournament: { include: { category: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  // Recompute played-path totals so the list agrees with the detail view; the
  // persisted score* columns can be stale for schedules saved before P0-1.
  return rows.map((s) => {
    const built = buildLegsAndScores(s.items.map((i) => i.tournament));
    return {
      id: s.id,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      eventCount: s.items.length,
      potentialPoints: built.scorePoints,
      potentialPrize: built.scorePrizeMoney,
      travelTimeMin: built.scoreTravelTimeMin,
      travelCost: built.scoreTravelCost,
    };
  });
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
  // True when this event collides with an earlier same-week event, so it's
  // excluded from totals and the travel path (player-feedback P0-1).
  conflict: boolean;
}

export interface TravelLegView {
  fromLabel: string;
  toLabel: string;
  durationMinutes: number | null;
  costEstimate: number | null;
  // The event this leg departs after (so the UI aligns legs to played events).
  afterTournamentId: string;
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
  // How many events collide with the played path (0 = clean schedule).
  conflictCount: number;
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
    },
  });
  if (!schedule) return null;

  const pointsAt = await loadRankingLookup();
  const tournaments = schedule.items.map((i) => i.tournament);

  // Resolve the played path so we can flag same-week conflicts and recompute
  // totals/legs over the real path — never trusting persisted totals, which may
  // predate this fix (player-feedback P0-1).
  const { path, conflicts } = resolvePlayedPath(tournaments);
  const conflictIds = new Set(conflicts.map((t) => t.id));

  const events: ScheduleEventView[] = [...tournaments].sort(byStartDate).map((t) => ({
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
    conflict: conflictIds.has(t.id),
  }));

  const built = buildLegsAndScores(tournaments);
  // built.legs[i] departs after path[i] (both derive from the same played path).
  const legs: TravelLegView[] = built.legs.map((l, i) => ({
    fromLabel: l.fromLabel,
    toLabel: l.toLabel,
    durationMinutes: l.durationMinutes,
    costEstimate: l.costEstimate,
    afterTournamentId: path[i].id,
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
    legs,
    totals: {
      points: built.scorePoints,
      prize: built.scorePrizeMoney,
      travelTimeMin: built.scoreTravelTimeMin,
      travelCost: built.scoreTravelCost,
    },
    conflictCount: built.conflictCount,
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
