import { describe, it, expect, vi } from "vitest";
import { loadIntoDatabase } from "./load";
import type { DataSource } from "./types";
import type { PrismaClient } from "@/generated/prisma/client";
import { Tour, Surface } from "@/generated/prisma/client";

const source: DataSource = {
  name: "test",
  async categories() {
    return [
      {
        tour: Tour.ATP,
        tier: "ATP_250",
        season: 2026,
        pointsByRound: { W: 250, F: 150 },
        prizeMoneyByRound: { W: 100000, F: 50000 },
      },
    ];
  },
  async tournaments() {
    return [
      {
        name: "Test Open",
        tour: Tour.ATP,
        tier: "ATP_250",
        edition: 2026,
        city: "Testville",
        country: "Testland",
        surface: Surface.HARD,
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-07"),
        drawSize: 28,
        cutoff: { liveCutoffRank: 105, historicalCutoffRank: 98 },
      },
    ];
  },
  async rankings() {
    return [
      { tour: Tour.ATP, playerName: "A. Player", rank: 1, points: 9000, asOfDate: new Date("2026-06-29") },
    ];
  },
};

function fakePrisma() {
  const categoryUpsert = vi.fn();
  const tournamentUpsert = vi.fn().mockResolvedValue({ id: "t1" });
  const cutoffUpsert = vi.fn();
  const rankingUpsert = vi.fn();
  const findMany = vi
    .fn()
    .mockResolvedValue([{ id: "cat1", tour: "ATP", tier: "ATP_250", season: 2026 }]);

  const prisma = {
    tournamentCategory: { upsert: categoryUpsert, findMany },
    tournament: { upsert: tournamentUpsert },
    cutoff: { upsert: cutoffUpsert },
    rankingEntry: { upsert: rankingUpsert },
  } as unknown as PrismaClient;

  return { prisma, categoryUpsert, tournamentUpsert, cutoffUpsert, rankingUpsert };
}

describe("loadIntoDatabase", () => {
  it("upserts categories, tournaments, cutoffs, and rankings", async () => {
    const { prisma, categoryUpsert, tournamentUpsert, cutoffUpsert, rankingUpsert } =
      fakePrisma();

    const result = await loadIntoDatabase(prisma, source);

    expect(result).toEqual({ categories: 1, tournaments: 1, cutoffs: 1, rankings: 1 });
    expect(categoryUpsert).toHaveBeenCalledOnce();
    expect(tournamentUpsert).toHaveBeenCalledOnce();
    expect(cutoffUpsert).toHaveBeenCalledOnce();
    expect(rankingUpsert).toHaveBeenCalledOnce();
  });

  it("links a tournament to its category by (tour, tier, edition)", async () => {
    const { prisma, tournamentUpsert } = fakePrisma();

    await loadIntoDatabase(prisma, source);

    const createArg = tournamentUpsert.mock.calls[0][0].create;
    expect(createArg.categoryId).toBe("cat1");
  });

  it("uses upsert (idempotent) rather than create for tournaments", async () => {
    const { prisma, tournamentUpsert } = fakePrisma();

    await loadIntoDatabase(prisma, source);

    const arg = tournamentUpsert.mock.calls[0][0];
    expect(arg.where).toEqual({ name_edition: { name: "Test Open", edition: 2026 } });
  });

  it("warns and leaves categoryId null when no category matches", async () => {
    const { prisma, tournamentUpsert } = fakePrisma();
    // Source whose tournament tier has no matching category.
    const orphan: DataSource = {
      ...source,
      async tournaments() {
        const [t] = await source.tournaments();
        return [{ ...t, tier: "ATP_500" }]; // no ATP_500 category seeded
      },
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await loadIntoDatabase(prisma, orphan);

    expect(tournamentUpsert.mock.calls[0][0].create.categoryId).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
