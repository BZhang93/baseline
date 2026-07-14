-- CreateEnum
CREATE TYPE "Circuit" AS ENUM ('MENS', 'WOMENS');

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "circuit" "Circuit",
ADD COLUMN     "tours" "Tour"[];
