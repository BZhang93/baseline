import { describe, it, expect } from "vitest";
import { normalizeRationales } from "./rationale";

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
