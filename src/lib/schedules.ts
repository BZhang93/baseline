import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
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
import { resolvePlayedPath, eventsDateRange } from "@/lib/schedule-path";
import { eventExpectedValue, type CandidateEvent } from "@/lib/optimizer";
import {
  routeLeg,
  legKey,
  parseLegModeOverrides,
  transportPriorityFromWeightPoints,
  modeFeasible,
  type LegRouting,
  type LegAlternative,
  type LegModeOverrides,
  type TransportPriority,
} from "@/lib/transport";
import type { TransportMode } from "@/generated/prisma/enums";
import { arrivalDate, isQualiArrival } from "@/lib/quali";

// A player's applicable rank/cutoff for one event, as the optimizer's
// round-reached model expects. Shared by the Browse candidate loader and the
// saved-schedule expected-value scoring.
type ScorableTournament = {
  id: string;
  tour: Tour;
  startDate: Date;
  endDate: Date;
  lat: number | null;
  long: number | null;
  category: { pointsByRound: unknown; prizeMoneyByRound: unknown } | null;
  cutoff: { liveCutoffRank: number | null } | null;
};

function toCandidate(
  t: ScorableTournament,
  player: Pick<Player, "ranking" | "rankingTour"> | null,
): CandidateEvent {
  const eventRankingTour = rankingTourFor(t.tour);
  const rank =
    eventRankingTour != null && eventRankingTour === player?.rankingTour ? player.ranking : null;
  const cutoffRank = t.cutoff?.liveCutoffRank ?? null;
  return {
    id: t.id,
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
}

// Expected points/prize over the played (non-overlapping) path — the realistic
// round-reached value for this player, not winner-take-all (player-feedback
// P0-3/P0-4).
export function expectedScheduleTotals(
  tournaments: ScorableTournament[],
  player: Pick<Player, "ranking" | "rankingTour"> | null,
): { expectedPoints: number; expectedPrize: number } {
  const { path } = resolvePlayedPath(tournaments);
  let points = 0;
  let prize = 0;
  for (const t of path) {
    const v = eventExpectedValue(toCandidate(t, player));
    points += v.expectedPoints;
    prize += v.expectedPrize;
  }
  return { expectedPoints: Math.round(points), expectedPrize: Math.round(prize) };
}
import { haversineKm, estimateTravel, type Coord } from "@/lib/travel";

// Re-exported for existing importers; the implementations live in travel.ts so
// they can also be used client-side and by the optimizer.
export { haversineKm, estimateTravel, type Coord };

// The winner ("W") value of a points/prize-by-round blob, treated as 0 when
// absent so it can be summed across a schedule's events.
const winnerPoints = (json: unknown): number => roundValue(json, "W") ?? 0;

// Trip costs are a non-negative whole number of currency units; guard against
// negatives/NaN from either the create input or a replayed server action.
function cleanTripCosts(n: number | null | undefined): number {
  return Number.isFinite(n) ? Math.max(0, Math.round(n as number)) : 0;
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
  tripCosts?: number;
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
  id: string;
  city: string;
  country: string;
  lat: number | null;
  long: number | null;
  startDate: Date;
  endDate: Date;
  category: { pointsByRound: unknown; prizeMoneyByRound: unknown } | null;
}

// Inputs that steer per-leg mode selection (player-feedback P1-7). Priority and
// prefs come from the schedule + profile; overrides are the player's per-leg picks.
export interface RouteOptions {
  prefs: TransportMode[];
  priority: TransportPriority;
  overrides: LegModeOverrides;
}

const DEFAULT_ROUTE_OPTS: RouteOptions = { prefs: [], priority: "balanced", overrides: {} };

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
  // Per-leg routing (recommended mode + alternatives), aligned with `legs`;
  // null when the leg lacks coordinates to estimate from.
  routings: (LegRouting | null)[];
  // The subset of the requested overrides that actually matched a leg and was
  // still feasible — the pruned set to persist (stale/infeasible picks drop out).
  activeOverrides: LegModeOverrides;
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
// dropped, never summed). Accepts events in any order. Each leg's mode is chosen
// by the multi-modal router (player-feedback P1-7): the player's Priority + ranked
// transport prefs pick a recommended mode, honoring any per-leg override, and the
// leg's time/cost reflect that mode. Shared by create + edit.
export function buildLegsAndScores(events: LegEvent[], opts: RouteOptions = DEFAULT_ROUTE_OPTS): LegsAndScores {
  const { path, conflicts } = resolvePlayedPath(events);
  const legs: LegInput[] = [];
  const routings: (LegRouting | null)[] = [];
  const activeOverrides: LegModeOverrides = {};
  let travelTimeMin = 0;
  let travelCost = 0;

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    let durationMinutes: number | null = null;
    let costEstimate: number | null = null;
    let routing: LegRouting | null = null;
    if (from.lat != null && from.long != null && to.lat != null && to.long != null) {
      const distanceKm = haversineKm(
        { lat: from.lat, long: from.long },
        { lat: to.lat, long: to.long },
      );
      const key = legKey(from.id, to.id);
      const override = opts.overrides[key] ?? null;
      routing = routeLeg(distanceKm, opts.prefs, opts.priority, override);
      // The override "took" only if it was feasible for this leg; otherwise the
      // router fell back and we drop the stale pick from the persisted set.
      if (override && routing.recommended.mode === override) activeOverrides[key] = override;
      durationMinutes = routing.recommended.durationMinutes;
      costEstimate = routing.recommended.costEstimate;
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
    routings.push(routing);
  }

  return {
    legs,
    routings,
    activeOverrides,
    scorePoints: path.reduce((s, t) => s + winnerPoints(t.category?.pointsByRound), 0),
    scorePrizeMoney: path.reduce((s, t) => s + winnerPoints(t.category?.prizeMoneyByRound), 0),
    scoreTravelTimeMin: travelTimeMin,
    scoreTravelCost: travelCost,
    conflictCount: conflicts.length,
  };
}

// The route options for a stored schedule, combining the player's transport
// prefs, the priority derived from the schedule's weighting, and any saved
// per-leg overrides.
function routeOptionsFor(
  schedule: { weightPoints: number; legModeOverrides: unknown },
  prefs: TransportMode[],
): RouteOptions {
  return {
    prefs,
    priority: transportPriorityFromWeightPoints(schedule.weightPoints),
    overrides: parseLegModeOverrides(schedule.legModeOverrides),
  };
}

// Prisma-writable value for the `legModeOverrides` Json column: the map when
// non-empty, else DB NULL (keeps rows clean once a player reverts every leg).
function overridesForStorage(
  overrides: LegModeOverrides,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return Object.keys(overrides).length > 0
    ? (overrides as Prisma.InputJsonValue)
    : Prisma.DbNull;
}

// The player's ranked transport preferences, for routing this schedule's legs.
async function transportPrefsFor(playerId: string): Promise<TransportMode[]> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { transportModes: true },
  });
  return player?.transportModes ?? [];
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
  const prefs = await transportPrefsFor(playerId);
  const built = buildLegsAndScores(events, {
    prefs,
    priority: transportPriorityFromWeightPoints(input.weightPoints),
    overrides: {},
  });

  const created = await prisma.schedule.create({
    data: {
      playerId,
      name: input.name,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      budgetCap: input.budgetCap ?? null,
      maxEvents: input.maxEvents ?? null,
      minRestDays: input.minRestDays ?? null,
      tripCosts: cleanTripCosts(input.tripCosts),
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

export interface ScheduleEditData {
  name: string;
  from: string;
  to: string;
  budgetCap: string;
  maxEvents: string;
  minRestDays: string;
  tripCosts: string;
  priority: number;
  eventIds: string[];
}

const toDateStr = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : "");

// Pre-fill values for editing a schedule in the create form. Priority is
// reverse-derived from the stored weights (weightPoints = 0.5 + 1.5·p).
export async function getScheduleForEdit(
  playerId: string,
  id: string,
): Promise<ScheduleEditData | null> {
  const s = await prisma.schedule.findFirst({
    where: { id, playerId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!s) return null;
  const priority = Math.max(0, Math.min(100, Math.round(((s.weightPoints - 0.5) / 1.5) * 100)));
  return {
    name: s.name,
    from: toDateStr(s.startDate),
    to: toDateStr(s.endDate),
    budgetCap: s.budgetCap?.toString() ?? "",
    maxEvents: s.maxEvents?.toString() ?? "",
    minRestDays: s.minRestDays?.toString() ?? "",
    tripCosts: s.tripCosts ? s.tripCosts.toString() : "",
    priority,
    eventIds: s.items.map((i) => i.tournamentId),
  };
}

// Replaces a schedule's events + settings (add/remove events, change
// window/constraints/priority/trip costs), recomputing legs + scores.
export async function updateSchedule(
  playerId: string,
  id: string,
  input: CreateScheduleInput,
): Promise<boolean> {
  const owned = await prisma.schedule.findFirst({
    where: { id, playerId },
    select: { id: true, legModeOverrides: true, player: { select: { transportModes: true } } },
  });
  if (!owned) return false;

  const selected = await prisma.tournament.findMany({
    where: { id: { in: input.tournamentIds } },
    include: { category: true },
  });
  const events = [...selected].sort(byStartDate);
  // Keep the player's per-leg mode picks across the edit; buildLegsAndScores
  // prunes any that no longer match a leg (removed events / new distances).
  const built = buildLegsAndScores(events, {
    prefs: owned.player.transportModes,
    priority: transportPriorityFromWeightPoints(input.weightPoints),
    overrides: parseLegModeOverrides(owned.legModeOverrides),
  });

  await prisma.schedule.update({
    where: { id },
    data: {
      name: input.name,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      budgetCap: input.budgetCap ?? null,
      maxEvents: input.maxEvents ?? null,
      minRestDays: input.minRestDays ?? null,
      tripCosts: cleanTripCosts(input.tripCosts),
      weightPoints: input.weightPoints,
      weightMoney: input.weightMoney,
      weightTravelTime: input.weightTravelTime,
      weightTravelCost: input.weightTravelCost,
      scorePoints: built.scorePoints,
      scorePrizeMoney: built.scorePrizeMoney,
      scoreTravelTimeMin: built.scoreTravelTimeMin,
      scoreTravelCost: built.scoreTravelCost,
      legModeOverrides: overridesForStorage(built.activeOverrides),
      items: { deleteMany: {}, create: events.map((t, i) => ({ tournamentId: t.id, order: i })) },
      travelLegs: { deleteMany: {}, create: built.legs },
    },
  });
  return true;
}

export interface ScheduleSummary {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  eventCount: number;
  expectedPoints: number;
  expectedPrize: number;
  travelTimeMin: number | null;
  travelCost: number | null;
  netEarnings: number; // expectedPrize − travelCost − tripCosts
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
  return rows.map((t) => ({
    // Optimizer fields (rank/cutoff/acceptance) via the shared mapping…
    ...toCandidate(t, player),
    // …plus the display fields the picker needs.
    name: t.name,
    tour: t.tour,
    tier: t.tier,
    surface: t.surface,
    city: t.city,
    country: t.country,
  }));
}

export async function getPlayerSchedules(
  playerId: string,
  player: Pick<Player, "ranking" | "rankingTour" | "transportModes"> | null,
): Promise<ScheduleSummary[]> {
  const rows = await prisma.schedule.findMany({
    where: { playerId },
    include: {
      items: { include: { tournament: { include: { category: true, cutoff: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  const prefs = player?.transportModes ?? [];
  // Recompute expected-value played-path totals so the list matches the detail
  // view (persisted score* columns are stale winner-take-all values), routing
  // legs with the same prefs/priority/overrides the detail view uses.
  return rows.map((s) => {
    const tournaments = s.items.map((i) => i.tournament);
    const built = buildLegsAndScores(tournaments, routeOptionsFor(s, prefs));
    const { expectedPoints, expectedPrize } = expectedScheduleTotals(tournaments, player);
    // Show the real event span, falling back to the stored planning window.
    const range = eventsDateRange(tournaments);
    return {
      id: s.id,
      name: s.name,
      startDate: s.startDate ?? range.start,
      endDate: s.endDate ?? range.end,
      eventCount: s.items.length,
      expectedPoints,
      expectedPrize,
      travelTimeMin: built.scoreTravelTimeMin,
      travelCost: built.scoreTravelCost,
      netEarnings: expectedPrize - built.scoreTravelCost - s.tripCosts,
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
  // When the player enters qualifying (Challenger/ITF, below the cut), the date
  // they actually arrive — the quali sign-in, earlier than main-draw start.
  arrivalDate: Date;
  // True when arrivalDate is a qualifying arrival (before main-draw start).
  qualiArrival: boolean;
}

export interface TravelLegView {
  fromLabel: string;
  toLabel: string;
  durationMinutes: number | null;
  costEstimate: number | null;
  // The event this leg departs after (so the UI aligns legs to played events).
  afterTournamentId: string;
  // The event this leg arrives at — with afterTournamentId, the key used to
  // override this leg's mode (player-feedback P1-7a).
  toTournamentId: string;
  // Recommended transport mode + collapsed alternatives (player-feedback P1-7).
  // null mode when the leg has no coordinates to estimate from.
  mode: TransportMode | null;
  alternatives: LegAlternative[];
  // Whether this leg's mode was set by an explicit player override.
  overridden: boolean;
  // The router recommends against the player's preferred mode by a material
  // margin — the UI expands the alternatives by default.
  contested: boolean;
}

export interface ScheduleDetail {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  budgetCap: number | null;
  maxEvents: number | null;
  minRestDays: number | null;
  tripCosts: number;
  events: ScheduleEventView[];
  legs: TravelLegView[];
  totals: {
    // Expected (round-reached) value over the played path, not winner-take-all.
    expectedPoints: number;
    expectedPrize: number;
    travelTimeMin: number | null;
    travelCost: number | null;
    // expectedPrize − travelCost − tripCosts.
    netEarnings: number;
  };
  // How many events collide with the played path (0 = clean schedule).
  conflictCount: number;
}

export async function getScheduleDetail(
  playerId: string,
  id: string,
  player: Pick<Player, "ranking" | "rankingTour" | "transportModes"> | null,
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

  const events: ScheduleEventView[] = [...tournaments].sort(byStartDate).map((t) => {
    const cutoff = buildCutoffAndGap(t.tour, t.cutoff, pointsAt, player);
    const qt = { tour: t.tour, startDate: t.startDate, qualiStartDate: t.qualiStartDate };
    // Quali entry is a direct rank-vs-cutoff check: Challenger/ITF acceptance is
    // always "unknown" (no points model), so we compare the player's ranking to
    // the event's live cutoff rank (same circuit scale).
    const rank = player?.ranking ?? null;
    const cutoffRank = t.cutoff?.liveCutoffRank ?? null;
    return {
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
      cutoff,
      conflict: conflictIds.has(t.id),
      // Quali entrants (Challenger/ITF, below the cut) arrive for the weekend
      // qualifying, earlier than main-draw Monday (player-feedback P1-6).
      arrivalDate: arrivalDate(qt, rank, cutoffRank),
      qualiArrival: isQualiArrival(qt, rank, cutoffRank),
    };
  });

  const built = buildLegsAndScores(tournaments, routeOptionsFor(schedule, player?.transportModes ?? []));
  // built.legs[i] departs after path[i] to path[i + 1] (both derive from the
  // same played path), so routings[i] and the tournament pair align by index.
  // activeOverrides is the pruned set that actually applied (stale/infeasible
  // picks drop out), so it's the truth for the "your pick" flag.
  const legs: TravelLegView[] = built.legs.map((l, i) => {
    const routing = built.routings[i];
    const toId = path[i + 1].id;
    return {
      fromLabel: l.fromLabel,
      toLabel: l.toLabel,
      durationMinutes: l.durationMinutes,
      costEstimate: l.costEstimate,
      afterTournamentId: path[i].id,
      toTournamentId: toId,
      mode: routing?.recommended.mode ?? null,
      alternatives: routing?.alternatives ?? [],
      overridden: legKey(path[i].id, toId) in built.activeOverrides,
      contested: routing?.contested ?? false,
    };
  });

  const { expectedPoints, expectedPrize } = expectedScheduleTotals(tournaments, player);
  const netEarnings = expectedPrize - built.scoreTravelCost - schedule.tripCosts;
  const range = eventsDateRange(tournaments);
  // The trip begins at the earliest arrival — a quali entrant's first event
  // pulls the window a couple days before main-draw Monday (player-feedback P1-6).
  const earliestArrival = events.reduce<Date | null>(
    (min, e) => (min == null || e.arrivalDate < min ? e.arrivalDate : min),
    null,
  );

  return {
    id: schedule.id,
    name: schedule.name,
    startDate: schedule.startDate ?? earliestArrival ?? range.start,
    endDate: schedule.endDate ?? range.end,
    budgetCap: schedule.budgetCap,
    maxEvents: schedule.maxEvents,
    minRestDays: schedule.minRestDays,
    tripCosts: schedule.tripCosts,
    events,
    legs,
    totals: {
      expectedPoints,
      expectedPrize,
      travelTimeMin: built.scoreTravelTimeMin,
      travelCost: built.scoreTravelCost,
      netEarnings,
    },
    conflictCount: built.conflictCount,
  };
}

// Rebuilds the travel legs + cached scores from the schedule's current events,
// routing legs with the player's prefs/priority/overrides and pruning overrides
// that no longer match a leg.
export async function recomputeScheduleTotals(scheduleId: string): Promise<void> {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: {
      weightPoints: true,
      legModeOverrides: true,
      player: { select: { transportModes: true } },
      items: { include: { tournament: { include: { category: true } } } },
    },
  });
  if (!schedule) return;
  const events = schedule.items.map((i) => i.tournament).sort(byStartDate);
  const built = buildLegsAndScores(events, routeOptionsFor(schedule, schedule.player.transportModes));

  await prisma.$transaction([
    prisma.travelLeg.deleteMany({ where: { scheduleId } }),
    prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        scorePoints: built.scorePoints,
        scorePrizeMoney: built.scorePrizeMoney,
        scoreTravelTimeMin: built.scoreTravelTimeMin,
        scoreTravelCost: built.scoreTravelCost,
        legModeOverrides: overridesForStorage(built.activeOverrides),
        travelLegs: { create: built.legs },
      },
    }),
  ]);
}

// Override (or clear) the transport mode for one leg, then recompute totals so
// the schedule's travel time/cost + net earnings reflect the pick (P1-7a). A
// null mode reverts the leg to the router's recommendation. Returns false if the
// schedule isn't owned, the leg pair isn't a real leg, or the mode is infeasible.
export async function setScheduleLegMode(
  playerId: string,
  scheduleId: string,
  fromTournamentId: string,
  toTournamentId: string,
  mode: TransportMode | null,
): Promise<boolean> {
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, playerId },
    select: {
      legModeOverrides: true,
      items: { include: { tournament: { select: { id: true, lat: true, long: true, startDate: true, endDate: true } } } },
    },
  });
  if (!schedule) return false;

  // The leg must be a real consecutive pair on the played path with coordinates.
  const { path } = resolvePlayedPath(schedule.items.map((i) => i.tournament));
  const idx = path.findIndex((t) => t.id === fromTournamentId);
  const from = path[idx];
  const to = path[idx + 1];
  if (!from || !to || to.id !== toTournamentId) return false;
  if (from.lat == null || from.long == null || to.lat == null || to.long == null) return false;

  if (mode != null) {
    const distanceKm = haversineKm(
      { lat: from.lat, long: from.long },
      { lat: to.lat, long: to.long },
    );
    if (!modeFeasible(distanceKm, mode)) return false;
  }

  const overrides = parseLegModeOverrides(schedule.legModeOverrides);
  const key = legKey(fromTournamentId, toTournamentId);
  if (mode == null) delete overrides[key];
  else overrides[key] = mode;

  // Persist the pick, then recompute so travel totals + net earnings update.
  await prisma.schedule.update({
    where: { id: scheduleId },
    data: { legModeOverrides: overridesForStorage(overrides) },
  });
  await recomputeScheduleTotals(scheduleId);
  return true;
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

// Player-entered trip costs (lodging/food/etc.) for net-of-cost earnings.
export async function updateScheduleTripCosts(
  playerId: string,
  id: string,
  tripCosts: number,
): Promise<boolean> {
  const res = await prisma.schedule.updateMany({
    where: { id, playerId },
    data: { tripCosts: cleanTripCosts(tripCosts) },
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
