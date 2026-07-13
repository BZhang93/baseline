-- CreateEnum
CREATE TYPE "Tour" AS ENUM ('ATP', 'WTA', 'ITF', 'CHALLENGER');

-- CreateEnum
CREATE TYPE "Surface" AS ENUM ('HARD', 'CLAY', 'GRASS', 'CARPET');

-- CreateEnum
CREATE TYPE "BudgetTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TravelMode" AS ENUM ('FLIGHT', 'GROUND');

-- CreateTable
CREATE TABLE "TournamentCategory" (
    "id" TEXT NOT NULL,
    "tour" "Tour" NOT NULL,
    "tier" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "pointsByRound" JSONB NOT NULL,
    "prizeMoneyByRound" JSONB NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tour" "Tour" NOT NULL,
    "tier" TEXT NOT NULL,
    "edition" INTEGER NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "countryCode" TEXT,
    "lat" DOUBLE PRECISION,
    "long" DOUBLE PRECISION,
    "surface" "Surface" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "drawSize" INTEGER NOT NULL,
    "entryDeadline" TIMESTAMP(3),
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingEntry" (
    "id" TEXT NOT NULL,
    "tour" "Tour" NOT NULL,
    "playerName" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cutoff" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "liveCutoffRank" INTEGER,
    "liveCutoffPoints" INTEGER,
    "historicalCutoffRank" INTEGER,
    "historicalCutoffPoints" INTEGER,
    "source" TEXT,
    "asOfDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cutoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "ranking" INTEGER,
    "rankingTour" "Tour",
    "nationality" TEXT[],
    "homeBaseCity" TEXT,
    "homeBaseLat" DOUBLE PRECISION,
    "homeBaseLong" DOUBLE PRECISION,
    "surfacePrefs" "Surface"[],
    "budgetTier" "BudgetTier",
    "dietaryPrefs" TEXT[],
    "maxDistanceToVenueKm" INTEGER,
    "lodgingAmenities" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budgetCap" INTEGER,
    "maxEvents" INTEGER,
    "minRestDays" INTEGER,
    "weightPoints" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "weightMoney" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "weightTravelTime" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "weightTravelCost" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "scorePoints" INTEGER,
    "scorePrizeMoney" INTEGER,
    "scoreTravelTimeMin" INTEGER,
    "scoreTravelCost" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleItem" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelLeg" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "fromLabel" TEXT NOT NULL,
    "toLabel" TEXT NOT NULL,
    "fromLat" DOUBLE PRECISION,
    "fromLong" DOUBLE PRECISION,
    "toLat" DOUBLE PRECISION,
    "toLong" DOUBLE PRECISION,
    "mode" "TravelMode",
    "durationMinutes" INTEGER,
    "costEstimate" INTEGER,
    "date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accommodation" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "distanceToVenueKm" DOUBLE PRECISION,
    "pricePerNight" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amenities" TEXT[],
    "bookingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Accommodation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiningInfo" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "deliveryAvailable" BOOLEAN,
    "nearbyChains" TEXT[],
    "dietaryTags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiningInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentCategory_tour_tier_season_key" ON "TournamentCategory"("tour", "tier", "season");

-- CreateIndex
CREATE INDEX "Tournament_startDate_idx" ON "Tournament"("startDate");

-- CreateIndex
CREATE INDEX "Tournament_tour_startDate_idx" ON "Tournament"("tour", "startDate");

-- CreateIndex
CREATE INDEX "Tournament_surface_idx" ON "Tournament"("surface");

-- CreateIndex
CREATE INDEX "Tournament_country_idx" ON "Tournament"("country");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_name_edition_key" ON "Tournament"("name", "edition");

-- CreateIndex
CREATE INDEX "RankingEntry_tour_asOfDate_idx" ON "RankingEntry"("tour", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "RankingEntry_tour_rank_asOfDate_key" ON "RankingEntry"("tour", "rank", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "Cutoff_tournamentId_key" ON "Cutoff"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_userId_key" ON "Player"("userId");

-- CreateIndex
CREATE INDEX "Schedule_playerId_idx" ON "Schedule"("playerId");

-- CreateIndex
CREATE INDEX "ScheduleItem_scheduleId_order_idx" ON "ScheduleItem"("scheduleId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleItem_scheduleId_tournamentId_key" ON "ScheduleItem"("scheduleId", "tournamentId");

-- CreateIndex
CREATE INDEX "TravelLeg_scheduleId_order_idx" ON "TravelLeg"("scheduleId", "order");

-- CreateIndex
CREATE INDEX "Accommodation_tournamentId_idx" ON "Accommodation"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "DiningInfo_tournamentId_key" ON "DiningInfo"("tournamentId");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TournamentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cutoff" ADD CONSTRAINT "Cutoff_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelLeg" ADD CONSTRAINT "TravelLeg_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningInfo" ADD CONSTRAINT "DiningInfo_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
