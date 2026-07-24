import { describe, it, expect } from "vitest";
import { validateLoadedData, formatValidationReport } from "./validate";
import type { LoadedData } from "./types";
import { Tour, Surface } from "@/generated/prisma/enums";

// A clean July-2026 dataset; each test clones and breaks one thing.
function base(): LoadedData {
  return {
    categories: [
      {
        tour: Tour.ATP,
        tier: "ATP_250",
        season: 2026,
        pointsByRound: { W: 250, F: 165, SF: 100, QF: 50, R16: 25, R32: 13 },
        prizeMoneyByRound: { W: 120000, F: 65000, SF: 37000, QF: 21000, R16: 12000, R32: 7000 },
      },
    ],
    tournaments: [
      {
        name: "Test Open",
        tour: Tour.ATP,
        tier: "ATP_250",
        edition: 2026,
        city: "Testville",
        country: "Testland",
        surface: Surface.HARD,
        startDate: new Date("2026-07-13T00:00:00Z"),
        endDate: new Date("2026-07-19T00:00:00Z"),
        drawSize: 32,
      },
    ],
    rankings: [
      { tour: Tour.ATP, playerName: "Alpha", rank: 1, points: 5000, asOfDate: new Date("2026-07-06T00:00:00Z") },
      { tour: Tour.ATP, playerName: "Bravo", rank: 2, points: 4000, asOfDate: new Date("2026-07-06T00:00:00Z") },
    ],
  };
}

const opts = { expectedSeason: 2026, expectedMonths: [7] };

describe("validateLoadedData — happy path", () => {
  it("passes a clean July-2026 dataset with no errors or warnings", () => {
    const r = validateLoadedData(base(), opts);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.counts).toEqual({ categories: 1, tournaments: 1, rankings: 2 });
  });
});

describe("category checks", () => {
  it("rejects empty or winner-less points", () => {
    const d = base();
    d.categories[0].pointsByRound = {};
    expect(validateLoadedData(d, opts).ok).toBe(false);

    const d2 = base();
    d2.categories[0].pointsByRound = { F: 165, SF: 100 };
    expect(validateLoadedData(d2, opts).errors.some((e) => /winner/.test(e.message))).toBe(true);
  });

  it("rejects negative prize money", () => {
    const d = base();
    d.categories[0].prizeMoneyByRound.QF = -1;
    expect(validateLoadedData(d, opts).ok).toBe(false);
  });

  it("rejects non-monotonic points (a deeper round out-scoring a higher one)", () => {
    const d = base();
    d.categories[0].pointsByRound.SF = 999; // SF > F
    expect(validateLoadedData(d, opts).errors.some((e) => /monotonic/.test(e.message))).toBe(true);
  });

  it("rejects duplicate categories", () => {
    const d = base();
    d.categories.push({ ...d.categories[0] });
    expect(validateLoadedData(d, opts).errors.some((e) => /duplicate/.test(e.message))).toBe(true);
  });
});

describe("tournament checks", () => {
  it("rejects a missing required field", () => {
    const d = base();
    d.tournaments[0].city = "";
    expect(validateLoadedData(d, opts).errors.some((e) => /city/.test(e.message))).toBe(true);
  });

  it("rejects endDate before startDate", () => {
    const d = base();
    d.tournaments[0].endDate = new Date("2026-07-01T00:00:00Z");
    expect(validateLoadedData(d, opts).ok).toBe(false);
  });

  it("rejects the wrong season and out-of-window months", () => {
    const wrongYear = base();
    wrongYear.tournaments[0].edition = 2025;
    wrongYear.tournaments[0].startDate = new Date("2025-07-13T00:00:00Z");
    expect(validateLoadedData(wrongYear, opts).ok).toBe(false);

    const wrongMonth = base();
    wrongMonth.tournaments[0].startDate = new Date("2026-03-13T00:00:00Z");
    expect(validateLoadedData(wrongMonth, opts).errors.some((e) => /month/.test(e.message))).toBe(true);
  });

  it("errors on out-of-range draw size but only warns on an unusual one", () => {
    const tooBig = base();
    tooBig.tournaments[0].drawSize = 999;
    expect(validateLoadedData(tooBig, opts).ok).toBe(false);

    const unusual = base();
    unusual.tournaments[0].drawSize = 30; // in range, atypical
    const r = validateLoadedData(unusual, opts);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => /unusual drawSize/.test(w.message))).toBe(true);
  });

  it("rejects an event with no category ground truth", () => {
    const d = base();
    d.tournaments[0].tier = "ATP_500"; // no such category in the set
    expect(validateLoadedData(d, opts).errors.some((e) => /no category ground truth/.test(e.message))).toBe(
      true,
    );
  });
});

describe("ranking checks", () => {
  it("rejects non-monotonic points within a list", () => {
    const d = base();
    d.rankings[1].points = 9000; // #2 out-points #1
    expect(validateLoadedData(d, opts).errors.some((e) => /not monotonic/.test(e.message))).toBe(true);
  });

  it("rejects a duplicate rank in the same list", () => {
    const d = base();
    d.rankings[1].rank = 1;
    expect(validateLoadedData(d, opts).errors.some((e) => /duplicate rank/.test(e.message))).toBe(true);
  });
});

describe("malformed input is reported, not thrown", () => {
  it("handles a non-object points map", () => {
    const d = base();
    // A source that fed a string where a round-map belongs.
    (d.categories[0] as { pointsByRound: unknown }).pointsByRound = "oops";
    expect(() => validateLoadedData(d, opts)).not.toThrow();
    expect(validateLoadedData(d, opts).errors.some((e) => /not an object/.test(e.message))).toBe(true);
  });

  it("handles an invalid asOfDate", () => {
    const d = base();
    (d.rankings[0] as { asOfDate: unknown }).asOfDate = new Date("not-a-date");
    expect(() => validateLoadedData(d, opts)).not.toThrow();
    expect(validateLoadedData(d, opts).ok).toBe(false);
  });
});

describe("formatValidationReport", () => {
  it("summarizes pass/fail with counts", () => {
    expect(formatValidationReport(validateLoadedData(base(), opts))).toMatch(/^PASS/);
    const d = base();
    d.categories[0].pointsByRound = {};
    expect(formatValidationReport(validateLoadedData(d, opts))).toMatch(/^FAIL/);
  });
});
