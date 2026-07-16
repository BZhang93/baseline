import { prisma } from "@/lib/prisma";
import {
  Tour,
  Surface,
  UnitSystem,
  Circuit,
  TransportMode,
  LodgingType,
} from "@/generated/prisma/client";
import { toursForCircuit, rankingTourForCircuit } from "@/lib/circuit";
import { isCurrency } from "@/lib/currency";
import { isValidTourProfileUrl } from "@/lib/tour-profile";

export interface ProfileInput {
  name: string | null;
  ranking: number | null;
  circuit: Circuit | null;
  tours: Tour[];
  tourProfileUrl: string | null;
  nationality: string[];
  homeBaseCity: string | null;
  homeBaseCountry: string | null;
  surfacePrefs: Surface[];
  budget: number | null;
  currency: string;
  unitSystem: UnitSystem;
  transportModes: TransportMode[];
  lodgingTypes: LodgingType[];
  travelSpend: number;
  lodgingSpend: number;
  dietaryPrefs: string[];
  maxDistanceToVenueKm: number | null;
  lodgingAmenities: string[];
}

const SURFACES = Object.values(Surface) as string[];
const UNIT_SYSTEMS = Object.values(UnitSystem) as string[];
const CIRCUITS = Object.values(Circuit) as string[];
const TRANSPORT_MODES = Object.values(TransportMode) as string[];
const LODGING_TYPES = Object.values(LodgingType) as string[];

function validSpend(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 100;
}
function hasDuplicates<T>(arr: T[]): boolean {
  return new Set(arr).size !== arr.length;
}

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
  if (input.budget != null && (!Number.isInteger(input.budget) || input.budget < 0)) {
    return "Budget must be a positive whole number.";
  }
  if (!isCurrency(input.currency)) {
    return "Unknown currency.";
  }
  if (!UNIT_SYSTEMS.includes(input.unitSystem)) {
    return "Unknown measurement system.";
  }
  if (
    input.transportModes.some((m) => !TRANSPORT_MODES.includes(m)) ||
    hasDuplicates(input.transportModes)
  ) {
    return "Invalid transport modes.";
  }
  if (input.lodgingTypes.some((t) => !LODGING_TYPES.includes(t)) || hasDuplicates(input.lodgingTypes)) {
    return "Invalid lodging types.";
  }
  if (!validSpend(input.travelSpend) || !validSpend(input.lodgingSpend)) {
    return "Spend preferences must be between 0 and 100.";
  }
  if (input.maxDistanceToVenueKm != null && input.maxDistanceToVenueKm < 0) {
    return "Max distance can't be negative.";
  }
  if (input.tourProfileUrl != null && !isValidTourProfileUrl(input.tourProfileUrl)) {
    return "Tour profile must be an ATP, WTA, or ITF player page URL.";
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
      tourProfileUrl: input.tourProfileUrl,
      nationality: input.nationality,
      homeBaseCity: input.homeBaseCity,
      homeBaseCountry: input.homeBaseCountry,
      surfacePrefs: input.surfacePrefs,
      budget: input.budget,
      currency: input.currency,
      unitSystem: input.unitSystem,
      transportModes: input.transportModes,
      lodgingTypes: input.lodgingTypes,
      travelSpend: input.travelSpend,
      lodgingSpend: input.lodgingSpend,
      dietaryPrefs: input.dietaryPrefs,
      maxDistanceToVenueKm: input.maxDistanceToVenueKm,
      lodgingAmenities: input.lodgingAmenities,
    },
  });
}
