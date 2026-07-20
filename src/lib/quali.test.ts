import { describe, it, expect } from "vitest";
import {
  hasQualifyingWeekend,
  entersQualifying,
  heuristicQualiStart,
  arrivalDate,
  isQualiArrival,
} from "./quali";
import { Tour } from "@/generated/prisma/enums";

const mainDraw = new Date("2026-07-13T00:00:00Z");
const realQuali = new Date("2026-07-11T00:00:00Z");

describe("hasQualifyingWeekend", () => {
  it("covers Challenger and ITF, not ATP/WTA main tour", () => {
    expect(hasQualifyingWeekend(Tour.CHALLENGER)).toBe(true);
    expect(hasQualifyingWeekend(Tour.ITF)).toBe(true);
    expect(hasQualifyingWeekend(Tour.ATP)).toBe(false);
    expect(hasQualifyingWeekend(Tour.WTA)).toBe(false);
  });
});

describe("entersQualifying", () => {
  it("is true when the player's rank is below the cutoff", () => {
    expect(entersQualifying(300, 268)).toBe(true); // below cut → quali
    expect(entersQualifying(200, 268)).toBe(false); // above cut → direct
    expect(entersQualifying(268, 268)).toBe(false); // at cut → direct
  });

  it("assumes direct entry when rank or cutoff is unknown", () => {
    expect(entersQualifying(null, 268)).toBe(false);
    expect(entersQualifying(300, null)).toBe(false);
  });
});

describe("heuristicQualiStart", () => {
  it("is two days before main draw (timezone-proof)", () => {
    expect(heuristicQualiStart(mainDraw).toISOString()).toBe("2026-07-11T00:00:00.000Z");
  });
});

describe("arrivalDate", () => {
  const chal = { tour: Tour.CHALLENGER, startDate: mainDraw, qualiStartDate: null };

  it("pulls below-cut entrants back to the heuristic sign-in", () => {
    expect(arrivalDate(chal, 300, 268)).toEqual(heuristicQualiStart(mainDraw));
  });

  it("prefers a real qualiStartDate over the heuristic", () => {
    expect(arrivalDate({ ...chal, qualiStartDate: realQuali }, 300, 268)).toEqual(realQuali);
  });

  it("keeps direct acceptances at main-draw start", () => {
    expect(arrivalDate(chal, 200, 268)).toEqual(mainDraw);
    expect(arrivalDate(chal, null, 268)).toEqual(mainDraw);
  });

  it("does not shift ATP/WTA events (no quali weekend)", () => {
    expect(
      arrivalDate({ tour: Tour.ATP, startDate: mainDraw, qualiStartDate: null }, 300, 268),
    ).toEqual(mainDraw);
  });
});

describe("isQualiArrival", () => {
  it("flags an earlier arrival only for below-cut entrants at quali events", () => {
    const chal = { tour: Tour.CHALLENGER, startDate: mainDraw, qualiStartDate: null };
    expect(isQualiArrival(chal, 300, 268)).toBe(true);
    expect(isQualiArrival(chal, 200, 268)).toBe(false);
    expect(
      isQualiArrival({ tour: Tour.ATP, startDate: mainDraw, qualiStartDate: null }, 300, 268),
    ).toBe(false);
  });
});
