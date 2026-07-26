import { describe, it, expect } from "vitest";
import { seedDataSource, pointsForRank } from "./seed-source";
import { Tour } from "@/generated/prisma/client";

describe("seedDataSource", () => {
  it("covers all four tours and at least two surfaces", async () => {
    const tournaments = await seedDataSource.tournaments();
    const tours = new Set(tournaments.map((t) => t.tour));
    const surfaces = new Set(tournaments.map((t) => t.surface));

    expect(tours).toEqual(new Set([Tour.ATP, Tour.WTA, Tour.ITF, Tour.CHALLENGER]));
    expect(surfaces.size).toBeGreaterThanOrEqual(2);
    expect(tournaments.length).toBeGreaterThanOrEqual(10);
  });

  it("every tournament tier has a matching category (no orphans)", async () => {
    const [categories, tournaments] = await Promise.all([
      seedDataSource.categories(),
      seedDataSource.tournaments(),
    ]);
    const catKeys = new Set(categories.map((c) => `${c.tour}:${c.tier}:${c.season}`));

    for (const t of tournaments) {
      expect(catKeys.has(`${t.tour}:${t.tier}:${t.edition}`)).toBe(true);
    }
  });

  it("all events start within the covered 2026 window (Jul–Nov)", async () => {
    const tournaments = await seedDataSource.tournaments();
    const months = new Set<number>();
    for (const t of tournaments) {
      expect(t.startDate.getUTCFullYear()).toBe(2026);
      const m = t.startDate.getUTCMonth(); // 0-indexed
      expect(m).toBeGreaterThanOrEqual(6); // July
      expect(m).toBeLessThanOrEqual(10); // November
      months.add(m);
    }
    // The real rest-of-season calendar extends past July.
    expect([...months].some((m) => m > 6)).toBe(true);
  });

  it("includes the top-tier events (Grand Slam / 1000) mapped to categories", async () => {
    const [categories, tournaments] = await Promise.all([
      seedDataSource.categories(),
      seedDataSource.tournaments(),
    ]);
    const tiers = new Set(tournaments.map((t) => t.tier));
    expect(tiers.has("GRAND_SLAM")).toBe(true);
    expect(tiers.has("ATP_1000")).toBe(true);
    expect(tiers.has("WTA_1000")).toBe(true);
    // Their categories exist (no orphans is covered above; assert points depth).
    const slam = categories.find((c) => c.tier === "GRAND_SLAM");
    expect(slam?.pointsByRound.W).toBe(2000);
  });

  it("produces a monotonically decreasing ranking points curve", async () => {
    expect(pointsForRank(1)).toBeGreaterThan(pointsForRank(10));
    expect(pointsForRank(10)).toBeGreaterThan(pointsForRank(100));
    expect(pointsForRank(100)).toBeGreaterThan(pointsForRank(300));

    const rankings = await seedDataSource.rankings();
    const atp = rankings.filter((r) => r.tour === Tour.ATP).sort((a, b) => a.rank - b.rank);
    expect(atp[0].rank).toBe(1);
    for (let i = 1; i < atp.length; i++) {
      expect(atp[i].points).toBeLessThanOrEqual(atp[i - 1].points);
    }
  });
});
