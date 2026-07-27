// Shared display formatters used across the app's screens.

const MONTH = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "Jul 13–19" (same month) or "Jul 27–Aug 2" (crossing months). UTC-based so it
// matches the stored dates regardless of the viewer's timezone.
export function formatDateRange(start: Date, end: Date): string {
  const s = `${MONTH[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const e =
    start.getUTCMonth() === end.getUTCMonth()
      ? `${end.getUTCDate()}`
      : `${MONTH[end.getUTCMonth()]} ${end.getUTCDate()}`;
  return `${s}–${e}`;
}

// "Jul 11" — a single date, UTC-based to match stored dates.
export function formatDate(d: Date): string {
  return `${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function formatMoney(amount: number | null, currency = "USD"): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTravelTime(minutes: number | null): string {
  if (minutes == null || minutes === 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// "CLAY" -> "Clay"
export function capitalize(word: string): string {
  return word.charAt(0) + word.slice(1).toLowerCase();
}

export const formatSurface = capitalize;

// Tour labels: ATP / WTA / ITF are acronyms (kept upper-case); "CHALLENGER"
// reads as a word.
export function formatTour(tour: string): string {
  return tour === "CHALLENGER" ? "Challenger" : tour;
}

// Combined tour+level label for an event pill, e.g. "Challenger 125", "ATP 250",
// "WTA 1000", "ITF M25", "Grand Slam". The tier already encodes the tour, so this
// replaces showing a separate (redundant) tour pill next to the tier.
export function formatTierLabel(tier: string): string {
  if (tier === "GRAND_SLAM") return "Grand Slam";
  const [head, ...rest] = tier.split("_");
  const label = head === "CHALLENGER" ? "Challenger" : head; // ATP/WTA/ITF stay upper-case
  return rest.length ? `${label} ${rest.join(" ")}` : label;
}

export function formatTransportMode(mode: string): string {
  return capitalize(mode); // FLIGHT -> Flight, RIDESHARE -> Rideshare, …
}

const LODGING_LABELS: Record<string, string> = {
  HOTEL: "Hotel",
  RESIDENCE: "Residence (Airbnb-style)",
  APARTMENT: "Apartment / extended-stay",
  HOSTEL: "Hostel",
  HOST_HOUSING: "Host housing",
  BNB: "B&B",
};
export function formatLodgingType(type: string): string {
  return LODGING_LABELS[type] ?? capitalize(type);
}

// Distance conversions. Distances are stored canonically in km; the UI converts
// for players who prefer imperial units.
const KM_PER_MI = 1.609344;
export function kmToMi(km: number): number {
  return km / KM_PER_MI;
}
export function miToKm(mi: number): number {
  return mi * KM_PER_MI;
}
