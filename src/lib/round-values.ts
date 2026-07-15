// Safe accessor for the `RoundValues` JSON blobs stored on TournamentCategory
// (`pointsByRound` / `prizeMoneyByRound`). Those columns are Prisma `Json`, so
// they come back typed as `unknown` — this guards the shape in one place
// instead of each caller re-deriving it. Returns null when the key is absent or
// not a number (e.g. an event with no matching category).
export function roundValue(json: unknown, key: string): number | null {
  if (json && typeof json === "object" && key in (json as Record<string, unknown>)) {
    const v = (json as Record<string, unknown>)[key];
    return typeof v === "number" ? v : null;
  }
  return null;
}
