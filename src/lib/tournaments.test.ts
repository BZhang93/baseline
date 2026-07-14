import { describe, it, expect } from "vitest";
import { computeGap, rankingTourFor, buildRankingLookup } from "./tournaments";
import { Tour } from "@/generated/prisma/client";

describe("computeGap", () => {
  it("is 'in' when the player's rank is at or above the cutoff", () => {
    expect(computeGap(50, 72, 900, 700)).toEqual({ status: "in", spots: 0, points: 0 });
    expect(computeGap(72, 72, 700, 700)).toEqual({ status: "in", spots: 0, points: 0 });
  });

  it("is 'borderline' within 10 spots below the cutoff", () => {
    const gap = computeGap(80, 72, 620, 700);
    expect(gap.status).toBe("borderline");
    expect(gap.spots).toBe(8);
    expect(gap.points).toBe(80); // 700 - 620
  });

  it("is 'out' when well below the cutoff", () => {
    const gap = computeGap(150, 72, 460, 700);
    expect(gap.status).toBe("out");
    expect(gap.spots).toBe(78);
    expect(gap.points).toBe(240);
  });

  it("is 'unknown' when the player has no rank", () => {
    expect(computeGap(null, 72, null, 700)).toEqual({
      status: "unknown",
      spots: null,
      points: null,
    });
  });

  it("omits the points gap when points aren't derivable", () => {
    const gap = computeGap(150, 72, null, null);
    expect(gap.status).toBe("out");
    expect(gap.spots).toBe(78);
    expect(gap.points).toBeNull();
  });

  it("never returns a negative points gap", () => {
    // Player ranked below cutoff but with more points (edge/stale data).
    const gap = computeGap(80, 72, 900, 700);
    expect(gap.points).toBe(0);
  });
});

describe("rankingTourFor", () => {
  it("maps ATP/WTA to themselves and Challenger/ITF to null", () => {
    expect(rankingTourFor(Tour.ATP)).toBe(Tour.ATP);
    expect(rankingTourFor(Tour.WTA)).toBe(Tour.WTA);
    expect(rankingTourFor(Tour.CHALLENGER)).toBeNull();
    expect(rankingTourFor(Tour.ITF)).toBeNull();
  });
});

describe("buildRankingLookup", () => {
  const OLD = new Date("2026-06-29");
  const NEW = new Date("2026-07-06");

  it("looks up points by (tour, rank)", () => {
    const lookup = buildRankingLookup([
      { tour: Tour.ATP, rank: 1, points: 11000, asOfDate: OLD },
      { tour: Tour.WTA, rank: 1, points: 10000, asOfDate: OLD },
    ]);
    expect(lookup(Tour.ATP, 1)).toBe(11000);
    expect(lookup(Tour.WTA, 1)).toBe(10000);
  });

  it("uses the latest snapshot per tour (a stale row can't overwrite it)", () => {
    const lookup = buildRankingLookup([
      { tour: Tour.ATP, rank: 1, points: 9000, asOfDate: OLD },
      { tour: Tour.ATP, rank: 1, points: 11500, asOfDate: NEW },
    ]);
    expect(lookup(Tour.ATP, 1)).toBe(11500);
  });

  it("keeps each tour's latest snapshot independent", () => {
    // WTA only has the old snapshot; ATP has a newer one.
    const lookup = buildRankingLookup([
      { tour: Tour.ATP, rank: 5, points: 4000, asOfDate: OLD },
      { tour: Tour.ATP, rank: 5, points: 4200, asOfDate: NEW },
      { tour: Tour.WTA, rank: 5, points: 3800, asOfDate: OLD },
    ]);
    expect(lookup(Tour.ATP, 5)).toBe(4200);
    expect(lookup(Tour.WTA, 5)).toBe(3800);
  });

  it("returns null for an unknown rank or null rank", () => {
    const lookup = buildRankingLookup([
      { tour: Tour.ATP, rank: 1, points: 11000, asOfDate: OLD },
    ]);
    expect(lookup(Tour.ATP, 999)).toBeNull();
    expect(lookup(Tour.ATP, null)).toBeNull();
  });
});
