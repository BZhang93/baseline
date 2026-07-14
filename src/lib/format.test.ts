import { describe, it, expect } from "vitest";
import { kmToMi, miToKm, formatMoney, formatTravelTime } from "./format";

describe("distance conversions", () => {
  it("round-trips km ↔ mi", () => {
    expect(miToKm(kmToMi(100))).toBeCloseTo(100, 6);
  });

  it("matches known values", () => {
    expect(kmToMi(1.609344)).toBeCloseTo(1, 6);
    expect(miToKm(1)).toBeCloseTo(1.609344, 6);
  });
});

describe("formatMoney / formatTravelTime", () => {
  it("formats money and dashes on null", () => {
    expect(formatMoney(1500)).toBe("$1,500");
    expect(formatMoney(null)).toBe("—");
  });

  it("formats travel time and dashes on null/zero", () => {
    expect(formatTravelTime(150)).toBe("2h 30m");
    expect(formatTravelTime(120)).toBe("2h");
    expect(formatTravelTime(null)).toBe("—");
    expect(formatTravelTime(0)).toBe("—");
  });
});
