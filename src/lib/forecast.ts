// Event-level win-probability forecast (BRA-148). The decision is "enter THIS
// event or not", so the output is a per-event object: the full advancement curve
// plus expected value, given the player is in the draw. Match-level win prob is
// an internal building block.
//
// This is the placeholder provider: it reuses the optimizer's rank-vs-field
// `matchWinProbability` and a geometric rollup (every round is an independent
// coin at `winProb`). The swap seam for real data is unchanged: replace the
// win-prob source with a ratings model (from match results) and, later, accept a
// draw to make per-round opponents real. `basis` records which is in play.
//
// Acceptance (can the player get IN — BRA-67) is a SEPARATE dimension; the
// "worth entering" number is P(accepted) × this forecast's expected value.

import {
  matchWinProbability,
  expectedRoundValue,
  expectedResultLabel,
  ROUND_ORDER,
} from "./optimizer";
import { roundValue } from "./round-values";

export type Round = (typeof ROUND_ORDER)[number];

export interface EventForecast {
  winProb: number; // per-match, vs the field
  reachProb: Partial<Record<Round, number>>; // P(reach each present round)
  expectedResult: string | null; // most likely finishing round
  expectedPoints: number; // if the player is in the draw
  expectedPrize: number;
  titleProb: number; // P(win the title)
  deepRunProb: number; // P(reach SF or better)
  basis: "rank" | "ratings" | "draw"; // data source / confidence
}

export interface ForecastInput {
  playerRank: number | null;
  fieldRefRank: number | null; // field-strength proxy (e.g. the event's cutoff rank)
  pointsByRound: unknown;
  prizeMoneyByRound: unknown;
}

// Per-event forecast. Reaching round j needs j wins, each ~independent at
// `winProb`, so P(reach the j-th present round) = winProb^j — a clean advancement
// curve that shifts mass to later rounds as the player gets stronger.
export function forecastEvent(input: ForecastInput): EventForecast {
  const winProb = matchWinProbability(input.playerRank, input.fieldRefRank);
  const keys = ROUND_ORDER.filter((k) => roundValue(input.pointsByRound, k) != null);
  const n = keys.length;

  const reachProb: Partial<Record<Round, number>> = {};
  for (let j = 0; j < n; j++) reachProb[keys[j]] = Math.pow(winProb, j);

  const titleProb = n > 0 ? Math.pow(winProb, n - 1) : 0;
  const deepRound = keys.find((k) => k === "SF" || k === "F" || k === "W");
  const deepRunProb = deepRound ? (reachProb[deepRound] ?? 0) : 0;

  return {
    winProb,
    reachProb,
    expectedResult: expectedResultLabel(input.pointsByRound, winProb),
    expectedPoints: Math.round(expectedRoundValue(input.pointsByRound, winProb)),
    expectedPrize: Math.round(expectedRoundValue(input.prizeMoneyByRound, winProb)),
    titleProb,
    deepRunProb,
    basis: "rank",
  };
}
