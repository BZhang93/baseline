-- Enable Row Level Security on all public tables.
--
-- Supabase exposes every table in `public` through its auto-generated data API
-- (authenticated by the public anon key). With RLS disabled those tables are
-- readable/writable by anyone holding that key. The app never uses the data
-- API — it reaches Postgres only through Prisma (role `postgres`, which has
-- BYPASSRLS) and uses Supabase for Auth only. So enabling RLS with NO policies
-- fully denies the anon/authenticated API roles while leaving the app working.
ALTER TABLE public."Accommodation"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Cutoff"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DiningInfo"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Player"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RankingEntry"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Schedule"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ScheduleItem"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tournament"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TournamentCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TravelLeg"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
