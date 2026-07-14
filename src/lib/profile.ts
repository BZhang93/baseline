import { prisma } from "@/lib/prisma";
import { Tour, Surface, BudgetTier, UnitSystem, Circuit } from "@/generated/prisma/client";
import { toursForCircuit, rankingTourForCircuit } from "@/lib/circuit";

export interface ProfileInput {
  name: string | null;
  ranking: number | null;
  circuit: Circuit | null;
  tours: Tour[];
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
const CIRCUITS = Object.values(Circuit) as string[];

// Validates a profile; returns an error message, or null if valid.
export function validateProfile(input: ProfileInput): string | null {
  if (
    input.ranking != null &&
    (!Number.isInteger(input.ranking) || input.ranking < 1)
  ) {
    return "Ranking must be a positive whole number.";
  }
  if (input.circuit != null && !CIRCUITS.includes(input.circuit)) {
    return "Unknown circuit.";
  }
  // Tours must belong to the chosen circuit (and a circuit is required to pick tours).
  if (input.tours.length > 0) {
    if (input.circuit == null) return "Choose a circuit before selecting tours.";
    const allowed = new Set<string>(toursForCircuit(input.circuit));
    if (input.tours.some((t) => !allowed.has(t))) {
      return "A selected tour isn't part of your circuit.";
    }
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
      circuit: input.circuit,
      tours: input.tours,
      // Ranking list derives from the circuit; drives the cutoff gap.
      rankingTour: input.circuit ? rankingTourForCircuit(input.circuit) : null,
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
