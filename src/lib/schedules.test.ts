import { describe, it, expect } from "vitest";
import {
  haversineKm,
  estimateTravel,
  buildLegsAndScores,
  parseEventIdsParam,
  scheduleIsPast,
  type LegEvent,
} from "./schedules";

describe("scheduleIsPast", () => {
  const now = new Date("2026-08-01T12:00:00Z");
  it("is past when the last event ended before today", () => {
    expect(scheduleIsPast({ endDate: new Date("2026-07-26") }, now)).toBe(true);
  });
  it("is not past when the last event ends today or later", () => {
    expect(scheduleIsPast({ endDate: new Date("2026-08-01") }, now)).toBe(false);
    expect(scheduleIsPast({ endDate: new Date("2026-08-15") }, now)).toBe(false);
  });
  it("undated schedules are never past (drafts stay current)", () => {
    expect(scheduleIsPast({ endDate: null }, now)).toBe(false);
  });
});

function ev(
  startDate: string,
  lat: number | null,
  long: number | null,
  w = 250,
  prize = 100000,
): LegEvent {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6); // a tournament week (Mon–Sun)
  return {
    id: startDate, // unique per event in these fixtures
    city: "City",
    country: "Country",
    lat,
    long,
    startDate: start,
    endDate: end,
    category: { pointsByRound: { W: w }, prizeMoneyByRound: { W: prize } },
  };
}

describe("haversineKm", () => {
  it("is ~0 for identical points", () => {
    expect(haversineKm({ lat: 50, long: 14 }, { lat: 50, long: 14 })).toBeCloseTo(0, 5);
  });

  it("matches a known distance (Palermo → Prague ≈ 1200 km)", () => {
    const d = haversineKm(
      { lat: 38.1157, long: 13.3615 },
      { lat: 50.0755, long: 14.4378 },
    );
    expect(d).toBeGreaterThan(1250);
    expect(d).toBeLessThan(1400);
  });

  it("is symmetric", () => {
    const a = { lat: 53.5875, long: 9.9375 };
    const b = { lat: 38.9072, long: -77.0369 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
  });
});

describe("estimateTravel", () => {
  it("grows with distance", () => {
    const short = estimateTravel(200);
    const long = estimateTravel(2000);
    expect(long.durationMinutes).toBeGreaterThan(short.durationMinutes);
    expect(long.costEstimate).toBeGreaterThan(short.costEstimate);
  });

  it("includes fixed overhead in duration", () => {
    // 0 km still carries ~2h airport overhead.
    expect(estimateTravel(0).durationMinutes).toBe(120);
    expect(estimateTravel(0).costEstimate).toBe(0);
  });
});

describe("buildLegsAndScores", () => {
  it("creates N-1 legs and sums potential scores", () => {
    const events = [
      ev("2026-07-13", 38.1157, 13.3615, 250, 100000), // Palermo
      ev("2026-07-20", 50.0755, 14.4378, 250, 100000), // Prague
    ];
    const built = buildLegsAndScores(events);
    expect(built.legs).toHaveLength(1);
    expect(built.legs[0].durationMinutes).toBeGreaterThan(0);
    expect(built.legs[0].costEstimate).toBeGreaterThan(0);
    expect(built.scorePoints).toBe(500);
    expect(built.scorePrizeMoney).toBe(200000);
    expect(built.scoreTravelTimeMin).toBe(built.legs[0].durationMinutes);
  });

  it("has no legs for a single event", () => {
    const built = buildLegsAndScores([ev("2026-07-13", 38.1, 13.3)]);
    expect(built.legs).toHaveLength(0);
    expect(built.scoreTravelTimeMin).toBe(0);
    expect(built.scorePoints).toBe(250);
  });

  it("leaves a leg's estimates null when coordinates are missing", () => {
    const built = buildLegsAndScores([
      ev("2026-07-13", null, null),
      ev("2026-07-20", 50.0755, 14.4378),
    ]);
    expect(built.legs).toHaveLength(1);
    expect(built.legs[0].durationMinutes).toBeNull();
    expect(built.legs[0].costEstimate).toBeNull();
    expect(built.scoreTravelCost).toBe(0);
  });

  it("only totals the played path — same-week events are dropped, not summed", () => {
    const built = buildLegsAndScores([
      ev("2026-07-13", 38.1157, 13.3615, 250, 100000), // week 1
      ev("2026-07-14", 50.0755, 14.4378, 250, 100000), // week 1 — collides, dropped
      ev("2026-07-20", 41.9028, 12.4964, 250, 100000), // week 2
    ]);
    expect(built.conflictCount).toBe(1);
    expect(built.scorePoints).toBe(500); // two counted, not 750
    expect(built.legs).toHaveLength(1); // one leg across the 2-event path
  });
});

describe("parseEventIdsParam", () => {
  const valid = ["a", "b", "c"];

  it("returns [] for an empty/missing param", () => {
    expect(parseEventIdsParam(undefined, valid)).toEqual([]);
    expect(parseEventIdsParam("", valid)).toEqual([]);
  });

  it("keeps only valid ids, preserving order", () => {
    expect(parseEventIdsParam("b,a", valid)).toEqual(["b", "a"]);
  });

  it("ignores unknown ids and blanks", () => {
    expect(parseEventIdsParam("a, ,zzz,c", valid)).toEqual(["a", "c"]);
  });

  it("de-duplicates", () => {
    expect(parseEventIdsParam("a,a,b", valid)).toEqual(["a", "b"]);
  });
});
