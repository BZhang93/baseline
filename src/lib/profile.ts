import { prisma } from "@/lib/prisma";
import { Tour, Surface, BudgetTier, UnitSystem } from "@/generated/prisma/client";

export interface ProfileInput {
  name: string | null;
  ranking: number | null;
  rankingTour: Tour | null;
  nationality: string[];
  homeBaseCity: string | null;
  homeBaseCountry: string | null;
  surfacePrefs: Surface[];
  budgetTier: BudgetTier | null;
  unitSystem: UnitSystem;
  dietaryPrefs: string[];
  maxDistanceToVenueKm: number | null;
  lodgingAmenities: string[];
}

const SURFACES = Object.values(Surface) as string[];
const BUDGET_TIERS = Object.values(BudgetTier) as string[];
const UNIT_SYSTEMS = Object.values(UnitSystem) as string[];

// Validates a profile; returns an error message, or null if valid.
export function validateProfile(input: ProfileInput): string | null {
  if (
    input.ranking != null &&
    (!Number.isInteger(input.ranking) || input.ranking < 1)
  ) {
    return "Ranking must be a positive whole number.";
  }
  if (input.rankingTour != null && input.rankingTour !== Tour.ATP && input.rankingTour !== Tour.WTA) {
    return "Ranking tour must be ATP or WTA.";
  }
  if (input.surfacePrefs.some((s) => !SURFACES.includes(s))) {
    return "Unknown surface preference.";
  }
  if (input.budgetTier != null && !BUDGET_TIERS.includes(input.budgetTier)) {
    return "Unknown budget tier.";
  }
  if (!UNIT_SYSTEMS.includes(input.unitSystem)) {
    return "Unknown measurement system.";
  }
  if (input.maxDistanceToVenueKm != null && input.maxDistanceToVenueKm < 0) {
    return "Max distance can't be negative.";
  }
  return null;
}

export async function updatePlayerProfile(
  playerId: string,
  input: ProfileInput,
): Promise<void> {
  await prisma.player.update({
    where: { id: playerId },
    data: {
      name: input.name,
      ranking: input.ranking,
      rankingTour: input.rankingTour,
      nationality: input.nationality,
      homeBaseCity: input.homeBaseCity,
      homeBaseCountry: input.homeBaseCountry,
      surfacePrefs: input.surfacePrefs,
      budgetTier: input.budgetTier,
      unitSystem: input.unitSystem,
      dietaryPrefs: input.dietaryPrefs,
      maxDistanceToVenueKm: input.maxDistanceToVenueKm,
      lodgingAmenities: input.lodgingAmenities,
    },
  });
}
