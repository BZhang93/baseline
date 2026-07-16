-- Player-entered trip costs (lodging/food/etc.) for net-of-cost earnings.
ALTER TABLE "Schedule" ADD COLUMN "tripCosts" INTEGER NOT NULL DEFAULT 0;
