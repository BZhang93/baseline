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

// Distance conversions. Distances are stored canonically in km; the UI converts
// for players who prefer imperial units.
const KM_PER_MI = 1.609344;
export function kmToMi(km: number): number {
  return km / KM_PER_MI;
}
export function miToKm(mi: number): number {
  return mi * KM_PER_MI;
}
