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

// Resolves the Browse page's Tour filter from the player's profile:
//  - `options`: the tours shown in the dropdown (the player's circuit, or all
//    tours when there's no circuit / no player).
//  - `tour`: the single tour to filter by. Defaults to the player's tour when
//    they compete on exactly one and haven't chosen one this visit; an
//    out-of-circuit selection is dropped.
//  - `tours`: when no single tour applies, the player's selected tours — so
//    "All tours" means "all of the tours I play" (their whole circuit only when
//    they haven't picked any), never another circuit's events.
export function resolveBrowseTours(params: {
  circuit: Circuit | null;
  playerTours: Tour[];
  selectedTour: Tour | undefined;
  tourExplicit: boolean;
}): { tour?: Tour; tours?: Tour[]; options: Tour[] } {
  const { circuit, playerTours, selectedTour, tourExplicit } = params;
  const options = circuit ? toursForCircuit(circuit) : (Object.values(Tour) as Tour[]);
  const myTours = playerTours.filter((t) => options.includes(t));

  let tour = selectedTour && options.includes(selectedTour) ? selectedTour : undefined;
  if (!tourExplicit && !tour && myTours.length === 1) {
    tour = myTours[0];
  }

  let tours: Tour[] | undefined;
  if (!tour) {
    tours = myTours.length > 0 ? myTours : circuit ? options : undefined;
  }
  return { tour, tours, options };
}
