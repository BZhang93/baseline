import { describe, it, expect } from "vitest";
import {
  estimateCutoff,
  estimateCutoffs,
  tierTypicalCutoff,
  changeFor,
  type EstimatorEvent,
} from "./cutoff-estimate";

const events: EstimatorEvent[] = [
  { key: "gstaad", name: "Swiss Open Gstaad", tier: "ATP_250", historicalRank: 99 },
  { key: "umag", name: "Plava Laguna Croatia Open Umag", tier: "ATP_250", historicalRank: 106 },
  { key: "kitz", name: "Generali Open Kitzbuhel", tier: "ATP_250", historicalRank: 90 },
  { key: "hamburg", name: "Hamburg Ladies Open", tier: "WTA_250", historicalRank: 88 },
  { key: "iasi", name: "UniCredit Iasi Open", tier: "WTA_250", historicalRank: 150 },
  { key: "prague", name: "Livesport Prague Open", tier: "WTA_250", historicalRank: 158 },
  { key: "athens", name: "Athens Open (WTA)", tier: "WTA_250", historicalRank: null },
  { key: "palermo", name: "Palermo Ladies Open", tier: "WTA_125", historicalRank: 141 },
  { key: "swedish", name: "Swedish Open (WTA)", tier: "WTA_125", historicalRank: 198 },
];

describe("tierTypicalCutoff", () => {
  it("is the median historical cutoff of same-tier events, excluding self", () => {
    // ATP_250 others: 106, 90 → median 98.
    expect(tierTypicalCutoff("ATP_250", events, "gstaad")).toBe(98);
  });
  it("is null when no same-tier peer has history", () => {
    expect(tierTypicalCutoff("WTA_500", events)).toBeNull();
  });
});

describe("estimateCutoff", () => {
  it("uses the event's own history when it's stable", () => {
    const e = estimateCutoff(events[0], events); // Gstaad, unchanged
    expect(e).toEqual({ rank: 99, basis: "historical", change: null });
  });

  it("uses the tier-typical cutoff for a brand-new event", () => {
    const e = estimateCutoff(events.find((x) => x.key === "athens")!, events);
    // WTA_250 peers (excl. athens): 88, 150, 158 → median 150.
    expect(e.rank).toBe(150);
    expect(e.basis).toBe("estimated");
    expect(e.change?.kind).toBe("new");
  });

  it("re-estimates a changed event toward its NEW tier, not last year's number", () => {
    // Palermo moved WTA 250 → 125; use WTA_125 typical (Swedish 198), not its 141.
    const e = estimateCutoff(events.find((x) => x.key === "palermo")!, events);
    expect(e.rank).toBe(198);
    expect(e.basis).toBe("adjusted");
    expect(e.change?.kind).toBe("changed");
  });

  it("falls back to the stored number if a changed event's new tier has no peers", () => {
    const solo: EstimatorEvent = { key: "x", name: "Mubadala Citi DC Open (ATP)", tier: "ATP_500", historicalRank: 58 };
    const e = estimateCutoff(solo, [solo]);
    expect(e.rank).toBe(58);
    expect(e.basis).toBe("adjusted");
  });
});

describe("estimateCutoffs", () => {
  it("returns an estimate keyed by every event", () => {
    const m = estimateCutoffs(events);
    expect(m.size).toBe(events.length);
    expect(m.get("gstaad")!.basis).toBe("historical");
    expect(m.get("athens")!.basis).toBe("estimated");
  });
});

describe("changeFor", () => {
  it("flags known new/changed events and nothing else", () => {
    expect(changeFor("Athens Open (WTA)")?.kind).toBe("new");
    expect(changeFor("Swiss Open Gstaad")).toBeNull();
  });
});
