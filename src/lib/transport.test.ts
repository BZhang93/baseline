import { describe, it, expect } from "vitest";
import {
  estimateMode,
  modeFeasible,
  routeLeg,
  transportPriorityFromWeights,
  parseLegModeOverrides,
  legKey,
} from "./transport";
import { TransportMode } from "@/generated/prisma/enums";

describe("estimateMode", () => {
  it("grows with distance and carries fixed overhead", () => {
    const short = estimateMode(100, TransportMode.FLIGHT);
    const long = estimateMode(2000, TransportMode.FLIGHT);
    expect(long.durationMinutes).toBeGreaterThan(short.durationMinutes);
    expect(long.costEstimate).toBeGreaterThan(short.costEstimate);
    // 0 km flight still carries the ~2h airport overhead.
    expect(estimateMode(0, TransportMode.FLIGHT).durationMinutes).toBe(120);
  });

  it("inflates ground distance (circuity) so it's not straight-line optimistic", () => {
    // A 100 km hop by train covers ~130 km of track.
    expect(estimateMode(100, TransportMode.TRAIN).costEstimate).toBe(Math.round(130 * 0.2));
  });
});

describe("modeFeasible", () => {
  it("gates ground modes beyond the long-distance threshold", () => {
    expect(modeFeasible(300, TransportMode.TRAIN)).toBe(true);
    expect(modeFeasible(2000, TransportMode.TRAIN)).toBe(false);
    expect(modeFeasible(2000, TransportMode.BUS)).toBe(false);
  });

  it("keeps flight feasible at any distance", () => {
    expect(modeFeasible(50, TransportMode.FLIGHT)).toBe(true);
    expect(modeFeasible(9000, TransportMode.FLIGHT)).toBe(true);
  });
});

describe("routeLeg", () => {
  it("picks the fastest mode for a time (protect-body) priority", () => {
    const r = routeLeg(150, [], "time");
    expect(r.recommended.mode).toBe(TransportMode.TRAIN);
  });

  it("picks the cheapest mode for a cost (maximize-points) priority", () => {
    const r = routeLeg(150, [], "cost");
    expect(r.recommended.mode).toBe(TransportMode.BUS);
  });

  it("lets reality win: a long leg falls back to flight even when ground is preferred", () => {
    const r = routeLeg(2000, [TransportMode.BUS, TransportMode.TRAIN], "cost");
    expect(r.recommended.mode).toBe(TransportMode.FLIGHT);
    expect(r.alternatives).toHaveLength(0); // every ground mode gated out
  });

  it("breaks ties by preference", () => {
    // On a short hop train and flight tie on the balanced objective; the
    // player's preferred train should win the tie.
    const r = routeLeg(100, [TransportMode.TRAIN], "balanced");
    expect(r.recommended.mode).toBe(TransportMode.TRAIN);
  });

  it("honors a feasible override and ignores an infeasible one", () => {
    const forced = routeLeg(150, [], "balanced", TransportMode.CAR);
    expect(forced.recommended.mode).toBe(TransportMode.CAR);

    const infeasible = routeLeg(2000, [], "balanced", TransportMode.BUS);
    expect(infeasible.recommended.mode).toBe(TransportMode.FLIGHT);
  });

  it("honors a feasible override even outside the player's usual prefs", () => {
    // Player only lists train, but explicitly overrides this leg to car.
    const r = routeLeg(150, [TransportMode.TRAIN], "balanced", TransportMode.CAR);
    expect(r.recommended.mode).toBe(TransportMode.CAR);
  });

  it("flags contested when the pick fights a materially worse preferred mode", () => {
    // Prefers bus, but on a 300 km leg the fastest option (flight) is hours quicker.
    const r = routeLeg(300, [TransportMode.BUS], "time");
    expect(r.recommended.mode).toBe(TransportMode.FLIGHT);
    expect(r.contested).toBe(true);
    expect(r.alternatives[0].mode).toBe(TransportMode.BUS);
    expect(r.alternatives[0].rationale).toMatch(/Bus/);
  });

  it("attaches a trade-off rationale to each alternative", () => {
    const r = routeLeg(150, [], "cost");
    for (const alt of r.alternatives) {
      expect(alt.rationale).toMatch(/(cheaper|more|same)/);
      expect(alt.rationale).toMatch(/(faster|same time|\+)/);
    }
  });
});

describe("transportPriorityFromWeights", () => {
  it("favors time when travel-time weight is higher, cost when cost is higher", () => {
    expect(transportPriorityFromWeights(3, 1)).toBe("time"); // protect body
    expect(transportPriorityFromWeights(1, 3)).toBe("cost"); // save money
    expect(transportPriorityFromWeights(2, 2)).toBe("balanced");
  });
});

describe("parseLegModeOverrides", () => {
  it("keeps only real TransportMode values", () => {
    expect(
      parseLegModeOverrides({ "a>b": "TRAIN", "x>y": "WALK", "z>w": 5 }),
    ).toEqual({ "a>b": "TRAIN" });
  });

  it("returns an empty map for null/garbage", () => {
    expect(parseLegModeOverrides(null)).toEqual({});
    expect(parseLegModeOverrides("nope")).toEqual({});
  });
});

describe("legKey", () => {
  it("joins the tournament pair", () => {
    expect(legKey("a", "b")).toBe("a>b");
  });
});
