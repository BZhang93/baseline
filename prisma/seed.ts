// Seed script (BRA-40). Loads the curated DataSource into the database and adds
// a demo player + sample schedule so the UI has data to render.
//
// Run with: pnpm db:seed
//
// Uses DIRECT_URL (session connection) rather than the pooled URL — the seed
// issues many statements and prepared statements aren't supported through the
// transaction pooler.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Surface, Tour, TravelMode } from "../src/generated/prisma/client";
import { promoteIfValid, formatValidationReport } from "../src/lib/data/ingest";
import { seedDataSource, AS_OF, SEASON } from "../src/lib/data/seed-source";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DEMO_USER_ID = "seed:maya-demo";
const DEMO_SCHEDULE_ID = "seed-schedule-clay-swing";

async function main() {
  // 1. Load reference/tour data through the validate→promote gate — the same
  // checkpoint the scraper will use. Bad data aborts before touching live tables.
  const ingest = await promoteIfValid(prisma, seedDataSource, {
    expectedSeason: SEASON,
    expectedMonths: [7], // v1 scope: July 2026
  });
  console.log(formatValidationReport(ingest.report));
  if (!ingest.promoted) {
    throw new Error("Seed validation failed — live data left unchanged.");
  }
  const result = ingest.result!;
  console.log(
    `Loaded: ${result.categories} categories, ${result.tournaments} tournaments, ` +
      `${result.cutoffs} cutoffs, ${result.rankings} rankings.`,
  );

  // 2. Demo player — matches the PRD persona (Maya, WTA #180, self-managed).
  const player = await prisma.player.upsert({
    where: { userId: DEMO_USER_ID },
    update: {},
    create: {
      userId: DEMO_USER_ID,
      name: "Maya Ilić",
      ranking: 180,
      rankingTour: Tour.WTA,
      nationality: ["HR"],
      homeBaseCity: "Zagreb",
      homeBaseLat: 45.815,
      homeBaseLong: 15.9819,
      surfacePrefs: [Surface.CLAY, Surface.HARD],
      budget: 6000,
      currency: "EUR",
      dietaryPrefs: ["gluten-free"],
      maxDistanceToVenueKm: 15,
      lodgingAmenities: ["kitchen", "laundry"],
    },
  });

  // 3. Sample schedule ("European clay swing") with two WTA clay events.
  const clayEvents = await prisma.tournament.findMany({
    where: {
      edition: SEASON,
      name: { in: ["Palermo Ladies Open", "Livesport Prague Open"] },
    },
    orderBy: { startDate: "asc" },
  });

  await prisma.schedule.upsert({
    where: { id: DEMO_SCHEDULE_ID },
    update: { updatedAt: new Date() },
    create: {
      id: DEMO_SCHEDULE_ID,
      playerId: player.id,
      name: "European clay swing",
      startDate: new Date("2026-07-13"),
      endDate: new Date("2026-07-26"),
      budgetCap: 6000,
      maxEvents: 2,
      minRestDays: 1,
      weightPoints: 1,
      weightMoney: 1,
      weightTravelTime: 1.5,
      weightTravelCost: 1.5,
    },
  });

  // Idempotent items + travel legs for the demo schedule.
  for (let i = 0; i < clayEvents.length; i++) {
    const t = clayEvents[i];
    await prisma.scheduleItem.upsert({
      where: { scheduleId_tournamentId: { scheduleId: DEMO_SCHEDULE_ID, tournamentId: t.id } },
      update: { order: i },
      create: { scheduleId: DEMO_SCHEDULE_ID, tournamentId: t.id, order: i },
    });
  }

  await prisma.travelLeg.deleteMany({ where: { scheduleId: DEMO_SCHEDULE_ID } });
  if (clayEvents.length === 2) {
    await prisma.travelLeg.create({
      data: {
        scheduleId: DEMO_SCHEDULE_ID,
        order: 0,
        fromLabel: "Palermo, Italy",
        toLabel: "Prague, Czechia",
        mode: TravelMode.FLIGHT,
        durationMinutes: 150,
        costEstimate: 240,
        date: new Date("2026-07-19"),
      },
    });
  }

  console.log(
    `Demo player ${player.name} (${DEMO_USER_ID}) + schedule "European clay swing" ` +
      `with ${clayEvents.length} events ready. Rankings as of ${AS_OF.toISOString().slice(0, 10)}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
