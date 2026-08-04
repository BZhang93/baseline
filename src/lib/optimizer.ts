// Schedule optimizer (BRA-62) — the core differentiator (PRD §6.3 / §7).
//
// Pure, DB-free, and unit-tested: given candidate events, the player's weights,
// and constraints, it selects and orders the events that maximize the player's
// objective. Kept independent of Prisma so it can be exercised directly on seed
// data and swapped/extended without touching data access.
//
// Objective (PRD §7): maximize
//   w_points·points + w_money·money − w_time·travelTime − w_cost·travelCost
// where each dimension is normalized against the candidate pool so the weights
// behave as relative-importance knobs rather than being dominated by raw units
// (prize money would otherwise swamp everything).

import { roundValue } from "@/lib/round-values";
import { haversineKm, estimateTravel, type Coord } from "@/lib/travel";
import type { AcceptanceStatus } from "@/lib/tournaments";

// Result rounds, earliest exit → title. A player's "result" is the round they
// bow out in (W = won the title). pointsByRound/prizeMoneyByRound are keyed this
// way, so the keys present define the ladder (robust to byes / draw sizes).
export const ROUND_ORDER = ["R128", "R64", "R32", "R16", "QF", "SF", "F", "W"] as const;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// ---------------------------------------------------------------------------
// Expected value (round-reached proxy)
// ---------------------------------------------------------------------------

// Per-match win probability from the player's rank vs the field's strength.
// Lower rank number = stronger; the event's live cutoff rank stands in for a
// typical direct entrant. Parity → 0.5; clamped so nothing is ever a certainty.
// This is the single swappable knob: as real result data accrues, replace this
// with a data-driven model and the rest of the optimizer is unchanged.
export function matchWinProbability(
  playerRank: number | null,
  fieldRefRank: number | null,
): number {
  if (playerRank == null || fieldRefRank == null || fieldRefRank <= 0 || playerRank <= 0) {
    return 0.5;
  }
  const p = 1 / (1 + playerRank / fieldRefRank);
  return clamp(p, 0.1, 0.9);
}

// Expected value of a points/prize-by-round blob given a per-match win prob:
//   Σ P(result = round r) · value(r),
// where reaching round k (0-indexed among present rounds) needs k wins:
//   P(exit after k wins) = p^k·(1−p)  for k < last,  P(title) = p^(N−1).
// These probabilities sum to 1, so a stronger player shifts mass to later
// rounds (higher expected value) — exactly the behavior we want.
export function expectedRoundValue(byRound: unknown, winProb: number): number {
  const keys = ROUND_ORDER.filter((k) => roundValue(byRound, k) != null);
  const n = keys.length;
  if (n === 0) return 0;
  let ev = 0;
  for (let k = 0; k < n; k++) {
    const value = roundValue(byRound, keys[k])!;
    const prob = k < n - 1 ? Math.pow(winProb, k) * (1 - winProb) : Math.pow(winProb, n - 1);
    ev += prob * value;
  }
  return ev;
}

// Expected number of match wins, used only for the human-readable rationale
// (which round the player is expected to reach).
export function expectedResultLabel(byRound: unknown, winProb: number): string | null {
  const keys = ROUND_ORDER.filter((k) => roundValue(byRound, k) != null);
  const n = keys.length;
  if (n === 0) return null;
  let expectedWins = 0;
  for (let k = 0; k < n; k++) {
    const prob = k < n - 1 ? Math.pow(winProb, k) * (1 - winProb) : Math.pow(winProb, n - 1);
    expectedWins += k * prob;
  }
  return keys[Math.round(clamp(expectedWins, 0, n - 1))];
}

// ---------------------------------------------------------------------------
// Optimizer
// ---------------------------------------------------------------------------

export interface CandidateEvent {
  id: string;
  startDate: Date;
  endDate: Date;
  lat: number | null;
  long: number | null;
  pointsByRound: unknown;
  prizeMoneyByRound: unknown;
  // Live cutoff rank — field-strength proxy for the win-probability model.
  fieldRefRank: number | null;
  // The player's applicable rank for this event (null if it doesn't apply,
  // e.g. a different ranking tour), used for the win-probability model.
  playerRankForEvent: number | null;
  // Deterministic acceptance status (PRD §6.3.1) for the rationale + toggle.
  acceptance: AcceptanceStatus;
}

export interface OptimizerWeights {
  points: number;
  money: number;
  travelTime: number;
  travelCost: number;
}

export interface OptimizerConstraints {
  maxEvents?: number;
  minRestDays?: number; // required days between one event's end and the next's start
  budgetCap?: number; // max total estimated travel cost
  onlyQualified?: boolean; // hard-filter to events the player is "in"
  // Recovery/load (BRA-69): a soft "protect the body" penalty driven by rest
  // priority. Penalizes events packed tighter than `targetPerMonth` (cadence),
  // plus long-haul legs and big time-zone jumps between consecutive events.
  // `weight` (from rest priority) is how hard all of it is enforced.
  recovery?: { targetPerMonth: number; weight: number };
}

// Rest priority (0-100) → target events per ~30-day month, in 5 bands (higher
// rest = fewer events). 0-20 targets 5, effectively "as many as feasible" since
// the one-event-per-week structure caps real cadence near 4/month (BRA-69).
export function cadenceForRest(restPriority: number): number {
  if (restPriority >= 80) return 1;
  if (restPriority >= 60) return 2;
  if (restPriority >= 40) return 3;
  if (restPriority >= 20) return 4;
  return 5;
}

export interface ScheduledEvent {
  id: string;
  expectedPoints: number;
  expectedPrize: number;
  acceptance: AcceptanceStatus;
  resultLabel: string | null; // expected round reached
}

export interface OptimizedSchedule {
  events: ScheduledEvent[]; // chronological
  totals: {
    expectedPoints: number;
    expectedPrize: number;
    travelTimeMin: number;
    travelCost: number;
  };
  score: number; // normalized objective (higher is better)
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Beyond this, a leg reads as a long-haul flight (extra recovery cost, BRA-69).
const LONG_HAUL_KM = 4000;

function normalizedWeights(w: OptimizerWeights): OptimizerWeights {
  const sum = w.points + w.money + w.travelTime + w.travelCost;
  if (sum <= 0) return { points: 0.25, money: 0.25, travelTime: 0.25, travelCost: 0.25 };
  return {
    points: w.points / sum,
    money: w.money / sum,
    travelTime: w.travelTime / sum,
    travelCost: w.travelCost / sum,
  };
}

function legBetween(a: CandidateEvent, b: CandidateEvent): { minutes: number; cost: number } | null {
  if (a.lat == null || a.long == null || b.lat == null || b.long == null) return null;
  const est = estimateTravel(
    haversineKm({ lat: a.lat, long: a.long } as Coord, { lat: b.lat, long: b.long } as Coord),
  );
  return { minutes: est.durationMinutes, cost: est.costEstimate };
}

// How likely the player is to actually get into the draw, from the
// deterministic cutoff gap. Expected value is worthless if they can't enter, so
// this scales it: a #433 player's "reach" ATP events collapse toward zero and
// the optimizer stops recommending events they can't play. `unknown` (their own
// lower-tier events, where we can't place them) is left unpenalized.
const ACCEPTANCE_WEIGHT: Record<AcceptanceStatus, number> = {
  in: 1,
  borderline: 0.5,
  out: 0.05,
  unknown: 1,
};

// Expected points/prize for one event given the player: the round-reached value
// (if they play), scaled by how likely they are to be accepted, rounded.
export function eventExpectedValue(c: CandidateEvent): {
  expectedPoints: number;
  expectedPrize: number;
  resultLabel: string | null;
} {
  const winProb = matchWinProbability(c.playerRankForEvent, c.fieldRefRank);
  const accept = ACCEPTANCE_WEIGHT[c.acceptance];
  return {
    expectedPoints: Math.round(expectedRoundValue(c.pointsByRound, winProb) * accept),
    expectedPrize: Math.round(expectedRoundValue(c.prizeMoneyByRound, winProb) * accept),
    // The round the player would reach *if* they get in (not acceptance-scaled).
    resultLabel: expectedResultLabel(c.pointsByRound, winProb),
  };
}

// Raw totals for a fixed, chronological selection — used for live re-scoring in
// the UI (no optimization, just the expected-value sums + estimated legs).
export function scheduleTotals(ordered: CandidateEvent[]): OptimizedSchedule["totals"] {
  let travelTimeMin = 0;
  let travelCost = 0;
  for (let i = 1; i < ordered.length; i++) {
    const leg = legBetween(ordered[i - 1], ordered[i]);
    if (leg) {
      travelTimeMin += leg.minutes;
      travelCost += leg.cost;
    }
  }
  let expectedPoints = 0;
  let expectedPrize = 0;
  for (const c of ordered) {
    const v = eventExpectedValue(c);
    expectedPoints += v.expectedPoints;
    expectedPrize += v.expectedPrize;
  }
  return {
    expectedPoints: Math.round(expectedPoints),
    expectedPrize: Math.round(expectedPrize),
    travelTimeMin,
    travelCost,
  };
}

// Selects and orders the events maximizing the weighted objective, subject to
// the constraints. Exact search over date-sorted candidates (each event
// weekly/non-overlapping, so feasible chains are short); the PRD sanctions
// heuristic search at larger scale — swap the search, keep the scoring.
export function optimizeSchedule(
  candidates: CandidateEvent[],
  weights: OptimizerWeights,
  constraints: OptimizerConstraints = {},
): OptimizedSchedule {
  const w = normalizedWeights(weights);
  const { maxEvents, minRestDays = 0, budgetCap, onlyQualified = false, recovery } = constraints;

  const pool = (onlyQualified ? candidates.filter((c) => c.acceptance === "in") : candidates)
    .slice()
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // Per-event expected value (round-reached proxy).
  const ev = new Map<string, ReturnType<typeof eventExpectedValue>>();
  for (const c of pool) ev.set(c.id, eventExpectedValue(c));

  // Pool-level scales so the weights compare across dimensions. Max single-event
  // value and max single leg; guarded against divide-by-zero.
  const pScale = Math.max(1, ...pool.map((c) => ev.get(c.id)!.expectedPoints));
  const mScale = Math.max(1, ...pool.map((c) => ev.get(c.id)!.expectedPrize));
  let tScale = 1;
  let cScale = 1;
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const leg = legBetween(pool[i], pool[j]);
      if (leg) {
        tScale = Math.max(tScale, leg.minutes);
        cScale = Math.max(cScale, leg.cost);
      }
    }
  }

  // Feasibility of playing `next` after `prev` (overlap, rest, travel fits gap).
  function transition(
    prev: CandidateEvent,
    next: CandidateEvent,
  ): { minutes: number; cost: number } | null {
    if (next.startDate.getTime() <= prev.endDate.getTime()) return null; // overlap
    const gapMs = next.startDate.getTime() - prev.endDate.getTime();
    if (gapMs < minRestDays * DAY_MS) return null;
    const leg = legBetween(prev, next);
    if (leg && leg.minutes * 60 * 1000 > gapMs) return null; // travel can't fit the gap
    return leg ?? { minutes: 0, cost: 0 };
  }

  let best: { score: number; ids: string[] } = { score: -Infinity, ids: [] };

  function search(
    startIdx: number,
    prev: CandidateEvent | null,
    chosen: string[],
    accScore: number,
    accCost: number,
  ) {
    if (chosen.length > 0 && accScore > best.score) {
      best = { score: accScore, ids: chosen.slice() };
    }
    if (maxEvents != null && chosen.length >= maxEvents) return;

    for (let i = startIdx; i < pool.length; i++) {
      const e = pool[i];
      let leg = { minutes: 0, cost: 0 };
      if (prev) {
        const t = transition(prev, e);
        if (!t) continue;
        leg = t;
      }
      if (budgetCap != null && accCost + leg.cost > budgetCap) continue;

      const evE = ev.get(e.id)!;
      // Recovery/load penalty (BRA-69): cadence (events tighter than the target
      // rate) + travel load (long-haul distance and time-zone jump) on the leg
      // from the previous pick, all scaled by the rest-priority weight.
      let recoveryPenalty = 0;
      if (prev && recovery) {
        const gapDays = (e.startDate.getTime() - prev.startDate.getTime()) / DAY_MS;
        const targetGapDays = 30 / recovery.targetPerMonth;
        const cadence = Math.max(0, 1 - gapDays / targetGapDays);
        let load = 0;
        if (prev.lat != null && prev.long != null && e.lat != null && e.long != null) {
          const distKm = haversineKm(
            { lat: prev.lat, long: prev.long } as Coord,
            { lat: e.lat, long: e.long } as Coord,
          );
          const longHaul = Math.min(1, Math.max(0, (distKm - LONG_HAUL_KM) / LONG_HAUL_KM));
          const tzHours = Math.abs(prev.long - e.long) / 15; // ~15° of longitude per hour
          load = longHaul + Math.min(1, tzHours / 10);
        }
        recoveryPenalty = recovery.weight * (cadence + load);
      }
      const add =
        w.points * (evE.expectedPoints / pScale) +
        w.money * (evE.expectedPrize / mScale) -
        w.travelTime * (leg.minutes / tScale) -
        w.travelCost * (leg.cost / cScale) -
        recoveryPenalty;

      search(i + 1, e, [...chosen, e.id], accScore + add, accCost + leg.cost);
    }
  }
  search(0, null, [], 0, 0);

  // Materialize the chosen schedule with raw totals + rationale.
  const byId = new Map(pool.map((c) => [c.id, c]));
  const chosen = best.ids.map((id) => byId.get(id)!);
  const events: ScheduledEvent[] = chosen.map((c) => {
    const evE = ev.get(c.id)!;
    return {
      id: c.id,
      expectedPoints: Math.round(evE.expectedPoints),
      expectedPrize: Math.round(evE.expectedPrize),
      acceptance: c.acceptance,
      resultLabel: evE.resultLabel,
    };
  });

  return {
    events,
    totals: scheduleTotals(chosen),
    score: best.score === -Infinity ? 0 : best.score,
  };
}
