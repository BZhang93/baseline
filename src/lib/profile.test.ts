import { describe, it, expect } from "vitest";
import { validateProfile, type ProfileInput } from "./profile";
import { Tour, Surface, BudgetTier, UnitSystem } from "@/generated/prisma/client";

const base: ProfileInput = {
  name: "Maya",
  ranking: 180,
  rankingTour: Tour.WTA,
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
        rankingTour: null,
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

  it("rejects a ranking tour other than ATP/WTA", () => {
    expect(validateProfile({ ...base, rankingTour: Tour.ITF })).toMatch(/ATP or WTA/);
  });

  it("rejects a negative max distance", () => {
    expect(validateProfile({ ...base, maxDistanceToVenueKm: -5 })).toMatch(/negative/);
  });
});
