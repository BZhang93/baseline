import { describe, it, expect } from "vitest";
import { roundValue } from "./round-values";

describe("roundValue", () => {
  it("returns the numeric value for a present key", () => {
    expect(roundValue({ W: 2000, F: 1300 }, "W")).toBe(2000);
    expect(roundValue({ W: 0 }, "W")).toBe(0);
  });

  it("returns null for a missing key", () => {
    expect(roundValue({ F: 1300 }, "W")).toBeNull();
  });

  it("returns null for non-object / non-number values", () => {
    expect(roundValue(null, "W")).toBeNull();
    expect(roundValue(undefined, "W")).toBeNull();
    expect(roundValue("nope", "W")).toBeNull();
    expect(roundValue({ W: "2000" }, "W")).toBeNull();
  });
});
