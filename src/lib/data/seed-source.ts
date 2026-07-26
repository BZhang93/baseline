// Curated seed dataset (BRA-40) implementing the DataSource contract, so the UI
// can be built against realistic data before an automated feed exists. Any feed
// later implements the same contract and replaces this.
//
// ACCURACY (as of 2026-07): the tour-level EVENT CALENDAR — names, cities,
// surfaces, tiers, dates, draw sizes — is sourced from Wikipedia's 2026
// tournament pages and is intended to be correct. Category points/prize are the
// standard per-tier tables. Entry-list CUTOFFS and the full RANKINGS curve are
// still synthetic estimates — those are the dynamic, per-week data that only a
// live entry-list/rankings feed can make authoritative (see BRA-36/37).
// Challenger/ITF here are a representative sample, not the full calendar.
//
// Enums are imported by relative path (not the "@/..." alias) because this file
// is executed by the seed script via tsx, which doesn't resolve tsconfig paths.
import { Tour, Surface } from "../../generated/prisma/client";
import type {
  CategoryInput,
  DataSource,
  RankingInput,
  TournamentInput,
} from "./types";

const SEASON = 2026;

// ---------------------------------------------------------------------------
// Category ground-truth (points + prize by round). Standard-ish 2026 tables.
// ---------------------------------------------------------------------------

const categories: CategoryInput[] = [
  {
    tour: Tour.ATP,
    tier: "GRAND_SLAM",
    season: SEASON,
    pointsByRound: { W: 2000, F: 1300, SF: 780, QF: 430, R16: 240, R32: 130, R64: 70, R128: 10 },
    prizeMoneyByRound: {
      W: 3600000, F: 1800000, SF: 1000000, QF: 530000, R16: 313000, R32: 215000, R64: 140000, R128: 100000,
    },
    source: "curated",
  },
  {
    tour: Tour.WTA,
    tier: "GRAND_SLAM",
    season: SEASON,
    pointsByRound: { W: 2000, F: 1300, SF: 780, QF: 430, R16: 240, R32: 130, R64: 70, R128: 10 },
    prizeMoneyByRound: {
      W: 3600000, F: 1800000, SF: 1000000, QF: 530000, R16: 313000, R32: 215000, R64: 140000, R128: 100000,
    },
    source: "curated",
  },
  {
    tour: Tour.ATP,
    tier: "ATP_1000",
    season: SEASON,
    pointsByRound: { W: 1000, F: 600, SF: 360, QF: 180, R16: 90, R32: 45, R64: 25 },
    prizeMoneyByRound: { W: 1000000, F: 545000, SF: 300000, QF: 165000, R16: 92000, R32: 50000, R64: 28000 },
    source: "curated",
  },
  {
    tour: Tour.WTA,
    tier: "WTA_1000",
    season: SEASON,
    pointsByRound: { W: 1000, F: 650, SF: 390, QF: 215, R16: 120, R32: 65, R64: 35 },
    prizeMoneyByRound: { W: 1000000, F: 545000, SF: 300000, QF: 165000, R16: 92000, R32: 50000, R64: 28000 },
    source: "curated",
  },
  {
    tour: Tour.ATP,
    tier: "ATP_500",
    season: SEASON,
    pointsByRound: { W: 500, F: 330, SF: 200, QF: 100, R16: 50, R32: 25 },
    prizeMoneyByRound: { W: 450000, F: 240000, SF: 130000, QF: 70000, R16: 38000, R32: 21000 },
    source: "curated",
  },
  {
    tour: Tour.ATP,
    tier: "ATP_250",
    season: SEASON,
    pointsByRound: { W: 250, F: 165, SF: 100, QF: 50, R16: 25, R32: 13 },
    prizeMoneyByRound: { W: 120000, F: 65000, SF: 37000, QF: 21000, R16: 12000, R32: 7000 },
    source: "curated",
  },
  {
    tour: Tour.WTA,
    tier: "WTA_500",
    season: SEASON,
    pointsByRound: { W: 500, F: 325, SF: 195, QF: 108, R16: 60, R32: 30 },
    prizeMoneyByRound: { W: 160000, F: 92000, SF: 52000, QF: 28000, R16: 15000, R32: 9000 },
    source: "curated",
  },
  {
    tour: Tour.WTA,
    tier: "WTA_250",
    season: SEASON,
    pointsByRound: { W: 250, F: 163, SF: 98, QF: 54, R16: 30, R32: 15 },
    prizeMoneyByRound: { W: 35000, F: 21000, SF: 12500, QF: 7000, R16: 4000, R32: 2400 },
    source: "curated",
  },
  {
    tour: Tour.WTA,
    tier: "WTA_125",
    season: SEASON,
    pointsByRound: { W: 160, F: 95, SF: 57, QF: 29, R16: 16, R32: 1 },
    prizeMoneyByRound: { W: 15000, F: 9000, SF: 5300, QF: 3100, R16: 1900, R32: 1150 },
    source: "curated",
  },
  {
    tour: Tour.CHALLENGER,
    tier: "CHALLENGER_125",
    season: SEASON,
    pointsByRound: { W: 125, F: 75, SF: 45, QF: 25, R16: 10, R32: 4 },
    prizeMoneyByRound: { W: 22000, F: 13000, SF: 7600, QF: 4400, R16: 2500, R32: 1500 },
    source: "curated",
  },
  {
    tour: Tour.CHALLENGER,
    tier: "CHALLENGER_100",
    season: SEASON,
    pointsByRound: { W: 100, F: 60, SF: 36, QF: 20, R16: 8, R32: 3 },
    prizeMoneyByRound: { W: 16000, F: 9500, SF: 5600, QF: 3300, R16: 1900, R32: 1100 },
    source: "curated",
  },
  {
    tour: Tour.ITF,
    tier: "ITF_M25",
    season: SEASON,
    pointsByRound: { W: 35, F: 20, SF: 10, QF: 4, R16: 1 },
    prizeMoneyByRound: { W: 3600, F: 2100, SF: 1250, QF: 740, R16: 440 },
    source: "curated",
  },
  {
    tour: Tour.ITF,
    tier: "ITF_W25",
    season: SEASON,
    pointsByRound: { W: 35, F: 20, SF: 10, QF: 4, R16: 1 },
    prizeMoneyByRound: { W: 3600, F: 2100, SF: 1250, QF: 740, R16: 440 },
    source: "curated",
  },
];

// ---------------------------------------------------------------------------
// Tournaments — July 2026 sample (all four tours & 3 surfaces, WITH estimated
// cutoffs) plus the real rest-of-season main-tour calendar (see
// restOfSeasonEvents below).
// ---------------------------------------------------------------------------

type SeedEvent = Omit<TournamentInput, "edition"> & {
  cutoff: NonNullable<TournamentInput["cutoff"]>;
};

// Cutoffs below are ESTIMATES (a live entry-list feed will replace them); all
// other fields are sourced from the 2026 Wikipedia tournament pages.
const events: SeedEvent[] = [
  // --- Week of Jul 6 (post-Wimbledon) ------------------------------------
  {
    name: "Hall of Fame Open",
    tour: Tour.CHALLENGER, // downgraded from ATP 250 to Challenger 125 in 2026
    tier: "CHALLENGER_125",
    city: "Newport",
    country: "United States",
    countryCode: "US",
    lat: 41.4901,
    long: -71.3128,
    surface: Surface.GRASS,
    startDate: new Date("2026-07-06"),
    endDate: new Date("2026-07-12"),
    drawSize: 48,
    entryDeadline: new Date("2026-05-25"),
    cutoff: { liveCutoffRank: 210, historicalCutoffRank: 118 },
  },
  {
    name: "Swedish Open (WTA)",
    tour: Tour.WTA,
    tier: "WTA_125",
    city: "Bastad",
    country: "Sweden",
    countryCode: "SE",
    lat: 56.4256,
    long: 12.8506,
    surface: Surface.CLAY,
    startDate: new Date("2026-07-06"),
    endDate: new Date("2026-07-11"),
    drawSize: 32,
    entryDeadline: new Date("2026-05-25"),
    cutoff: { liveCutoffRank: 205, historicalCutoffRank: 198 },
  },
  {
    name: "ITF M25 Roda de Bara",
    tour: Tour.ITF,
    tier: "ITF_M25",
    city: "Roda de Bara",
    country: "Spain",
    countryCode: "ES",
    lat: 41.1725,
    long: 1.4614,
    surface: Surface.HARD,
    startDate: new Date("2026-07-06"),
    endDate: new Date("2026-07-12"),
    drawSize: 32,
    entryDeadline: new Date("2026-06-15"),
    cutoff: { liveCutoffRank: 520, historicalCutoffRank: 505 },
  },
  // --- Week of Jul 13 ----------------------------------------------------
  {
    name: "Nordea Open",
    tour: Tour.ATP,
    tier: "ATP_250",
    city: "Bastad",
    country: "Sweden",
    countryCode: "SE",
    lat: 56.4256,
    long: 12.8506,
    surface: Surface.CLAY,
    startDate: new Date("2026-07-13"),
    endDate: new Date("2026-07-19"),
    drawSize: 28,
    entryDeadline: new Date("2026-06-01"),
    cutoff: { liveCutoffRank: 108, historicalCutoffRank: 101 },
  },
  {
    name: "Swiss Open Gstaad",
    tour: Tour.ATP,
    tier: "ATP_250",
    city: "Gstaad",
    country: "Switzerland",
    countryCode: "CH",
    lat: 46.4757,
    long: 7.2861,
    surface: Surface.CLAY,
    startDate: new Date("2026-07-13"),
    endDate: new Date("2026-07-19"),
    drawSize: 28,
    entryDeadline: new Date("2026-06-01"),
    cutoff: { liveCutoffRank: 104, historicalCutoffRank: 99 },
  },
  {
    name: "Plava Laguna Croatia Open Umag",
    tour: Tour.ATP,
    tier: "ATP_250",
    city: "Umag",
    country: "Croatia",
    countryCode: "HR",
    lat: 45.4308,
    long: 13.5231,
    surface: Surface.CLAY,
    startDate: new Date("2026-07-13"),
    endDate: new Date("2026-07-18"),
    drawSize: 28,
    entryDeadline: new Date("2026-06-01"),
    cutoff: { liveCutoffRank: 110, historicalCutoffRank: 106 },
  },
  {
    name: "UniCredit Iasi Open",
    tour: Tour.WTA,
    tier: "WTA_250",
    city: "Iasi",
    country: "Romania",
    countryCode: "RO",
    lat: 47.1585,
    long: 27.6014,
    surface: Surface.CLAY,
    startDate: new Date("2026-07-13"),
    endDate: new Date("2026-07-19"),
    drawSize: 32,
    entryDeadline: new Date("2026-06-01"),
    cutoff: { liveCutoffRank: 150, historicalCutoffRank: 144 },
  },
  {
    name: "Athens Open (WTA)",
    tour: Tour.WTA,
    tier: "WTA_250",
    city: "Athens",
    country: "Greece",
    countryCode: "GR",
    lat: 37.9838,
    long: 23.7275,
    surface: Surface.HARD,
    startDate: new Date("2026-07-13"),
    endDate: new Date("2026-07-19"),
    drawSize: 32,
    entryDeadline: new Date("2026-06-01"),
    cutoff: { liveCutoffRank: 155, historicalCutoffRank: 149 },
  },
  {
    name: "ITF W25 Amstelveen",
    tour: Tour.ITF,
    tier: "ITF_W25",
    city: "Amstelveen",
    country: "Netherlands",
    countryCode: "NL",
    lat: 52.3114,
    long: 4.8701,
    surface: Surface.CLAY,
    startDate: new Date("2026-07-13"),
    endDate: new Date("2026-07-19"),
    drawSize: 32,
    entryDeadline: new Date("2026-06-22"),
    cutoff: { liveCutoffRank: 480, historicalCutoffRank: 468 },
  },
  // --- Week of Jul 20 ----------------------------------------------------
  {
    name: "Generali Open Kitzbuhel",
    tour: Tour.ATP,
    tier: "ATP_250",
    city: "Kitzbuhel",
    country: "Austria",
    countryCode: "AT",
    lat: 47.4469,
    long: 12.3924,
    surface: Surface.CLAY,
    startDate: new Date("2026-07-20"),
    endDate: new Date("2026-07-26"),
    drawSize: 28,
    entryDeadline: new Date("2026-06-08"),
    cutoff: { liveCutoffRank: 102, historicalCutoffRank: 97 },
  },
  {
    name: "Millennium Estoril Open",
    tour: Tour.ATP,
    tier: "ATP_250",
    city: "Cascais",
    country: "Portugal",
    countryCode: "PT",
    lat: 38.6979,
    long: -9.4215,
    surface: Surface.CLAY,
    startDate: new Date("2026-07-20"),
    endDate: new Date("2026-07-26"),
    drawSize: 28,
    entryDeadline: new Date("2026-06-08"),
    cutoff: { liveCutoffRank: 100, historicalCutoffRank: 95 },
  },
  {
    name: "Hamburg Ladies Open",
    tour: Tour.WTA,
    tier: "WTA_250",
    city: "Hamburg",
    country: "Germany",
    countryCode: "DE",
    lat: 53.5875,
    long: 9.9375,
    surface: Surface.CLAY,
    startDate: new Date("2026-07-20"),
    endDate: new Date("2026-07-26"),
    drawSize: 32,
    entryDeadline: new Date("2026-06-08"),
    cutoff: { liveCutoffRank: 92, historicalCutoffRank: 88 },
  },
  {
    name: "Palermo Ladies Open",
    tour: Tour.WTA,
    tier: "WTA_125", // WTA 125 in 2026 (downgraded from WTA 250)
    city: "Palermo",
    country: "Italy",
    countryCode: "IT",
    lat: 38.1157,
    long: 13.3615,
    surface: Surface.CLAY,
    startDate: new Date("2026-07-20"),
    endDate: new Date("2026-07-26"),
    drawSize: 32,
    entryDeadline: new Date("2026-06-08"),
    cutoff: { liveCutoffRank: 205, historicalCutoffRank: 141 },
  },
  {
    name: "Livesport Prague Open",
    tour: Tour.WTA,
    tier: "WTA_250",
    city: "Prague",
    country: "Czechia",
    countryCode: "CZ",
    lat: 50.0755,
    long: 14.4378,
    surface: Surface.HARD, // hard court, not clay
    startDate: new Date("2026-07-20"),
    endDate: new Date("2026-07-26"),
    drawSize: 32,
    entryDeadline: new Date("2026-06-08"),
    cutoff: { liveCutoffRank: 152, historicalCutoffRank: 158 },
  },
  {
    name: "Trieste Challenger",
    tour: Tour.CHALLENGER,
    tier: "CHALLENGER_125",
    city: "Trieste",
    country: "Italy",
    countryCode: "IT",
    lat: 45.6495,
    long: 13.7768,
    surface: Surface.CLAY,
    startDate: new Date("2026-07-20"),
    endDate: new Date("2026-07-26"),
    drawSize: 48,
    entryDeadline: new Date("2026-06-29"),
    cutoff: { liveCutoffRank: 232, historicalCutoffRank: 221 },
  },
  // --- Week of Jul 27 ----------------------------------------------------
  {
    name: "Mubadala Citi DC Open (ATP)",
    tour: Tour.ATP,
    tier: "ATP_500",
    city: "Washington",
    country: "United States",
    countryCode: "US",
    lat: 38.9072,
    long: -77.0369,
    surface: Surface.HARD,
    startDate: new Date("2026-07-27"),
    endDate: new Date("2026-08-02"),
    drawSize: 32, // reduced from 48 to 32 in 2026
    entryDeadline: new Date("2026-06-15"),
    cutoff: { liveCutoffRank: 58, historicalCutoffRank: 63 },
  },
  {
    name: "Mubadala Citi DC Open (WTA)",
    tour: Tour.WTA,
    tier: "WTA_500",
    city: "Washington",
    country: "United States",
    countryCode: "US",
    lat: 38.9072,
    long: -77.0369,
    surface: Surface.HARD,
    startDate: new Date("2026-07-27"),
    endDate: new Date("2026-08-02"),
    drawSize: 28,
    entryDeadline: new Date("2026-06-15"),
    cutoff: { liveCutoffRank: 54, historicalCutoffRank: 57 },
  },
];

// Rest-of-2026 main-tour calendar (Aug–Nov), pulled from the 2026 ATP/WTA
// Wikipedia tour pages. These carry NO cutoff — unlike the July sample above,
// their entry cutoffs are left to the estimator (historical-anchored / tier
// median), which is the honest state until a live entry-list feed lands. Names
// that exist on both tours are suffixed (ATP)/(WTA) so the (name, edition) key
// stays unique. Team/championship events (Davis & BJK Cup, Laver Cup, the
// season-ending Finals) are intentionally excluded — they aren't open-draw
// events a self-managed player enters. 125s/Challengers/ITF for this stretch
// are not the full calendar yet (that's the paid-feed step).
const restOfSeasonEvents: Omit<TournamentInput, "edition">[] = [
  // ===== WTA =====
  { name: "Canadian Open (WTA)", tour: Tour.WTA, tier: "WTA_1000", city: "Toronto", country: "Canada", countryCode: "CA", lat: 43.6532, long: -79.3832, surface: Surface.HARD, startDate: new Date("2026-08-03"), endDate: new Date("2026-08-09"), drawSize: 64 },
  { name: "Cincinnati Open (WTA)", tour: Tour.WTA, tier: "WTA_1000", city: "Mason", country: "United States", countryCode: "US", lat: 39.3601, long: -84.3099, surface: Surface.HARD, startDate: new Date("2026-08-10"), endDate: new Date("2026-08-16"), drawSize: 64 },
  { name: "Monterrey Open", tour: Tour.WTA, tier: "WTA_500", city: "Monterrey", country: "Mexico", countryCode: "MX", lat: 25.6866, long: -100.3161, surface: Surface.HARD, startDate: new Date("2026-08-24"), endDate: new Date("2026-08-30"), drawSize: 32 },
  { name: "US Open (WTA)", tour: Tour.WTA, tier: "GRAND_SLAM", city: "New York", country: "United States", countryCode: "US", lat: 40.7498, long: -73.8467, surface: Surface.HARD, startDate: new Date("2026-08-31"), endDate: new Date("2026-09-13"), drawSize: 128 },
  { name: "Guadalajara Open", tour: Tour.WTA, tier: "WTA_500", city: "Guadalajara", country: "Mexico", countryCode: "MX", lat: 20.6597, long: -103.3496, surface: Surface.HARD, startDate: new Date("2026-09-14"), endDate: new Date("2026-09-20"), drawSize: 32 },
  { name: "SP Open", tour: Tour.WTA, tier: "WTA_250", city: "São Paulo", country: "Brazil", countryCode: "BR", lat: -23.5505, long: -46.6333, surface: Surface.HARD, startDate: new Date("2026-09-14"), endDate: new Date("2026-09-20"), drawSize: 28 },
  { name: "Singapore Open", tour: Tour.WTA, tier: "WTA_500", city: "Singapore", country: "Singapore", countryCode: "SG", lat: 1.3521, long: 103.8198, surface: Surface.HARD, startDate: new Date("2026-09-21"), endDate: new Date("2026-09-27"), drawSize: 32 },
  { name: "Korea Open", tour: Tour.WTA, tier: "WTA_250", city: "Seoul", country: "South Korea", countryCode: "KR", lat: 37.5665, long: 126.978, surface: Surface.HARD, startDate: new Date("2026-09-21"), endDate: new Date("2026-09-27"), drawSize: 28 },
  { name: "China Open (WTA)", tour: Tour.WTA, tier: "WTA_1000", city: "Beijing", country: "China", countryCode: "CN", lat: 39.9042, long: 116.4074, surface: Surface.HARD, startDate: new Date("2026-09-28"), endDate: new Date("2026-10-04"), drawSize: 64 },
  { name: "Wuhan Open", tour: Tour.WTA, tier: "WTA_1000", city: "Wuhan", country: "China", countryCode: "CN", lat: 30.5928, long: 114.3055, surface: Surface.HARD, startDate: new Date("2026-10-12"), endDate: new Date("2026-10-18"), drawSize: 64 },
  { name: "Ningbo Open", tour: Tour.WTA, tier: "WTA_500", city: "Ningbo", country: "China", countryCode: "CN", lat: 29.8683, long: 121.544, surface: Surface.HARD, startDate: new Date("2026-10-19"), endDate: new Date("2026-10-25"), drawSize: 32 },
  { name: "Japan Open (WTA)", tour: Tour.WTA, tier: "WTA_250", city: "Osaka", country: "Japan", countryCode: "JP", lat: 34.6937, long: 135.5023, surface: Surface.HARD, startDate: new Date("2026-10-19"), endDate: new Date("2026-10-25"), drawSize: 28 },
  { name: "Pan Pacific Open", tour: Tour.WTA, tier: "WTA_500", city: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6762, long: 139.6503, surface: Surface.HARD, startDate: new Date("2026-10-26"), endDate: new Date("2026-11-01"), drawSize: 32 },
  { name: "Guangzhou Open", tour: Tour.WTA, tier: "WTA_250", city: "Guangzhou", country: "China", countryCode: "CN", lat: 23.1291, long: 113.2644, surface: Surface.HARD, startDate: new Date("2026-10-26"), endDate: new Date("2026-11-01"), drawSize: 28 },
  { name: "Hong Kong Open", tour: Tour.WTA, tier: "WTA_250", city: "Hong Kong", country: "China", countryCode: "HK", lat: 22.3193, long: 114.1694, surface: Surface.HARD, startDate: new Date("2026-11-02"), endDate: new Date("2026-11-08"), drawSize: 28 },
  { name: "Chennai Open", tour: Tour.WTA, tier: "WTA_250", city: "Chennai", country: "India", countryCode: "IN", lat: 13.0827, long: 80.2707, surface: Surface.HARD, startDate: new Date("2026-11-02"), endDate: new Date("2026-11-08"), drawSize: 28 },
  // ===== ATP =====
  { name: "Canadian Open (ATP)", tour: Tour.ATP, tier: "ATP_1000", city: "Montreal", country: "Canada", countryCode: "CA", lat: 45.5019, long: -73.5674, surface: Surface.HARD, startDate: new Date("2026-08-03"), endDate: new Date("2026-08-09"), drawSize: 64 },
  { name: "Cincinnati Open (ATP)", tour: Tour.ATP, tier: "ATP_1000", city: "Mason", country: "United States", countryCode: "US", lat: 39.3601, long: -84.3099, surface: Surface.HARD, startDate: new Date("2026-08-10"), endDate: new Date("2026-08-16"), drawSize: 64 },
  { name: "Winston-Salem Open", tour: Tour.ATP, tier: "ATP_250", city: "Winston-Salem", country: "United States", countryCode: "US", lat: 36.0999, long: -80.2442, surface: Surface.HARD, startDate: new Date("2026-08-24"), endDate: new Date("2026-08-30"), drawSize: 28 },
  { name: "US Open (ATP)", tour: Tour.ATP, tier: "GRAND_SLAM", city: "New York", country: "United States", countryCode: "US", lat: 40.7498, long: -73.8467, surface: Surface.HARD, startDate: new Date("2026-08-31"), endDate: new Date("2026-09-13"), drawSize: 128 },
  { name: "Chengdu Open", tour: Tour.ATP, tier: "ATP_250", city: "Chengdu", country: "China", countryCode: "CN", lat: 30.5728, long: 104.0668, surface: Surface.HARD, startDate: new Date("2026-09-21"), endDate: new Date("2026-09-27"), drawSize: 28 },
  { name: "Hangzhou Open", tour: Tour.ATP, tier: "ATP_250", city: "Hangzhou", country: "China", countryCode: "CN", lat: 30.2741, long: 120.1551, surface: Surface.HARD, startDate: new Date("2026-09-21"), endDate: new Date("2026-09-27"), drawSize: 28 },
  { name: "China Open (ATP)", tour: Tour.ATP, tier: "ATP_500", city: "Beijing", country: "China", countryCode: "CN", lat: 39.9042, long: 116.4074, surface: Surface.HARD, startDate: new Date("2026-09-28"), endDate: new Date("2026-10-04"), drawSize: 32 },
  { name: "Japan Open (ATP)", tour: Tour.ATP, tier: "ATP_500", city: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6762, long: 139.6503, surface: Surface.HARD, startDate: new Date("2026-09-28"), endDate: new Date("2026-10-04"), drawSize: 32 },
  { name: "Shanghai Masters", tour: Tour.ATP, tier: "ATP_1000", city: "Shanghai", country: "China", countryCode: "CN", lat: 31.2304, long: 121.4737, surface: Surface.HARD, startDate: new Date("2026-10-05"), endDate: new Date("2026-10-11"), drawSize: 64 },
  { name: "Almaty Open", tour: Tour.ATP, tier: "ATP_250", city: "Almaty", country: "Kazakhstan", countryCode: "KZ", lat: 43.222, long: 76.8512, surface: Surface.HARD, startDate: new Date("2026-10-19"), endDate: new Date("2026-10-25"), drawSize: 28 },
  { name: "Grand Prix Auvergne-Rhône-Alpes", tour: Tour.ATP, tier: "ATP_250", city: "Lyon", country: "France", countryCode: "FR", lat: 45.764, long: 4.8357, surface: Surface.HARD, startDate: new Date("2026-10-19"), endDate: new Date("2026-10-25"), drawSize: 28 },
  { name: "European Open", tour: Tour.ATP, tier: "ATP_250", city: "Brussels", country: "Belgium", countryCode: "BE", lat: 50.8503, long: 4.3517, surface: Surface.HARD, startDate: new Date("2026-10-19"), endDate: new Date("2026-10-25"), drawSize: 28 },
  { name: "Swiss Indoors", tour: Tour.ATP, tier: "ATP_500", city: "Basel", country: "Switzerland", countryCode: "CH", lat: 47.5596, long: 7.5886, surface: Surface.HARD, startDate: new Date("2026-10-26"), endDate: new Date("2026-11-01"), drawSize: 32 },
  { name: "Vienna Open", tour: Tour.ATP, tier: "ATP_500", city: "Vienna", country: "Austria", countryCode: "AT", lat: 48.2082, long: 16.3738, surface: Surface.HARD, startDate: new Date("2026-10-26"), endDate: new Date("2026-11-01"), drawSize: 32 },
  { name: "Paris Masters", tour: Tour.ATP, tier: "ATP_1000", city: "Nanterre", country: "France", countryCode: "FR", lat: 48.8924, long: 2.2069, surface: Surface.HARD, startDate: new Date("2026-11-02"), endDate: new Date("2026-11-08"), drawSize: 64 },
  { name: "Stockholm Open", tour: Tour.ATP, tier: "ATP_250", city: "Stockholm", country: "Sweden", countryCode: "SE", lat: 59.3293, long: 18.0686, surface: Surface.HARD, startDate: new Date("2026-11-09"), endDate: new Date("2026-11-15"), drawSize: 28 },
];

// Real WTA 125 (Challenger-level) calendar, Aug–Nov 2026, from the 2026 WTA 125
// tournaments Wikipedia page. These are the bread-and-butter events for a
// ranked-~180 player like the demo persona, and they span many regions —
// useful for exercising region/budget-reachability planning. WTA_125 category
// already exists; no cutoff (estimator fills in). Draw 32.
const wta125Events: Omit<TournamentInput, "edition">[] = [
  { name: "T-Mobile Polish Open", tour: Tour.WTA, tier: "WTA_125", city: "Warsaw", country: "Poland", countryCode: "PL", lat: 52.2297, long: 21.0122, surface: Surface.HARD, startDate: new Date("2026-08-03"), endDate: new Date("2026-08-09"), drawSize: 32 },
  { name: "Ennoble Care Philly Open", tour: Tour.WTA, tier: "WTA_125", city: "Philadelphia", country: "United States", countryCode: "US", lat: 39.9526, long: -75.1652, surface: Surface.HARD, startDate: new Date("2026-08-24"), endDate: new Date("2026-08-30"), drawSize: 32 },
  { name: "Montreux Nestlé Open", tour: Tour.WTA, tier: "WTA_125", city: "Montreux", country: "Switzerland", countryCode: "CH", lat: 46.4312, long: 6.9107, surface: Surface.CLAY, startDate: new Date("2026-09-07"), endDate: new Date("2026-09-13"), drawSize: 32 },
  { name: "ATIK Antalya Open", tour: Tour.WTA, tier: "WTA_125", city: "Antalya", country: "Turkey", countryCode: "TR", lat: 36.8969, long: 30.7133, surface: Surface.CLAY, startDate: new Date("2026-09-07"), endDate: new Date("2026-09-13"), drawSize: 32 },
  { name: "Kia Open", tour: Tour.WTA, tier: "WTA_125", city: "Barranquilla", country: "Colombia", countryCode: "CO", lat: 10.9685, long: -74.7813, surface: Surface.HARD, startDate: new Date("2026-09-07"), endDate: new Date("2026-09-13"), drawSize: 32 },
  { name: "BBVA Open Internacional de Valencia", tour: Tour.WTA, tier: "WTA_125", city: "Valencia", country: "Spain", countryCode: "ES", lat: 39.4699, long: -0.3763, surface: Surface.CLAY, startDate: new Date("2026-09-14"), endDate: new Date("2026-09-20"), drawSize: 32 },
  { name: "Zavarovalnica Triglav Ljubljana", tour: Tour.WTA, tier: "WTA_125", city: "Ljubljana", country: "Slovenia", countryCode: "SI", lat: 46.0569, long: 14.5058, surface: Surface.CLAY, startDate: new Date("2026-09-14"), endDate: new Date("2026-09-20"), drawSize: 32 },
  { name: "Caldas da Rainha Ladies Open", tour: Tour.WTA, tier: "WTA_125", city: "Caldas da Rainha", country: "Portugal", countryCode: "PT", lat: 39.4033, long: -9.1359, surface: Surface.HARD, startDate: new Date("2026-09-14"), endDate: new Date("2026-09-20"), drawSize: 32 },
  { name: "Delta Motors Tolentino Open", tour: Tour.WTA, tier: "WTA_125", city: "Tolentino", country: "Italy", countryCode: "IT", lat: 43.2091, long: 13.2846, surface: Surface.CLAY, startDate: new Date("2026-09-21"), endDate: new Date("2026-09-27"), drawSize: 32 },
  { name: "Eupago Porto Open", tour: Tour.WTA, tier: "WTA_125", city: "Porto", country: "Portugal", countryCode: "PT", lat: 41.1579, long: -8.6291, surface: Surface.HARD, startDate: new Date("2026-09-21"), endDate: new Date("2026-09-27"), drawSize: 32 },
  { name: "Ankara Open", tour: Tour.WTA, tier: "WTA_125", city: "Ankara", country: "Turkey", countryCode: "TR", lat: 39.9334, long: 32.8597, surface: Surface.HARD, startDate: new Date("2026-09-21"), endDate: new Date("2026-09-27"), drawSize: 32 },
  { name: "Jingshan Tennis Open", tour: Tour.WTA, tier: "WTA_125", city: "Jingshan", country: "China", countryCode: "CN", lat: 31.0173, long: 113.1112, surface: Surface.HARD, startDate: new Date("2026-09-28"), endDate: new Date("2026-10-04"), drawSize: 32 },
  { name: "Adana Open", tour: Tour.WTA, tier: "WTA_125", city: "Adana", country: "Turkey", countryCode: "TR", lat: 37.0, long: 35.3213, surface: Surface.HARD, startDate: new Date("2026-09-28"), endDate: new Date("2026-10-04"), drawSize: 32 },
  { name: "Suzhou Open", tour: Tour.WTA, tier: "WTA_125", city: "Suzhou", country: "China", countryCode: "CN", lat: 31.2989, long: 120.5853, surface: Surface.HARD, startDate: new Date("2026-10-05"), endDate: new Date("2026-10-11"), drawSize: 32 },
  { name: "Samsun Open", tour: Tour.WTA, tier: "WTA_125", city: "Samsun", country: "Turkey", countryCode: "TR", lat: 41.2867, long: 36.33, surface: Surface.HARD, startDate: new Date("2026-10-05"), endDate: new Date("2026-10-11"), drawSize: 32 },
  { name: "Vanda Pharmaceuticals Mallorca Women's Championships", tour: Tour.WTA, tier: "WTA_125", city: "Mallorca", country: "Spain", countryCode: "ES", lat: 39.5696, long: 2.6502, surface: Surface.CLAY, startDate: new Date("2026-10-12"), endDate: new Date("2026-10-18"), drawSize: 32 },
  { name: "Lisboa Belém Open", tour: Tour.WTA, tier: "WTA_125", city: "Lisbon", country: "Portugal", countryCode: "PT", lat: 38.7223, long: -9.1393, surface: Surface.CLAY, startDate: new Date("2026-10-12"), endDate: new Date("2026-10-18"), drawSize: 32 },
  { name: "RoveretOpen Città della Pace", tour: Tour.WTA, tier: "WTA_125", city: "Rovereto", country: "Italy", countryCode: "IT", lat: 45.8906, long: 11.0399, surface: Surface.HARD, startDate: new Date("2026-10-12"), endDate: new Date("2026-10-18"), drawSize: 32 },
  { name: "Rio Ladies Open", tour: Tour.WTA, tier: "WTA_125", city: "Rio de Janeiro", country: "Brazil", countryCode: "BR", lat: -22.9068, long: -43.1729, surface: Surface.CLAY, startDate: new Date("2026-10-19"), endDate: new Date("2026-10-25"), drawSize: 32 },
  { name: "Valle d'Aosta Ladies Open", tour: Tour.WTA, tier: "WTA_125", city: "Courmayeur", country: "Italy", countryCode: "IT", lat: 45.7911, long: 6.9694, surface: Surface.HARD, startDate: new Date("2026-10-26"), endDate: new Date("2026-11-01"), drawSize: 32 },
  { name: "Querétaro Open", tour: Tour.WTA, tier: "WTA_125", city: "Querétaro", country: "Mexico", countryCode: "MX", lat: 20.5888, long: -100.3899, surface: Surface.CLAY, startDate: new Date("2026-10-26"), endDate: new Date("2026-11-01"), drawSize: 32 },
  { name: "Abierto de Curitiba", tour: Tour.WTA, tier: "WTA_125", city: "Curitiba", country: "Brazil", countryCode: "BR", lat: -25.4284, long: -49.2733, surface: Surface.CLAY, startDate: new Date("2026-10-26"), endDate: new Date("2026-11-01"), drawSize: 32 },
  { name: "Angola Ladies Open", tour: Tour.WTA, tier: "WTA_125", city: "Luanda", country: "Angola", countryCode: "AO", lat: -8.839, long: 13.2894, surface: Surface.HARD, startDate: new Date("2026-11-02"), endDate: new Date("2026-11-08"), drawSize: 32 },
  { name: "ATC Open", tour: Tour.WTA, tier: "WTA_125", city: "Miami", country: "United States", countryCode: "US", lat: 25.7617, long: -80.1918, surface: Surface.HARD, startDate: new Date("2026-11-02"), endDate: new Date("2026-11-08"), drawSize: 32 },
  { name: "Cali Open", tour: Tour.WTA, tier: "WTA_125", city: "Cali", country: "Colombia", countryCode: "CO", lat: 3.4516, long: -76.532, surface: Surface.CLAY, startDate: new Date("2026-11-02"), endDate: new Date("2026-11-08"), drawSize: 32 },
];

const tournaments: TournamentInput[] = [...events, ...restOfSeasonEvents, ...wta125Events].map(
  (e) => ({ ...e, edition: SEASON }),
);

// ---------------------------------------------------------------------------
// Rankings — a synthetic but plausible decreasing points curve (ranks 1..300)
// for ATP and WTA, so cutoff/gap math has data at any rank in range.
// ---------------------------------------------------------------------------

const AS_OF = new Date("2026-06-29");

const ATP_TOP = [
  "Jannik Sinner",
  "Carlos Alcaraz",
  "Alexander Zverev",
  "Novak Djokovic",
  "Daniil Medvedev",
];
const WTA_TOP = [
  "Aryna Sabalenka",
  "Iga Swiatek",
  "Coco Gauff",
  "Elena Rybakina",
  "Jessica Pegula",
];

function pointsForRank(rank: number): number {
  // ~11000 at #1 down to ~350 at #300, monotonically decreasing.
  return Math.round(11000 * Math.pow(rank, -0.62));
}

function rankingList(tour: Tour, topNames: string[], count = 300): RankingInput[] {
  const list: RankingInput[] = [];
  for (let rank = 1; rank <= count; rank++) {
    const playerName =
      rank <= topNames.length ? topNames[rank - 1] : `${tour} Player #${rank}`;
    list.push({ tour, playerName, rank, points: pointsForRank(rank), asOfDate: AS_OF });
  }
  return list;
}

const rankings: RankingInput[] = [
  ...rankingList(Tour.ATP, ATP_TOP),
  ...rankingList(Tour.WTA, WTA_TOP),
];

export const seedDataSource: DataSource = {
  name: "curated-seed-2026",
  async categories() {
    return categories;
  },
  async tournaments() {
    return tournaments;
  },
  async rankings() {
    return rankings;
  },
};

// Exposed for the seed script (demo player uses a real ranking from this curve).
export { pointsForRank, AS_OF, SEASON };
