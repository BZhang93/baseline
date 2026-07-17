import { describe, it, expect } from "vitest";
import {
  eventsOverlap,
  resolvePlayedPath,
  conflictsWith,
  eventsDateRange,
} from "./schedule-path";

const ev = (id: string, start: string, end: string) => ({
  id,
  startDate: new Date(start),
  endDate: new Date(end),
});

describe("eventsOverlap", () => {
  it("detects intersecting date ranges (inclusive)", () => {
    const a = ev("a", "2026-07-13", "2026-07-19");
    expect(eventsOverlap(a, ev("b", "2026-07-15", "2026-07-21"))).toBe(true); // partial
    expect(eventsOverlap(a, ev("c", "2026-07-13", "2026-07-19"))).toBe(true); // same week
    expect(eventsOverlap(a, ev("d", "2026-07-19", "2026-07-25"))).toBe(true); // touch on boundary
    expect(eventsOverlap(a, ev("e", "2026-07-20", "2026-07-26"))).toBe(false); // next week
  });
});

describe("resolvePlayedPath", () => {
  it("keeps a chronological non-overlapping path and flags same-week conflicts", () => {
    const events = [
      ev("wk1a", "2026-07-13", "2026-07-19"),
      ev("wk1b", "2026-07-13", "2026-07-19"), // conflicts with wk1a
      ev("wk1c", "2026-07-14", "2026-07-20"), // overlaps wk1a too
      ev("wk2", "2026-07-20", "2026-07-26"),
      ev("wk3", "2026-07-27", "2026-08-02"),
    ];
    const { path, conflicts } = resolvePlayedPath(events);
    expect(path.map((e) => e.id)).toEqual(["wk1a", "wk2", "wk3"]);
    expect(conflicts.map((e) => e.id).sort()).toEqual(["wk1b", "wk1c"]);
  });

  it("sorts by start date first (input order independent)", () => {
    const { path } = resolvePlayedPath([
      ev("late", "2026-07-27", "2026-08-02"),
      ev("early", "2026-07-13", "2026-07-19"),
    ]);
    expect(path.map((e) => e.id)).toEqual(["early", "late"]);
  });

  it("returns everything when there are no conflicts", () => {
    const { path, conflicts } = resolvePlayedPath([
      ev("a", "2026-07-13", "2026-07-19"),
      ev("b", "2026-07-20", "2026-07-26"),
    ]);
    expect(path).toHaveLength(2);
    expect(conflicts).toHaveLength(0);
  });
});

describe("conflictsWith", () => {
  it("is true only when the candidate overlaps a selected event", () => {
    const selected = [ev("a", "2026-07-13", "2026-07-19"), ev("c", "2026-07-27", "2026-08-02")];
    expect(conflictsWith(ev("x", "2026-07-15", "2026-07-21"), selected)).toBe(true);
    expect(conflictsWith(ev("y", "2026-07-20", "2026-07-26"), selected)).toBe(false);
    expect(conflictsWith(ev("z", "2026-07-13", "2026-07-19"), [])).toBe(false);
  });
});

describe("eventsDateRange", () => {
  it("spans the earliest start to the latest end (input order independent)", () => {
    const r = eventsDateRange([
      ev("b", "2026-07-27", "2026-08-02"),
      ev("a", "2026-07-13", "2026-07-19"),
    ]);
    expect(r.start).toEqual(new Date("2026-07-13"));
    expect(r.end).toEqual(new Date("2026-08-02"));
  });

  it("is null/null for no events", () => {
    expect(eventsDateRange([])).toEqual({ start: null, end: null });
  });
});
