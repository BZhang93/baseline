-- Link to the player's official ATP/WTA/ITF profile page (nullable; the
-- ranking scraper will read from it later).
ALTER TABLE "Player" ADD COLUMN "tourProfileUrl" TEXT;
