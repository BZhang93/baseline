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
// Tournaments — events starting in July 2026, across all four tours & 3 surfaces.
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
    name: "Iasi Challenger",
    tour: Tour.CHALLENGER,
    tier: "CHALLENGER_100",
    city: "Iasi",
    country: "Romania",
    countryCode: "RO",
    lat: 47.1585,
    long: 27.6014,
    surface: Surface.CLAY,
    startDate: new Date("2026-07-13"),
    endDate: new Date("2026-07-19"),
    drawSize: 48,
    entryDeadline: new Date("2026-06-22"),
    cutoff: { liveCutoffRank: 268, historicalCutoffRank: 259 },
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

const tournaments: TournamentInput[] = events.map((e) => ({ ...e, edition: SEASON }));

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
  name: "curated-seed-2026-07",
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
