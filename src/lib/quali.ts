// Qualifying-weekend arrival dates (player-feedback P1-6). Challenger/ITF
// qualifying runs the weekend before the main draw, so a player entering quali
// arrives earlier than the listed Monday start. Pure + dependency-light so it's
// usable client- and server-side.

import { Tour } from "@/generated/prisma/enums";

// Tours whose draw structure includes an on-site qualifying weekend before the
// main draw. ATP/WTA main-tour qualifying is scheduled differently and is out of
// scope for this heuristic.
export function hasQualifyingWeekend(tour: Tour): boolean {
  return tour === Tour.CHALLENGER || tour === Tour.ITF;
}

// A player enters qualifying when their ranking is below the event's main-draw
// cutoff. Ranks are compared directly (player and cutoff are on the same circuit
// scale) because Challenger/ITF have no ranking-points model — their acceptance
// status is always "unknown", so we can't key off it. Unknown rank/cutoff ⇒
// assume direct entry (no invented early arrival).
export function entersQualifying(
  playerRanking: number | null,
  cutoffRank: number | null,
): boolean {
  if (playerRanking == null || cutoffRank == null) return false;
  return playerRanking > cutoffRank;
}

// Quali sign-in is ~the weekend before the main draw.
const QUALI_LEAD_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

// Heuristic quali start: QUALI_LEAD_DAYS before the main-draw start. Subtracts
// whole days in absolute time so it's timezone/DST-proof (dates are UTC midnights).
export function heuristicQualiStart(mainDrawStart: Date): Date {
  return new Date(mainDrawStart.getTime() - QUALI_LEAD_DAYS * DAY_MS);
}

export interface QualiTournament {
  tour: Tour;
  startDate: Date;
  // Real quali date once the scraper provides it; else null → heuristic.
  qualiStartDate: Date | null;
}

// The date the player needs to arrive for this event: qualifying sign-in when
// they're a quali entrant at a quali-weekend event (real date preferred over the
// heuristic), otherwise the main-draw start.
export function arrivalDate(
  t: QualiTournament,
  playerRanking: number | null,
  cutoffRank: number | null,
): Date {
  if (hasQualifyingWeekend(t.tour) && entersQualifying(playerRanking, cutoffRank)) {
    return t.qualiStartDate ?? heuristicQualiStart(t.startDate);
  }
  return t.startDate;
}

// Whether the arrival is a qualifying arrival (earlier than main-draw start).
export function isQualiArrival(
  t: QualiTournament,
  playerRanking: number | null,
  cutoffRank: number | null,
): boolean {
  return arrivalDate(t, playerRanking, cutoffRank).getTime() < t.startDate.getTime();
}
