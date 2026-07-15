-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('FLIGHT', 'TRAIN', 'BUS', 'CAR', 'RIDESHARE');

-- CreateEnum
CREATE TYPE "LodgingType" AS ENUM ('HOTEL', 'RESIDENCE', 'APARTMENT', 'HOSTEL', 'HOST_HOUSING', 'BNB');

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "lodgingSpend" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "lodgingTypes" "LodgingType"[],
ADD COLUMN     "transportModes" "TransportMode"[],
ADD COLUMN     "travelSpend" INTEGER NOT NULL DEFAULT 50;
