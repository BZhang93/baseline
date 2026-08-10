import { describe, it, expect } from "vitest";
import {
  matchWinProbability,
  expectedRoundValue,
  expectedResultLabel,
  eventExpectedValue,
  optimizeSchedule,
  cadenceForRest,
  type CandidateEvent,
  type OptimizerWeights,
} from "./optimizer";

describe("cadenceForRest", () => {
  it("maps rest priority to 5 descending cadence bands", () => {
    expect(cadenceForRest(100)).toBe(1);
    expect(cadenceForRest(80)).toBe(1);
    expect(cadenceForRest(79)).toBe(2);
    expect(cadenceForRest(60)).toBe(2);
    expect(cadenceForRest(40)).toBe(3);
    expect(cadenceForRest(20)).toBe(4);
    expect(cadenceForRest(0)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Win probability
// ---------------------------------------------------------------------------

describe("matchWinProbability", () => {
  it("is 0.5 at rank parity and with missing data", () => {
    expect(matchWinProbability(100, 100)).toBeCloseTo(0.5);
    expect(matchWinProbability(null, 100)).toBe(0.5);
    expect(matchWinProbability(100, null)).toBe(0.5);
    expect(matchWinProbability(100, 0)).toBe(0.5);
  });
  it("rises when the player is stronger (lower rank number)", () => {
    expect(matchWinProbability(50, 100)).toBeGreaterThan(0.5);
    expect(matchWinProbability(50, 100)).toBeCloseTo(1 / 1.5, 5);
  });
  it("falls when the player is weaker", () => {
    expect(matchWinProbability(200, 100)).toBeLessThan(0.5);
  });
  it("clamps to [0.1, 0.9]", () => {
    expect(matchWinProbability(1, 100000)).toBeLessThanOrEqual(0.9);
    expect(matchWinProbability(1, 100000)).toBeCloseTo(0.9);
    expect(matchWinProbability(100000, 1)).toBeCloseTo(0.1);
  });
});

// ---------------------------------------------------------------------------
// Round-reached expected value
// ---------------------------------------------------------------------------

const POINTS = { W: 250, F: 165, SF: 100, QF: 50, R16: 25, R32: 13 };

describe("expectedRoundValue", () => {
  it("is 0 for an empty/absent table", () => {
    expect(expectedRoundValue({}, 0.5)).toBe(0);
    expect(expectedRoundValue(null, 0.5)).toBe(0);
  });
  it("collapses to the winner value when every match is won", () => {
    expect(expectedRoundValue(POINTS, 1)).toBeCloseTo(POINTS.W);
  });
  it("collapses to the first-round value when every match is lost", () => {
    expect(expectedRoundValue(POINTS, 0)).toBeCloseTo(POINTS.R32);
  });
  it("increases monotonically with win probability", () => {
    const lo = expectedRoundValue(POINTS, 0.1);
    const mid = expectedRoundValue(POINTS, 0.5);
    const hi = expectedRoundValue(POINTS, 0.9);
    expect(lo).toBeLessThan(mid);
    expect(mid).toBeLessThan(hi);
    // Always between the floor (first round) and ceiling (winner).
    expect(mid).toBeGreaterThan(POINTS.R32);
    expect(mid).toBeLessThan(POINTS.W);
  });
});

describe("expectedResultLabel", () => {
  it("points to an early round for a weak player and a deep one for a strong player", () => {
    expect(expectedResultLabel(POINTS, 0.05)).toBe("R32");
    // Even at 0.95/match, winning six straight is unlikely, so the *expected*
    // finish is a deep round rather than necessarily the title.
    expect(["SF", "F", "W"]).toContain(expectedResultLabel(POINTS, 0.95));
  });
});

// ---------------------------------------------------------------------------
// Optimizer
// ---------------------------------------------------------------------------

const d = (day: number) => new Date(2026, 6, day); // July 2026

function ev(over: Partial<CandidateEvent> & { id: string }): CandidateEvent {
  return {
    startDate: d(1),
    endDate: d(7),
    lat: 0,
    long: 0,
    pointsByRound: POINTS,
    prizeMoneyByRound: { W: 120000, F: 65000, SF: 37000, QF: 21000, R16: 12000, R32: 7000 },
    fieldRefRank: null,
    playerRankForEvent: null,
    acceptance: "in",
    ...over,
  };
}

const W = (o: Partial<OptimizerWeights>): OptimizerWeights => ({
  points: 0,
  money: 0,
  travelTime: 0,
  travelCost: 0,
  ...o,
});

// Three non-overlapping weekly events at increasing longitude (real legs).
const A = ev({ id: "A", startDate: d(1), endDate: d(7), lat: 0, long: 0 });
const B = ev({ id: "B", startDate: d(11), endDate: d(17), lat: 0, long: 5 });
const C = ev({ id: "C", startDate: d(21), endDate: d(27), lat: 0, long: 10 });

describe("eventExpectedValue", () => {
  it("returns whole numbers", () => {
    const v = eventExpectedValue(ev({ id: "x", fieldRefRank: 100, playerRankForEvent: 50 }));
    expect(Number.isInteger(v.expectedPoints)).toBe(true);
    expect(Number.isInteger(v.expectedPrize)).toBe(true);
  });

  it("collapses a reach ('out') event toward zero vs an 'in' event", () => {
    const inEv = eventExpectedValue(ev({ id: "i", acceptance: "in" }));
    const outEv = eventExpectedValue(ev({ id: "o", acceptance: "out" }));
    // Same underlying value, but 'out' is weighted to ~5%.
    expect(outEv.expectedPoints).toBeLessThan(inEv.expectedPoints * 0.1);
    expect(outEv.expectedPoints).toBeGreaterThanOrEqual(0);
  });

  it("does not penalize 'in' or 'unknown' acceptance", () => {
    const a = eventExpectedValue(ev({ id: "a", acceptance: "in" }));
    const b = eventExpectedValue(ev({ id: "b", acceptance: "unknown" }));
    expect(a.expectedPoints).toBe(b.expectedPoints);
  });

  it("normalizes prize money to USD by the event's currency (H1)", () => {
    const usd = eventExpectedValue(ev({ id: "usd", acceptance: "in" }));
    const eur = eventExpectedValue(ev({ id: "eur", acceptance: "in", currency: "EUR" }));
    const jpy = eventExpectedValue(ev({ id: "jpy", acceptance: "in", currency: "JPY" }));
    // Points are currency-independent; only prize is converted.
    expect(eur.expectedPoints).toBe(usd.expectedPoints);
    // EUR prize converts up (~1.08×); JPY converts far down — so a nominally huge
    // ¥ table can no longer dominate the money scale (the core H1 defect).
    expect(eur.expectedPrize / usd.expectedPrize).toBeCloseTo(1.08, 2);
    expect(jpy.expectedPrize).toBeLessThan(usd.expectedPrize * 0.1);
  });

  it("leaves USD/unspecified-currency prize unchanged", () => {
    const bare = eventExpectedValue(ev({ id: "bare", acceptance: "in" }));
    const usd = eventExpectedValue(ev({ id: "usd2", acceptance: "in", currency: "USD" }));
    expect(bare.expectedPrize).toBe(usd.expectedPrize);
  });
});

describe("optimizeSchedule", () => {
  it("returns an empty schedule for no candidates", () => {
    const r = optimizeSchedule([], W({ points: 1 }));
    expect(r.events).toEqual([]);
    expect(r.totals.expectedPoints).toBe(0);
  });

  it("maximizing points fills every feasible (non-overlapping) event", () => {
    const r = optimizeSchedule([A, B, C], W({ points: 1 }));
    expect(r.events.map((e) => e.id)).toEqual(["A", "B", "C"]);
  });

  it("returns events in chronological order", () => {
    const r = optimizeSchedule([C, A, B], W({ points: 1 }));
    expect(r.events.map((e) => e.id)).toEqual(["A", "B", "C"]);
  });

  it("penalizing travel cost collapses to a single (leg-free) event", () => {
    const r = optimizeSchedule([A, B, C], W({ travelCost: 1 }));
    expect(r.events).toHaveLength(1);
    expect(r.totals.travelCost).toBe(0);
  });

  it("never double-books overlapping events", () => {
    const overlap = ev({ id: "B2", startDate: d(12), endDate: d(18), lat: 0, long: 5 });
    const r = optimizeSchedule([B, overlap], W({ points: 1 }));
    expect(r.events).toHaveLength(1);
  });

  it("honors minRestDays between events", () => {
    // B starts 4 days after A ends; requiring 10 rest days forbids playing both.
    const r = optimizeSchedule([A, B], W({ points: 1 }), { minRestDays: 10 });
    expect(r.events).toHaveLength(1);
  });

  it("honors maxEvents", () => {
    const r = optimizeSchedule([A, B, C], W({ points: 1 }), { maxEvents: 2 });
    expect(r.events).toHaveLength(2);
  });

  it("honors the budget cap on total travel cost", () => {
    // Any leg costs > 0; a zero cap forbids travel, leaving one event.
    const r = optimizeSchedule([A, B, C], W({ points: 1 }), { budgetCap: 0 });
    expect(r.events).toHaveLength(1);
  });

  it("onlyQualified hard-filters to events the player is in", () => {
    const reach = ev({ id: "R", startDate: d(31), endDate: d(37), lat: 0, long: 15, acceptance: "out" });
    const all = optimizeSchedule([A, reach], W({ points: 1 }));
    expect(all.events.map((e) => e.id)).toContain("R");
    const qualified = optimizeSchedule([A, reach], W({ points: 1 }), { onlyQualified: true });
    expect(qualified.events.map((e) => e.id)).not.toContain("R");
  });

  it("weights trade points against travel: more points-weight → more events", () => {
    const pointsHeavy = optimizeSchedule([A, B, C], W({ points: 0.9, travelCost: 0.1 }));
    const travelHeavy = optimizeSchedule([A, B, C], W({ points: 0.1, travelCost: 0.9 }));
    expect(pointsHeavy.totals.expectedPoints).toBeGreaterThanOrEqual(
      travelHeavy.totals.expectedPoints,
    );
    expect(pointsHeavy.events.length).toBeGreaterThanOrEqual(travelHeavy.events.length);
  });

  it("distinguishes points from prize money when they diverge", () => {
    // Two overlapping events: E rich in points, F rich in prize money.
    const E = ev({
      id: "E",
      startDate: d(11),
      endDate: d(17),
      pointsByRound: { W: 1000, F: 600, SF: 360, QF: 200, R16: 100, R32: 50 },
      prizeMoneyByRound: { W: 10000, F: 6000, SF: 3600, QF: 2000, R16: 1000, R32: 500 },
    });
    const F = ev({
      id: "F",
      startDate: d(12),
      endDate: d(18),
      pointsByRound: { W: 100, F: 60, SF: 36, QF: 20, R16: 10, R32: 5 },
      prizeMoneyByRound: { W: 900000, F: 540000, SF: 324000, QF: 180000, R16: 90000, R32: 45000 },
    });
    expect(optimizeSchedule([E, F], W({ points: 1 })).events.map((e) => e.id)).toEqual(["E"]);
    expect(optimizeSchedule([E, F], W({ money: 1 })).events.map((e) => e.id)).toEqual(["F"]);
  });

  it("recovery cadence thins a tightly-spaced schedule at high rest (BRA-69)", () => {
    // A, B, C are 10 days apart start-to-start. No limit → play all.
    const relaxed = optimizeSchedule([A, B, C], W({ points: 1 }), {
      recovery: { targetPerMonth: 5, weight: 0 },
    });
    expect(relaxed.events).toHaveLength(3);
    // Protect-body cadence (1/month, target gap 30d) heavily penalizes the tight
    // 10-day spacing, so the optimizer thins the schedule.
    const protective = optimizeSchedule([A, B, C], W({ points: 1 }), {
      recovery: { targetPerMonth: 1, weight: 2 },
    });
    expect(protective.events.length).toBeLessThan(3);
  });

  it("recovery penalizes a long-haul / time-zone leg at high rest (BRA-69)", () => {
    // Two well-spaced events (no cadence penalty at 19 days apart), but the
    // second is a long-haul across the world (huge distance + time-zone jump).
    const home = ev({ id: "H", startDate: d(1), endDate: d(7), lat: 40, long: 0 });
    const far = ev({ id: "Far", startDate: d(20), endDate: d(26), lat: 35, long: 140 });
    const relaxed = optimizeSchedule([home, far], W({ points: 1 }), {
      recovery: { targetPerMonth: 5, weight: 0 },
    });
    expect(relaxed.events.map((e) => e.id)).toEqual(["H", "Far"]);
    // At high rest the travel load makes the long-haul second event not worth it.
    const protective = optimizeSchedule([home, far], W({ points: 1 }), {
      recovery: { targetPerMonth: 2, weight: 2 },
    });
    expect(protective.events.map((e) => e.id)).toEqual(["H"]);
  });

  it("scales to a large candidate pool without hanging (beam search, BRA-71)", () => {
    // 50 non-overlapping events — the old exact recursion was exponential here.
    const many = Array.from({ length: 50 }, (_, i) =>
      ev({ id: `M${i}`, startDate: d(1 + i * 8), endDate: d(6 + i * 8), lat: 0, long: 0 }),
    );
    const r = optimizeSchedule(many, W({ points: 1 }));
    // Points-only over a fully feasible chain → it should build a long schedule.
    expect(r.events.length).toBeGreaterThan(30);
  });

  it("a stronger player earns more expected points at the same event", () => {
    const strong = ev({ id: "S", fieldRefRank: 100, playerRankForEvent: 20 });
    const weak = ev({ id: "S", fieldRefRank: 100, playerRankForEvent: 300 });
    const sPts = optimizeSchedule([strong], W({ points: 1 })).totals.expectedPoints;
    const wPts = optimizeSchedule([weak], W({ points: 1 })).totals.expectedPoints;
    expect(sPts).toBeGreaterThan(wPts);
  });
});
