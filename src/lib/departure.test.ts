import { describe, it, expect } from "vitest";
import { roundsForDraw, departureWindow } from "./departure";

describe("roundsForDraw", () => {
  it("is the number of main-draw rounds for the size", () => {
    expect(roundsForDraw(32)).toBe(5);
    expect(roundsForDraw(28)).toBe(5); // ceil(log2(28))
    expect(roundsForDraw(48)).toBe(6);
    expect(roundsForDraw(64)).toBe(6);
    expect(roundsForDraw(128)).toBe(7);
  });
  it("never goes below 1", () => {
    expect(roundsForDraw(1)).toBe(1);
  });
});

describe("departureWindow", () => {
  it("earliest = day after a first-round loss, latest = day after the final", () => {
    const start = new Date("2026-07-13T00:00:00Z");
    const end = new Date("2026-07-19T00:00:00Z");
    const w = departureWindow(start, end, 32);
    expect(w.earliest.toISOString()).toBe("2026-07-14T00:00:00.000Z");
    expect(w.latest.toISOString()).toBe("2026-07-20T00:00:00.000Z");
    expect(w.rounds).toBe(5);
  });
});
