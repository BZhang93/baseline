-- Per-leg transport-mode overrides (player-feedback P1-7a): a JSON map of
-- "fromTournamentId>toTournamentId" -> TransportMode. Null until a leg is overridden.
ALTER TABLE "Schedule" ADD COLUMN "legModeOverrides" JSONB;
