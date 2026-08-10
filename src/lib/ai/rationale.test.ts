import { describe, it, expect } from "vitest";
import {
  normalizeRationales,
  sanitizePickFacts,
  sanitizeRationaleContext,
  MAX_RATIONALE_PICKS,
  type PickFact,
} from "./rationale";

const pick = (over: Partial<PickFact> = {}): PickFact => ({
  id: "t1",
  name: "Test Open",
  city: "Testville",
  country: "Testland",
  surface: "HARD",
  expectedPoints: 100,
  expectedPrize: 5000,
  reach: "in",
  ...over,
});

describe("sanitizePickFacts (review H3)", () => {
  it("caps the number of picks", () => {
    const many = Array.from({ length: 5000 }, () => pick());
    expect(sanitizePickFacts(many)).toHaveLength(MAX_RATIONALE_PICKS);
  });

  it("truncates over-long string fields", () => {
    const huge = "x".repeat(10_000);
    const [p] = sanitizePickFacts([pick({ name: huge, city: huge, reach: huge })]);
    expect(p.name.length).toBe(80);
    expect(p.city.length).toBe(60);
    expect(p.reach.length).toBe(24);
  });

  it("coerces wrong types to safe defaults", () => {
    const [p] = sanitizePickFacts([
      { name: 123, expectedPrize: Infinity, reach: null } as unknown as PickFact,
    ]);
    expect(p.name).toBe("");
    expect(p.expectedPrize).toBe(0);
    expect(p.reach).toBe("");
  });

  it("returns an empty array for junk input", () => {
    expect(sanitizePickFacts(null as unknown as PickFact[])).toEqual([]);
  });
});

describe("sanitizeRationaleContext (review H3)", () => {
  it("caps priorities and note length, dropping an absent note", () => {
    const long = "z".repeat(1000);
    expect(sanitizeRationaleContext({ priorities: long }).priorities.length).toBe(200);
    expect(sanitizeRationaleContext({ priorities: "p", note: long }).note?.length).toBe(400);
    expect(sanitizeRationaleContext({ priorities: "p" }).note).toBeUndefined();
  });
});

describe("normalizeRationales", () => {
  it("returns exactly `count` strings from {rationales}", () => {
    expect(normalizeRationales({ rationales: ["a", "b"] }, 2)).toEqual(["a", "b"]);
  });

  it("accepts a bare array too", () => {
    expect(normalizeRationales(["x"], 1)).toEqual(["x"]);
  });

  it("pads missing entries with empty strings and truncates extras", () => {
    expect(normalizeRationales({ rationales: ["only one"] }, 3)).toEqual(["only one", "", ""]);
    expect(normalizeRationales(["a", "b", "c"], 2)).toEqual(["a", "b"]);
  });

  it("trims, caps length, and drops non-strings", () => {
    expect(normalizeRationales({ rationales: ["  spaced  ", 42] }, 2)).toEqual(["spaced", ""]);
    const long = "y".repeat(500);
    expect(normalizeRationales([long], 1)[0].length).toBe(240);
  });

  it("handles junk input", () => {
    expect(normalizeRationales(null, 2)).toEqual(["", ""]);
    expect(normalizeRationales({ nope: 1 }, 1)).toEqual([""]);
  });
});
