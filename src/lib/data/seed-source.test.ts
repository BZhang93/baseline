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

  it("all events start in July 2026", async () => {
    const tournaments = await seedDataSource.tournaments();
    for (const t of tournaments) {
      expect(t.startDate.getUTCFullYear()).toBe(2026);
      expect(t.startDate.getUTCMonth()).toBe(6); // July (0-indexed)
    }
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
