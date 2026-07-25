// Draw-dependent departure window (player-feedback P1-5). When you leave depends
// on how far you advance: a first-round loss frees you early in the week, a run
// to the final keeps you until the end. Pure + timezone-proof (dates are UTC
// midnights), so it runs client- and server-side.

const DAY_MS = 24 * 60 * 60 * 1000;

// Number of main-draw rounds implied by the draw size (32 → 5, 128 → 7).
export function roundsForDraw(drawSize: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, drawSize))));
}

export interface DepartureWindow {
  // Day after a first-round loss — the earliest you could leave.
  earliest: Date;
  // Day after the final — the latest you'd stay (won or lost the last match).
  latest: Date;
  // Rounds you'd have to win to stay until `latest` (from the draw size).
  rounds: number;
}

// The event runs [startDate, endDate] (the final on endDate); the draw size sets
// how many rounds stand between the first round and that final.
export function departureWindow(
  startDate: Date,
  endDate: Date,
  drawSize: number,
): DepartureWindow {
  return {
    earliest: new Date(startDate.getTime() + DAY_MS),
    latest: new Date(endDate.getTime() + DAY_MS),
    rounds: roundsForDraw(drawSize),
  };
}
