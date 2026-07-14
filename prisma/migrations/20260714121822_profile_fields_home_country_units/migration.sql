-- CreateEnum
CREATE TYPE "UnitSystem" AS ENUM ('METRIC', 'IMPERIAL');

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "homeBaseCountry" TEXT,
ADD COLUMN     "unitSystem" "UnitSystem" NOT NULL DEFAULT 'METRIC';
