// Direct official-site URLs, keyed by the EXACT tournament name as it appears in
// the app (e.g. "US Open (ATP)"). Fill these in to turn the "Official site"
// button into a direct link; any event not listed here falls back to a targeted
// search (see `officialSiteUrl` in booking-links.ts).
//
// Names that exist on both tours can differ (the ATP/WTA Canadian Opens are in
// different cities, for example), so key them separately with their (ATP)/(WTA)
// suffix. A paid data feed could later populate these automatically.
//
// Example:
//   "US Open (ATP)": "https://www.usopen.org",
//   "US Open (WTA)": "https://www.usopen.org",
export const OFFICIAL_URLS: Record<string, string> = {
  // Add entries here.
};
