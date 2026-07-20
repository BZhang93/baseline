-- Qualifying sign-in date (player-feedback P1-6): Challenger/ITF quali is the
-- weekend before the main draw. Null until the scraper populates it.
ALTER TABLE "Tournament" ADD COLUMN "qualiStartDate" TIMESTAMP(3);
