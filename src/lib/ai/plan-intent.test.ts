import { describe, it, expect } from "vitest";
import { normalizePlanIntent } from "./plan-intent";

describe("normalizePlanIntent", () => {
  it("keeps and clamps valid numeric priorities/constraints", () => {
    expect(
      normalizePlanIntent({ restPriority: 70, costPriority: 40, maxEvents: 4, minRestDays: 1, budgetCap: 6000 }),
    ).toEqual({ restPriority: 70, costPriority: 40, maxEvents: 4, minRestDays: 1, budgetCap: 6000 });
    expect(normalizePlanIntent({ restPriority: 999, costPriority: -5 })).toEqual({
      restPriority: 100,
      costPriority: 0,
    });
    // numeric strings coerce
    expect(normalizePlanIntent({ maxEvents: "3" })).toEqual({ maxEvents: 3 });
  });

  it("validates dates and drops a reversed window", () => {
    expect(normalizePlanIntent({ from: "2026-08-01", to: "2026-09-30" })).toEqual({
      from: "2026-08-01",
      to: "2026-09-30",
    });
    expect(normalizePlanIntent({ from: "not-a-date" })).toEqual({});
    expect(normalizePlanIntent({ from: "2026-09-30", to: "2026-08-01" })).toEqual({});
  });

  it("filters surfaces/tours to known enum values (case-insensitive), dropping junk", () => {
    expect(normalizePlanIntent({ surfaces: ["clay", "HARD", "lava"] })).toEqual({
      surfaces: ["CLAY", "HARD"],
    });
    expect(normalizePlanIntent({ tours: ["atp", "nope"] })).toEqual({ tours: ["ATP"] });
    // no valid members → field omitted entirely
    expect(normalizePlanIntent({ surfaces: ["lava"] })).toEqual({});
  });

  it("keeps free-text regions and note, dropping empties and capping length", () => {
    expect(normalizePlanIntent({ regions: ["Europe", " ", "Spain"] })).toEqual({
      regions: ["Europe", "Spain"],
    });
    const long = "x".repeat(1000);
    const out = normalizePlanIntent({ note: long });
    expect(out.note?.length).toBe(400);
  });

  it("ignores unknown fields and non-object input", () => {
    expect(normalizePlanIntent({ hackWeights: 999, restPriority: 50 })).toEqual({ restPriority: 50 });
    expect(normalizePlanIntent(null)).toEqual({});
    expect(normalizePlanIntent(undefined)).toEqual({});
  });
});
