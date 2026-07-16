// Pure, dependency-free travel estimates. Kept separate from schedules.ts (which
// imports Prisma) so it's safe to use in client components and the optimizer.

export interface Coord {
  lat: number;
  long: number;
}

// Great-circle distance in km.
export function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLong = toRad(b.long - a.long);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLong / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Rough v1 flight estimate from distance (real APIs land in Phase 1). ~800 km/h
// plus ~2h airport overhead; ~$0.15/km. Clearly an estimate, not a quote.
export function estimateTravel(distanceKm: number): {
  durationMinutes: number;
  costEstimate: number;
} {
  return {
    durationMinutes: Math.round((distanceKm / 800) * 60 + 120),
    costEstimate: Math.round(distanceKm * 0.15),
  };
}
