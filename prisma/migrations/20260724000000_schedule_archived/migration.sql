-- Archive vs. delete for schedules (BRA-100). Null = active; a timestamp marks
-- when the player archived the plan so it's kept out of the way but not lost.
ALTER TABLE "Schedule" ADD COLUMN "archivedAt" TIMESTAMP(3);
