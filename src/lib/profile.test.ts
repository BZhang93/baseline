import { describe, it, expect } from "vitest";
import { validateProfile, type ProfileInput } from "./profile";
import { Tour, Surface, BudgetTier, UnitSystem, Circuit } from "@/generated/prisma/client";

const base: ProfileInput = {
  name: "Maya",
  ranking: 180,
  circuit: Circuit.WOMENS,
  tours: [Tour.WTA, Tour.ITF],
  nationality: ["HR"],
  homeBaseCity: "Zagreb",
  homeBaseCountry: "Croatia",
  surfacePrefs: [Surface.CLAY],
  budgetTier: BudgetTier.LOW,
  unitSystem: UnitSystem.METRIC,
  dietaryPrefs: ["gluten-free"],
  maxDistanceToVenueKm: 15,
  lodgingAmenities: ["kitchen"],
};

describe("validateProfile", () => {
  it("accepts a valid profile", () => {
    expect(validateProfile(base)).toBeNull();
  });

  it("accepts an all-empty profile (nothing required)", () => {
    expect(
      validateProfile({
        name: null,
        ranking: null,
        circuit: null,
        tours: [],
        nationality: [],
        homeBaseCity: null,
        homeBaseCountry: null,
        surfacePrefs: [],
        budgetTier: null,
        unitSystem: UnitSystem.IMPERIAL,
        dietaryPrefs: [],
        maxDistanceToVenueKm: null,
        lodgingAmenities: [],
      }),
    ).toBeNull();
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

  it("requires a circuit before selecting tours", () => {
    expect(validateProfile({ ...base, circuit: null, tours: [Tour.WTA] })).toMatch(
      /Choose a circuit/,
    );
  });

  it("rejects a negative max distance", () => {
    expect(validateProfile({ ...base, maxDistanceToVenueKm: -5 })).toMatch(/negative/);
  });
});
