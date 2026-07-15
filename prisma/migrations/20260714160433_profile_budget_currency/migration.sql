/*
  Warnings:

  - You are about to drop the column `budgetTier` on the `Player` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Player" DROP COLUMN "budgetTier",
ADD COLUMN     "budget" INTEGER,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

-- DropEnum
DROP TYPE "BudgetTier";
