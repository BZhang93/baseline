// Deep-links out to external search results for fast ticketing/booking. We
// surface links only — we don't transact (PRD v1 non-goal).

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Google Flights search from one place to another. Labels can be "City,
// Country" strings; the query search handles them.
export function flightSearchUrl(from: string, to: string): string {
  const q = `Flights to ${to} from ${from}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
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
