import { describe, it, expect } from "vitest";
import { validateProfile, type ProfileInput } from "./profile";
import {
  Tour,
  Surface,
  UnitSystem,
  Circuit,
  TransportMode,
  LodgingType,
} from "@/generated/prisma/client";

const base: ProfileInput = {
  name: "Maya",
  ranking: 180,
  circuit: Circuit.WOMENS,
  tours: [Tour.WTA, Tour.ITF],
  nationality: ["HR"],
  homeBaseCity: "Zagreb",
  homeBaseCountry: "Croatia",
  surfacePrefs: [Surface.CLAY],
  budget: 6000,
  currency: "EUR",
  unitSystem: UnitSystem.METRIC,
  transportModes: [TransportMode.FLIGHT, TransportMode.TRAIN],
  lodgingTypes: [LodgingType.HOTEL, LodgingType.RESIDENCE],
  travelSpend: 60,
  lodgingSpend: 30,
  dietaryPrefs: ["gluten-free"],
  maxDistanceToVenueKm: 15,
  lodgingAmenities: ["kitchen"],
  tourProfileUrl: null,
};

describe("validateProfile", () => {
  it("accepts a valid profile", () => {
    expect(validateProfile(base)).toBeNull();
  });

  it("requires name, circuit, and ranking (onboarding)", () => {
    expect(validateProfile({ ...base, name: null })).toMatch(/Name is required/);
    expect(validateProfile({ ...base, name: "  " })).toMatch(/Name is required/);
    expect(validateProfile({ ...base, circuit: null })).toMatch(/Circuit is required/);
    expect(validateProfile({ ...base, ranking: null })).toMatch(/Ranking is required/);
  });

  it("rejects out-of-range spend", () => {
    expect(validateProfile({ ...base, travelSpend: 150 })).toMatch(/between 0 and 100/);
    expect(validateProfile({ ...base, lodgingSpend: -1 })).toMatch(/between 0 and 100/);
  });

  it("rejects duplicate transport modes", () => {
    expect(
      validateProfile({
        ...base,
        transportModes: [TransportMode.FLIGHT, TransportMode.FLIGHT],
      }),
    ).toMatch(/Invalid transport/);
  });

  it("rejects a non-positive or non-integer ranking", () => {
    expect(validateProfile({ ...base, ranking: 0 })).toMatch(/positive whole number/);
    expect(validateProfile({ ...base, ranking: 12.5 })).toMatch(/positive whole number/);
  });

  it("rejects tours that don't belong to the chosen circuit", () => {
    // ATP is a men's tour; not valid for a women's circuit.
    expect(
      validateProfile({ ...base, circuit: Circuit.WOMENS, tours: [Tour.ATP] }),
    ).toMatch(/isn't part of your circuit/);
  });

  it("rejects tours without a circuit (circuit is required)", () => {
    // Circuit is now required, so a null circuit fails on the required check.
    expect(validateProfile({ ...base, circuit: null, tours: [Tour.WTA] })).toMatch(
      /Circuit is required/,
    );
  });

  it("rejects a negative or non-integer budget", () => {
    expect(validateProfile({ ...base, budget: -100 })).toMatch(/positive whole number/);
    expect(validateProfile({ ...base, budget: 99.5 })).toMatch(/positive whole number/);
  });

  it("rejects an unknown currency", () => {
    expect(validateProfile({ ...base, currency: "XYZ" })).toMatch(/Unknown currency/);
  });

  it("rejects a negative max distance", () => {
    expect(validateProfile({ ...base, maxDistanceToVenueKm: -5 })).toMatch(/negative/);
  });

  it("accepts a valid ATP/WTA/ITF tour profile URL and rejects others", () => {
    expect(
      validateProfile({ ...base, tourProfileUrl: "https://www.atptour.com/en/players/x/y/overview" }),
    ).toBeNull();
    expect(validateProfile({ ...base, tourProfileUrl: "https://example.com/me" })).toMatch(
      /ATP, WTA, or ITF/,
    );
  });
});
