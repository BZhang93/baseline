import type { Tour, Surface } from "@/generated/prisma/client";

// The contract for anything that supplies domain data to be loaded into the
// database. The curated seed (BRA-40) and, later, the Python scraper's output
// (BRA-36/37) both implement `DataSource`, so either can populate the same
// tables through the same loader (see ./load.ts). This is what keeps the app
// unchanged when we swap seed data for live data.

/// Round key -> value, e.g. { "W": 2000, "F": 1300, "SF": 800 }.
export type RoundValues = Record<string, number>;

export interface CategoryInput {
  tour: Tour;
  /// e.g. "GRAND_SLAM", "ATP_250", "CHALLENGER_125", "ITF_M25".
  tier: string;
  season: number;
  pointsByRound: RoundValues;
  prizeMoneyByRound: RoundValues;
  currency?: string;
  source?: string;
}

export interface CutoffInput {
  liveCutoffRank?: number;
  liveCutoffPoints?: number;
  historicalCutoffRank?: number;
  historicalCutoffPoints?: number;
  source?: string;
  asOfDate?: Date;
}

export interface TournamentInput {
  name: string;
  tour: Tour;
  /// Matches a CategoryInput.tier (with season = this event's edition).
  tier: string;
  edition: number;
  city: string;
  country: string;
  countryCode?: string;
  lat?: number;
  long?: number;
  surface: Surface;
  startDate: Date;
  endDate: Date;
  drawSize: number;
  entryDeadline?: Date;
  cutoff?: CutoffInput;
}

export interface RankingInput {
  tour: Tour;
  playerName: string;
  rank: number;
  points: number;
  asOfDate: Date;
}

export interface DataSource {
  readonly name: string;
  categories(): Promise<CategoryInput[]>;
  tournaments(): Promise<TournamentInput[]>;
  rankings(): Promise<RankingInput[]>;
}
