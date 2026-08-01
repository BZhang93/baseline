import { describe, it, expect } from "vitest";
import { flightSearchUrl, lodgingSearchUrl, transportSearchUrl, officialSiteUrl } from "./booking-links";
import { TransportMode } from "@/generated/prisma/enums";

describe("officialSiteUrl", () => {
  it("builds a search for the event's official site", () => {
    const url = officialSiteUrl("Cincinnati Open");
    expect(url).toContain("https://www.google.com/search?q=");
    expect(decodeURIComponent(url)).toContain("Cincinnati Open tennis tournament official site");
  });

  it("strips a trailing disambiguation suffix from the query", () => {
    expect(decodeURIComponent(officialSiteUrl("Cincinnati Open (WTA)"))).toContain(
      "Cincinnati Open tennis tournament official site",
    );
    expect(decodeURIComponent(officialSiteUrl("Kingston Challenger (Aug 17)"))).toContain(
      "Kingston Challenger tennis tournament official site",
    );
  });
});

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

describe("transportSearchUrl", () => {
  it("uses Google Flights for FLIGHT and the null/default fallback", () => {
    expect(transportSearchUrl("Hamburg", "Prague", TransportMode.FLIGHT)).toContain(
      "google.com/travel/flights",
    );
    expect(transportSearchUrl("Hamburg", "Prague", null)).toContain(
      "google.com/travel/flights",
    );
  });
  it("searches rail/coach for TRAIN and BUS", () => {
    expect(decodeURIComponent(transportSearchUrl("Umag", "Gstaad", TransportMode.TRAIN))).toContain(
      "trains from Umag to Gstaad",
    );
    expect(decodeURIComponent(transportSearchUrl("Umag", "Gstaad", TransportMode.BUS))).toContain(
      "buses from Umag to Gstaad",
    );
  });
  it("uses Maps directions for CAR and RIDESHARE", () => {
    expect(transportSearchUrl("Umag", "Gstaad", TransportMode.CAR)).toContain(
      "google.com/maps/dir",
    );
    expect(transportSearchUrl("Umag", "Gstaad", TransportMode.RIDESHARE)).toContain(
      "google.com/maps/dir",
    );
  });
});
