-- Add the derived men's/women's circuit to Tournament.
-- Existing rows are backfilled from tour (+ tier for ITF, which covers both),
-- then the column is made NOT NULL.

-- 1. Add nullable so existing rows can be backfilled.
ALTER TABLE "Tournament" ADD COLUMN "circuit" "Circuit";

-- 2. Backfill.
UPDATE "Tournament" SET "circuit" = 'MENS'   WHERE "tour" IN ('ATP', 'CHALLENGER');
UPDATE "Tournament" SET "circuit" = 'WOMENS' WHERE "tour" = 'WTA';
UPDATE "Tournament" SET "circuit" = 'WOMENS' WHERE "tour" = 'ITF' AND "tier" ILIKE 'ITF\_W%';
UPDATE "Tournament" SET "circuit" = 'MENS'   WHERE "tour" = 'ITF' AND "circuit" IS NULL;

-- 3. Enforce NOT NULL now that every row has a value.
ALTER TABLE "Tournament" ALTER COLUMN "circuit" SET NOT NULL;
