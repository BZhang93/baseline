import { describe, it, expect } from "vitest";
import { flightSearchUrl, lodgingSearchUrl } from "./booking-links";

describe("flightSearchUrl", () => {
  it("builds a Google Flights query from/to", () => {
    const url = flightSearchUrl("Hamburg, Germany", "Prague, Czechia");
    expect(url).toContain("https://www.google.com/travel/flights?q=");
    expect(decodeURIComponent(url)).toContain("Flights to Prague, Czechia from Hamburg, Germany");
  });

  it("URL-encodes special characters", () => {
    const url = flightSearchUrl("A & B", "C/D");
    expect(url).not.toContain(" ");
    expect(url).not.toContain("&C");
  });
});

describe("lodgingSearchUrl", () => {
  it("builds a Booking.com search for the city + country", () => {
    const url = lodgingSearchUrl("Palermo", "Italy");
    expect(url).toContain("https://www.booking.com/searchresults.html?");
    expect(url).toContain("Palermo");
    expect(url).toContain("Italy");
  });

  it("includes a check-in date when provided", () => {
    const url = lodgingSearchUrl("Palermo", "Italy", new Date("2026-07-13"));
    expect(url).toContain("checkin=2026-07-13");
  });
});
