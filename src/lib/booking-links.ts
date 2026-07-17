// Deep-links out to external search results for fast ticketing/booking. We
// surface links only — we don't transact (PRD v1 non-goal).

import { TransportMode } from "@/generated/prisma/enums";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

// Google Flights search from one place to another. Labels can be "City,
// Country" strings; the query search handles them.
export function flightSearchUrl(from: string, to: string): string {
  const q = `Flights to ${to} from ${from}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

// Booking deep-link for a leg, matched to the player's preferred transport mode.
// Falls back to a flight search when no mode is set.
export function transportSearchUrl(
  from: string,
  to: string,
  mode: TransportMode | null,
): string {
  switch (mode) {
    case TransportMode.TRAIN:
      return googleSearchUrl(`trains from ${from} to ${to}`);
    case TransportMode.BUS:
      return googleSearchUrl(`buses from ${from} to ${to}`);
    case TransportMode.CAR:
    case TransportMode.RIDESHARE:
      return `https://www.google.com/maps/dir/${encodeURIComponent(from)}/${encodeURIComponent(to)}`;
    case TransportMode.FLIGHT:
    default:
      return flightSearchUrl(from, to);
  }
}

// Booking.com search for stays in a city, optionally with a check-in date.
export function lodgingSearchUrl(
  city: string,
  country: string,
  checkIn?: Date | null,
): string {
  const params = new URLSearchParams({ ss: `${city}, ${country}` });
  if (checkIn) params.set("checkin", isoDate(checkIn));
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}
