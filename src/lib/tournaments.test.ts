import { describe, it, expect } from "vitest";
import { computeGap, rankingTourFor } from "./tournaments";
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
