import { describe, it, expect } from "vitest";
import { haversineKm, estimateTravel } from "./schedules";

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
