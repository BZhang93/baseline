import { describe, it, expect } from "vitest";
import { directAcceptances, estimateCutoffRanks, type CalendarEvent } from "./cutoffs";
import { Tour } from "@/generated/prisma/enums";

function ev(key: string, tour: Tour, tier: string, drawSize: number, start: string): CalendarEvent {
  return { key, tour, tier, drawSize, startDate: new Date(`${start}T00:00:00Z`) };
}

describe("directAcceptances", () => {
  it("subtracts wildcards + qualifiers from the draw", () => {
    expect(directAcceptances("ATP_250", 28)).toBe(21); // 28 - 3 - 4
    expect(directAcceptances("ATP_500", 32)).toBe(25); // 32 - 3 - 4
    expect(directAcceptances("GRAND_SLAM", 128)).toBe(104); // 128 - 8 - 16
  });

  it("never goes below 1 and handles unknown tiers", () => {
    expect(directAcceptances("ATP_250", 4)).toBe(1);
    expect(directAcceptances("MYSTERY", 32)).toBe(25); // default 3 wc + 4 q
  });
});

describe("estimateCutoffRanks", () => {
  it("uses direct acceptances as the cutoff for a lone event", () => {
    const m = estimateCutoffRanks([ev("a", Tour.ATP, "ATP_500", 32, "2026-07-27")]);
    expect(m.get("a")).toBe(25);
  });

  it("stacks lower tiers below higher ones in the same week", () => {
    // A 500 (25 DA) and a 250 (21 DA) the same week: the 250's field starts
    // below the players the 500 took.
    const m = estimateCutoffRanks([
      ev("big", Tour.ATP, "ATP_500", 32, "2026-07-27"),
      ev("small", Tour.ATP, "ATP_250", 28, "2026-07-27"),
    ]);
    expect(m.get("big")).toBe(25);
    expect(m.get("small")).toBe(25 + 21);
  });

  it("pools same-tier events the same week to the same depth", () => {
    // Three concurrent ATP 250s (21 DA each) share the pool → all reach ~63.
    const m = estimateCutoffRanks([
      ev("g", Tour.ATP, "ATP_250", 28, "2026-07-13"),
      ev("u", Tour.ATP, "ATP_250", 28, "2026-07-13"),
      ev("b", Tour.ATP, "ATP_250", 28, "2026-07-13"),
    ]);
    expect(m.get("g")).toBe(63);
    expect(m.get("u")).toBe(63);
    expect(m.get("b")).toBe(63);
  });

  it("keeps men's and women's fields separate", () => {
    const m = estimateCutoffRanks([
      ev("atp", Tour.ATP, "ATP_250", 28, "2026-07-13"),
      ev("wta", Tour.WTA, "WTA_250", 32, "2026-07-13"),
    ]);
    // Neither stacks on the other → both are their own tier's direct acceptances.
    expect(m.get("atp")).toBe(21);
    expect(m.get("wta")).toBe(32 - 3 - 6);
  });

  it("floors a minor event so an incomplete calendar can't make it elite", () => {
    // A lone Challenger 125 (48 draw → 38 DA) would look like a top-38 field;
    // the floor keeps it realistic.
    const m = estimateCutoffRanks([ev("chal", Tour.CHALLENGER, "CHALLENGER_125", 48, "2026-07-06")]);
    expect(m.get("chal")).toBe(80); // floored up from 38
  });

  it("separates events in different weeks", () => {
    const m = estimateCutoffRanks([
      ev("w1", Tour.ATP, "ATP_250", 28, "2026-07-13"),
      ev("w2", Tour.ATP, "ATP_250", 28, "2026-07-20"),
    ]);
    expect(m.get("w1")).toBe(21);
    expect(m.get("w2")).toBe(21);
  });
});
