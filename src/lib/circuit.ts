// Client-safe: imports enums (not the DB client), so it can be used in both
// server and client components.
import { Circuit, Tour } from "@/generated/prisma/enums";

// The tours available on each circuit.
export function toursForCircuit(circuit: Circuit): Tour[] {
  return circuit === Circuit.MENS
    ? [Tour.ATP, Tour.CHALLENGER, Tour.ITF]
    : [Tour.WTA, Tour.ITF];
}

// The ranking list used for the cutoff gap on each circuit.
export function rankingTourForCircuit(circuit: Circuit): Tour {
  return circuit === Circuit.MENS ? Tour.ATP : Tour.WTA;
}

// The circuit that owns a given ranking tour (for back-deriving from legacy
// data that only had rankingTour).
export function circuitForRankingTour(tour: Tour | null): Circuit | null {
  if (tour === Tour.ATP) return Circuit.MENS;
  if (tour === Tour.WTA) return Circuit.WOMENS;
  return null;
}
