import { describe, it, expect } from "vitest";
import { toUsd, convert, isCurrency } from "./currency";

describe("toUsd", () => {
  it("passes USD through and scales other currencies", () => {
    expect(toUsd(100, "USD")).toBe(100);
    expect(toUsd(100, "EUR")).toBeCloseTo(108);
  });
  it("passes unknown currencies through unchanged", () => {
    expect(toUsd(100, "XYZ")).toBe(100);
  });
});

describe("convert", () => {
  it("is identity for same currency", () => {
    expect(convert(100, "USD", "USD")).toBe(100);
  });
  it("converts via USD", () => {
    // 108 EUR → 116.64 USD
    expect(convert(108, "EUR", "USD")).toBeCloseTo(116.64);
    // 100 EUR = 108 USD → /1.27 = ~85.04 GBP
    expect(convert(100, "EUR", "GBP")).toBeCloseTo(85.04, 1);
  });
});

describe("isCurrency", () => {
  it("recognizes supported codes only", () => {
    expect(isCurrency("EUR")).toBe(true);
    expect(isCurrency("XYZ")).toBe(false);
  });
});
